import { STORY_DRAFT_PROMPT, getPromptMeta } from "@/lib/prompts";
import { getOpenAIClient } from "@/lib/ai";
import { buildSceneOutline, countWords } from "@/modules/scripts/draft-utils";
import type { GeneratedStoryDraft, StoryGenerationInput, StoryOutput } from "@/modules/scripts/types";

const SHORT_SCRIPT_ERROR = "OpenAI response script is too short for target runtime.";
const TOO_FEW_PARAGRAPHS_ERROR = "OpenAI response script does not have enough paragraph structure for the target runtime.";
const FLAT_SCRIPT_ERROR = "OpenAI response script is too structurally flat for the target runtime.";
const TITLE_FRAGMENT_ERROR = "OpenAI response titles must be complete and publication-ready.";
const RETRYABLE_STORY_ERRORS = new Set([
  SHORT_SCRIPT_ERROR,
  TOO_FEW_PARAGRAPHS_ERROR,
  FLAT_SCRIPT_ERROR,
  TITLE_FRAGMENT_ERROR,
]);
const TITLE_TRAILING_FRAGMENT_WORDS = new Set([
  "a",
  "about",
  "after",
  "an",
  "and",
  "at",
  "before",
  "behind",
  "between",
  "by",
  "for",
  "from",
  "in",
  "inside",
  "into",
  "its",
  "my",
  "of",
  "on",
  "onto",
  "or",
  "our",
  "out",
  "outside",
  "over",
  "own",
  "their",
  "the",
  "through",
  "to",
  "under",
  "with",
  "without",
  "your",
]);

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

function getNarrativeParagraphs(script: string): string[] {
  return script
    .split(/\n{2,}/)
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function formatPromptValue(value: string | number | undefined): string {
  if (value === undefined) {
    return "Not provided.";
  }

  if (typeof value === "number") {
    return String(value);
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : "Not provided.";
}

function hasEchoedInput(output: string, input: StoryGenerationInput): boolean {
  const normalizedOutput = normalize(output);
  const candidates = [input.theme, input.premise, input.tone, input.plotNotes]
    .map((value) => normalize(value))
    .filter((value) => value.length >= 16);

  return candidates.some((candidate) => normalizedOutput.includes(candidate));
}

function getMinimumNarrativeWordCount(input: StoryGenerationInput): number {
  return Math.max(400, Math.round(input.targetRuntimeMin * 100));
}

function getMinimumParagraphCount(input: StoryGenerationInput): number {
  return Math.max(6, Math.ceil(input.targetRuntimeMin * 0.75));
}

function isObviouslyFragmentedTitle(title: string): boolean {
  const normalizedTitle = title.trim();
  if (!normalizedTitle) {
    return true;
  }

  if (/[:\-–—/]\s*$/.test(normalizedTitle)) {
    return true;
  }

  const words = normalizedTitle
    .replace(/[“”"'.!,?;:()]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  if (words.length < 3) {
    return true;
  }

  const trailingWord = words.at(-1)?.toLowerCase();
  if (trailingWord && TITLE_TRAILING_FRAGMENT_WORDS.has(trailingWord)) {
    return true;
  }

  const colonParts = normalizedTitle.split(":").map((part) => part.trim()).filter(Boolean);
  if (colonParts.length > 1) {
    const trailingPartWordCount = colonParts
      .at(-1)
      ?.replace(/[“”"'.!,?;:()]/g, " ")
      .split(/\s+/)
      .filter(Boolean).length;

    if (!trailingPartWordCount || trailingPartWordCount < 2) {
      return true;
    }
  }

  return false;
}

function validateCreativeOutput(output: StoryOutput, input: StoryGenerationInput): void {
  if (output.titleOptions.length !== 3) {
    throw new Error("OpenAI response must include exactly 3 title options.");
  }

  if (output.titleOptions.some((title) => isObviouslyFragmentedTitle(title))) {
    throw new Error(TITLE_FRAGMENT_ERROR);
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

  const paragraphs = getNarrativeParagraphs(output.script);
  const minParagraphs = getMinimumParagraphCount(input);
  if (paragraphs.length < minParagraphs) {
    throw new Error(TOO_FEW_PARAGRAPHS_ERROR);
  }

  const averageWordsPerParagraph = narrativeWordCount / paragraphs.length;
  if (averageWordsPerParagraph > 140) {
    throw new Error(FLAT_SCRIPT_ERROR);
  }

  const fullOutput = [output.titleOptions.join(" "), output.hook, output.script].join(" ");
  if (hasEchoedInput(fullOutput, input)) {
    throw new Error("OpenAI response echoed input text instead of generating original prose.");
  }
}

function buildUserPrompt(
  input: StoryGenerationInput,
  options?: { minimumWordCount?: number; minimumParagraphCount?: number; isRetry?: boolean },
): string {
  const minimumWordCount = options?.minimumWordCount ?? getMinimumNarrativeWordCount(input);
  const minimumParagraphCount = options?.minimumParagraphCount ?? getMinimumParagraphCount(input);
  const retryInstruction = options?.isRetry
    ? `
Important retry instruction:
- Your previous draft was too short or too compressed.
- Return a fuller, more cinematic version of the same story concept.
- The "script" field must be at least ${minimumWordCount} words.
- Use at least ${minimumParagraphCount} clear paragraphs.
- Add more scene-level detail instead of summarizing events.
- Add more procedural detail and internal decision-making.
- Give the middle of the story more space, especially discovery, controlled risk, escalation, and attrition.
- Develop the turning points more clearly.
- Make the escalation more concrete.
- End with a stronger closing reflection.
- Make sure each title is complete and publication-ready.
`.trim()
    : "";

  return `
Project name: ${formatPromptValue(input.projectName)}
Theme: ${formatPromptValue(input.theme)}
Premise: ${formatPromptValue(input.premise)}
Plot notes: ${formatPromptValue(input.plotNotes)}
Tone: ${formatPromptValue(input.tone)}
Target runtime (minutes): ${input.targetRuntimeMin}
Minimum script word count: ${minimumWordCount}
Minimum paragraph count: ${minimumParagraphCount}

Story development requirements:
- Use the plot notes as the chronological spine when they are present.
- Preserve the major beats from the notes in order.
- Expand those beats into full narration with scene-level detail, transitions, and internal reasoning.
- Do not compress multiple major beats into one paragraph.
- Spend real time in the middle of the story, not just the setup and ending.

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
          minimumParagraphCount: getMinimumParagraphCount(input),
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
    if (!(error instanceof Error) || !RETRYABLE_STORY_ERRORS.has(error.message)) {
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
