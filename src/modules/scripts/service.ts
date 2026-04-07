import { STORY_DRAFT_PROMPT, getPromptMeta } from "@/lib/prompts";
import { getOpenAIClient } from "@/lib/ai";
import { buildSceneOutline, countWords } from "@/modules/scripts/draft-utils";
import type { GeneratedStoryDraft, StoryGenerationInput, StoryOutput } from "@/modules/scripts/types";

const SHORT_SCRIPT_ERROR = "OpenAI response script is too short for target runtime.";

function parseStoryOutput(content: string): StoryOutput {
  let parsed: unknown;

  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("OpenAI response was not valid JSON.");
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("OpenAI response JSON was not an object.");
  }

  const entry = parsed as Partial<StoryOutput>;

  if (!Array.isArray(entry.titleOptions) || entry.titleOptions.some((title) => typeof title !== "string")) {
    throw new Error("OpenAI response missing valid titleOptions array.");
  }
  if (typeof entry.hook !== "string" || !entry.hook.trim()) {
    throw new Error("OpenAI response missing valid hook.");
  }
  if (typeof entry.script !== "string" || !entry.script.trim()) {
    throw new Error("OpenAI response missing valid script.");
  }

  return {
    titleOptions: entry.titleOptions,
    hook: entry.hook.trim(),
    script: entry.script.trim(),
  };
}

function countSentences(value: string): number {
  return value
    .split(/[.!?]+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean).length;
}

function normalize(value: string | undefined): string {
  return (value ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

function hasEchoedInput(output: string, input: StoryGenerationInput): boolean {
  const normalizedOutput = normalize(output);
  const candidates = [input.theme, input.premise, input.tone, input.plotNotes]
    .map((value) => normalize(value))
    .filter((value) => value.length >= 16);

  return candidates.some((candidate) => normalizedOutput.includes(candidate));
}

function getMinimumNarrativeWordCount(input: StoryGenerationInput): number {
  return Math.max(350, Math.round(input.targetRuntimeMin * 90));
}

function validateCreativeOutput(output: StoryOutput, input: StoryGenerationInput): void {
  if (output.titleOptions.length !== 3) {
    throw new Error("OpenAI response must include exactly 3 title options.");
  }

  const hookSentenceCount = countSentences(output.hook);
  if (hookSentenceCount < 3 || hookSentenceCount > 5) {
    throw new Error("OpenAI response hook must contain 3 to 5 sentences.");
  }

  if (!/\byou\b/i.test(output.hook) || !/\byou\b/i.test(output.script)) {
    throw new Error("OpenAI response must use second-person narrator voice.");
  }

  const narrativeWordCount = countWords(output.script);
  const minWords = getMinimumNarrativeWordCount(input);
  if (narrativeWordCount < minWords) {
    throw new Error(SHORT_SCRIPT_ERROR);
  }

  const fullOutput = [output.titleOptions.join(" "), output.hook, output.script].join(" ");
  if (hasEchoedInput(fullOutput, input)) {
    throw new Error("OpenAI response echoed input text instead of generating original prose.");
  }
}

function buildUserPrompt(
  input: StoryGenerationInput,
  options?: { minimumWordCount?: number; isRetry?: boolean },
): string {
  const minimumWordCount = options?.minimumWordCount ?? getMinimumNarrativeWordCount(input);
  const retryInstruction = options?.isRetry
    ? `
Important retry instruction:
- Your previous draft was too short.
- Return a fuller version of the same story concept.
- The "script" field must be at least ${minimumWordCount} words.
- Do not shorten the middle or ending.
`.trim()
    : "";

  return `
Project name: ${input.projectName}
Theme: ${input.theme}
Premise: ${input.premise}
Plot notes: ${input.plotNotes}
Tone: ${input.tone}
Target runtime (minutes): ${input.targetRuntimeMin}
Minimum script word count: ${minimumWordCount}
${retryInstruction}
`.trim();
}

async function requestStoryOutput(
  input: StoryGenerationInput,
  options?: { isRetry?: boolean },
): Promise<StoryOutput> {
  const openai = getOpenAIClient();

  const response = await openai.chat.completions.create({
    model: STORY_DRAFT_PROMPT.model,
    temperature: STORY_DRAFT_PROMPT.temperature,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: STORY_DRAFT_PROMPT.systemPrompt },
      {
        role: "user",
        content: buildUserPrompt(input, {
          minimumWordCount: getMinimumNarrativeWordCount(input),
          isRetry: options?.isRetry,
        }),
      },
    ],
  });

  const content = response.choices[0]?.message?.content?.trim();
  if (!content) {
    throw new Error("OpenAI returned an empty response.");
  }

  return parseStoryOutput(content);
}

export async function generateStoryDraft(input: StoryGenerationInput): Promise<GeneratedStoryDraft> {
  let output = await requestStoryOutput(input);

  try {
    validateCreativeOutput(output, input);
  } catch (error) {
    if (!(error instanceof Error) || error.message !== SHORT_SCRIPT_ERROR) {
      throw error;
    }

    output = await requestStoryOutput(input, { isRetry: true });
    validateCreativeOutput(output, input);
  }

  return {
    titleOptions: output.titleOptions,
    hook: output.hook,
    narrationDraft: output.script,
    notes: `Generated with ${STORY_DRAFT_PROMPT.model} for ${input.targetRuntimeMin} minute target runtime.`,
    sceneOutline: buildSceneOutline(output.script),
    llmMeta: getPromptMeta(STORY_DRAFT_PROMPT),
  };
}
