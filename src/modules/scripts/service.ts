import { STORY_DRAFT_PROMPT, getPromptMeta } from "@/lib/prompts";
import { getOpenAIClient } from "@/lib/ai";
import { buildSceneOutline, countWords } from "@/modules/scripts/draft-utils";
import type { GeneratedStoryDraft, StoryGenerationInput, StoryOutput } from "@/modules/scripts/types";

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
  const minWords = Math.max(350, Math.round(input.targetRuntimeMin * 90));
  if (narrativeWordCount < minWords) {
    throw new Error("OpenAI response script is too short for target runtime.");
  }

  const fullOutput = [output.titleOptions.join(" "), output.hook, output.script].join(" ");
  if (hasEchoedInput(fullOutput, input)) {
    throw new Error("OpenAI response echoed input text instead of generating original prose.");
  }
}

export async function generateStoryDraft(input: StoryGenerationInput): Promise<GeneratedStoryDraft> {
  const openai = getOpenAIClient();

  const userPrompt = `
Project name: ${input.projectName}
Theme: ${input.theme}
Premise: ${input.premise}
Plot notes: ${input.plotNotes}
Tone: ${input.tone}
Target runtime (minutes): ${input.targetRuntimeMin}
`.trim();

  const response = await openai.chat.completions.create({
    model: STORY_DRAFT_PROMPT.model,
    temperature: STORY_DRAFT_PROMPT.temperature,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: STORY_DRAFT_PROMPT.systemPrompt },
      { role: "user", content: userPrompt },
    ],
  });

  const content = response.choices[0]?.message?.content?.trim();
  if (!content) {
    throw new Error("OpenAI returned an empty response.");
  }

  const output = parseStoryOutput(content);
  validateCreativeOutput(output, input);

  return {
    titleOptions: output.titleOptions,
    hook: output.hook,
    narrationDraft: output.script,
    notes: `Generated with ${STORY_DRAFT_PROMPT.model} for ${input.targetRuntimeMin} minute target runtime.`,
    sceneOutline: buildSceneOutline(output.script),
    llmMeta: getPromptMeta(STORY_DRAFT_PROMPT),
  };
}
