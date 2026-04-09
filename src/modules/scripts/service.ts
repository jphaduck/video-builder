import { STORY_DRAFT_PROMPT, getPromptMeta } from "@/lib/prompts";
import { getOpenAIClient } from "@/lib/ai";
import { buildSceneOutline, countWords } from "@/modules/scripts/draft-utils";
import type { GeneratedStoryDraft, StoryGenerationInput, StoryOutput } from "@/modules/scripts/types";

const BEAT_OUTLINE_SYSTEM_PROMPT = `
You are a story structure editor. Produce a numbered beat outline only.
Each beat must be one sentence.
Cover the story from opening to close.
Use the plot notes as your source.
Do not write narration.
Each beat must identify who is involved, what is happening, and what is at stake.
Keep the beats chronological.
`.trim();
const SHORT_SCRIPT_ERROR = "OpenAI response script is too short for target runtime.";
const RETRY_SHORT_SCRIPT_ERROR = "Retry draft is still too short for target runtime.";
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

function getTargetBeatCount(input: StoryGenerationInput): number {
  return Math.min(20, Math.max(12, input.targetRuntimeMin * 2));
}

function getMinimumNarrativeWordCount(input: StoryGenerationInput): number {
  return Math.max(650, input.targetRuntimeMin * 130);
}

function getMinimumParagraphCount(input: StoryGenerationInput): number {
  return Math.max(8, Math.ceil(input.targetRuntimeMin * 1.2));
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

function parseBeatOutline(content: string): string[] {
  const numberedLines = content
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => /^\d+[\.\)]\s+/.test(line));

  if (numberedLines.length === 0) {
    throw new Error("Beat outline could not be parsed. Generation aborted.");
  }

  const beats = numberedLines
    .map((line) => line.replace(/^\d+[\.\)]\s+/, "").trim())
    .filter(Boolean);

  if (beats.length < 8) {
    throw new Error(`Beat outline returned too few beats (${beats.length}). Generation aborted.`);
  }

  return beats;
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
  options?: { minimumWordCount?: number; minimumParagraphCount?: number; beatOutline?: string[] },
): string {
  const minimumWordCount = options?.minimumWordCount ?? getMinimumNarrativeWordCount(input);
  const minimumParagraphCount = options?.minimumParagraphCount ?? getMinimumParagraphCount(input);
  const beatOutlineSection = options?.beatOutline?.length
    ? `
Beat outline:
${options.beatOutline.map((beat, index) => `${index + 1}. ${beat}`).join("\n")}
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
- Use the beat outline below as the structural plan for the full narration.
- Preserve the major beats from the notes in order.
- Each major beat should occupy its own paragraph.
- Do not merge multiple distinct beats into one paragraph unless they happen simultaneously.
- Do not skip any beat from the notes.
- Write one paragraph per beat minimum.
- Do not skip any beat.
- Do not merge more than two closely related beats into one paragraph.
- Expand those beats into full narration with scene-level detail, transitions, and internal reasoning.
- Do not compress multiple major beats into one paragraph.
- Spend real time in the middle of the story, not just the setup and ending.
- The minimum word count is a floor, not the finish line. Do not stop just because you crossed it.
- Keep expanding until the middle feels developed and the ending feels emotionally complete.

${beatOutlineSection}
`.trim();
}

function buildExpansionPrompt(
  input: StoryGenerationInput,
  beatOutline: string[],
  previousFailure: string,
): string {
  const minimumWordCount = getMinimumNarrativeWordCount(input);
  const minimumParagraphCount = getMinimumParagraphCount(input);
  const interiorBeats = beatOutline
    .map((beat, index) => ({ beat, index: index + 1 }))
    .slice(2, Math.max(beatOutline.length - 2, 3));
  const targetedBeats = (() => {
    if (interiorBeats.length <= 3) {
      return interiorBeats;
    }

    const selected = [
      interiorBeats[0],
      interiorBeats[Math.floor(interiorBeats.length / 2)],
      interiorBeats[interiorBeats.length - 1],
    ].filter((entry, index, array) => array.findIndex((candidate) => candidate.index === entry.index) === index);

    return selected.slice(0, 3);
  })();
  const targetedBeatSection = targetedBeats.length
    ? `Focus on these likely underdeveloped beats from the outline:
${targetedBeats.map((entry) => `- Beat ${entry.index}: ${entry.beat}`).join("\n")}`
    : "";
  const middleBeatSection = targetedBeats.length
    ? `Middle beats that need more space:
${targetedBeats.map((entry) => `- Beat ${entry.index}: ${entry.beat}`).join("\n")}`
    : "";
  const endingBeatStartIndex = Math.max(beatOutline.length - 1, 1);
  const endingBeatCandidates = beatOutline
    .slice(-2)
    .map((beat, index) => ({ beat, index: endingBeatStartIndex + index }));
  const endingBeatSection = endingBeatCandidates.length
    ? `Ending beats that must land fully:
${endingBeatCandidates.map((entry) => `- Beat ${entry.index}: ${entry.beat}`).join("\n")}`
    : "";

  return `
This draft is not yet long enough. You must expand it significantly.
It failed validation because: ${previousFailure}
Do not rewrite it from scratch. Follow these exact steps:

1. Find the three beats in the outline that received the least coverage in the draft above — the places where you wrote one short sentence instead of a full paragraph.

2. For each of those three beats, write one entirely new paragraph that fully develops that beat: what specifically happened, what was at stake, what was felt or decided, and what changed as a result. Each new paragraph must be at least 80 words.

3. Insert each new paragraph into the draft at the correct chronological position — do not append them all to the end.

4. Expand the ending by at least one additional paragraph of quiet reflection. Do not restate events — show the weight of the outcome.

5. Return the complete expanded draft in the same JSON format as before. The final script must be at least ${minimumWordCount} words and at least ${minimumParagraphCount} paragraphs. Do not stop before reaching both targets.

${targetedBeatSection}
${targetedBeatSection && middleBeatSection ? "\n\n" : ""}${middleBeatSection}
${(targetedBeatSection || middleBeatSection) && endingBeatSection ? "\n\n" : ""}${endingBeatSection}

Keep the opening paragraph exactly as written.
Add at least 2 entirely new middle paragraphs tied to 2 distinct middle beats from the outline.
Add at least 1 entirely new ending paragraph tied to one of the final beats from the outline so the ending fully lands.
Give each major plot beat its own paragraph - do not merge beats.
Deepen procedural detail, internal decision-making, and environmental atmosphere in the escalation and attrition sections.
For quieter, procedural, or bureaucratic stories, treat paperwork, waiting, compliance pressure, professional isolation, and the lived consequences of each choice as real story beats rather than background exposition.
If the story's tension comes from institutions instead of pursuit, expand the delays, records, meetings, official language, and private consequences that make the pressure feel inescapable.
If a beat is already mentioned briefly, expand it with new detail and consequences instead of repeating the same sentence in different words.
Preserve the strongest title ideas, but ensure every title is complete and publication-ready.
Target: at least ${minimumWordCount} words and ${minimumParagraphCount} paragraphs.
`.trim();
}

function buildExpansionDraftText(previousOutput: StoryOutput): string {
  return `
Title options:
${previousOutput.titleOptions.map((title) => `- ${title}`).join("\n")}

Hook:
${previousOutput.hook}

Script:
${previousOutput.script}
`.trim();
}

function buildBeatOutlinePrompt(input: StoryGenerationInput): string {
  return `
Project name: ${formatPromptValue(input.projectName)}
Theme: ${formatPromptValue(input.theme)}
Premise: ${formatPromptValue(input.premise)}
Plot notes: ${formatPromptValue(input.plotNotes)}
Tone: ${formatPromptValue(input.tone)}
Target runtime (minutes): ${input.targetRuntimeMin}
Target beat count: ${getTargetBeatCount(input)}

Instructions:
- Produce a numbered list only.
- Use 12 to 20 beats.
- Keep the beats chronological from opening to close.
- Use the plot notes as your source of truth when they are present.
- Each beat must be exactly one sentence.
- Each beat should make clear who is involved, what is happening, and what is at stake.
- Do not write narration prose.
`.trim();
}

export async function generateBeatOutline(input: StoryGenerationInput): Promise<string[]> {
  const openai = getOpenAIClient();

  const response = await openai.chat.completions.create({
    model: STORY_DRAFT_PROMPT.model,
    temperature: 0.4,
    messages: [
      { role: "system", content: BEAT_OUTLINE_SYSTEM_PROMPT },
      { role: "user", content: buildBeatOutlinePrompt(input) },
    ],
  });

  const content = response.choices[0]?.message?.content?.trim();
  if (!content) {
    throw new Error("OpenAI returned an empty beat outline response.");
  }

  return parseBeatOutline(content);
}

async function requestStoryOutput(
  input: StoryGenerationInput,
  beatOutline: string[],
): Promise<StoryOutput> {
  const openai = getOpenAIClient();

  const response = await openai.chat.completions.create({
    model: STORY_DRAFT_PROMPT.model,
    temperature: STORY_DRAFT_PROMPT.temperature,
    max_tokens: 3000,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: STORY_DRAFT_PROMPT.systemPrompt },
      {
        role: "user",
        content: buildUserPrompt(input, {
          minimumWordCount: getMinimumNarrativeWordCount(input),
          minimumParagraphCount: getMinimumParagraphCount(input),
          beatOutline,
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

async function requestExpandedStoryOutput(
  input: StoryGenerationInput,
  beatOutline: string[],
  previousOutput: StoryOutput,
  previousFailure: string,
): Promise<StoryOutput> {
  const openai = getOpenAIClient();

  const response = await openai.chat.completions.create({
    model: STORY_DRAFT_PROMPT.model,
    temperature: STORY_DRAFT_PROMPT.temperature,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: STORY_DRAFT_PROMPT.systemPrompt,
      },
      {
        role: "user",
        content: buildUserPrompt(input, {
          minimumWordCount: getMinimumNarrativeWordCount(input),
          minimumParagraphCount: getMinimumParagraphCount(input),
          beatOutline,
        }),
      },
      {
        role: "assistant",
        content: buildExpansionDraftText(previousOutput),
      },
      {
        role: "user",
        content: buildExpansionPrompt(input, beatOutline, previousFailure),
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
  const beatOutline = await generateBeatOutline(input);
  let output = await requestStoryOutput(input, beatOutline);

  try {
    validateCreativeOutput(output, input);
  } catch (error) {
    if (!(error instanceof Error) || !RETRYABLE_STORY_ERRORS.has(error.message)) {
      throw error;
    }

    output = await requestExpandedStoryOutput(input, beatOutline, output, error.message);

    try {
      validateCreativeOutput(output, input);
    } catch (retryError) {
      if (retryError instanceof Error && retryError.message === SHORT_SCRIPT_ERROR) {
        throw new Error(RETRY_SHORT_SCRIPT_ERROR);
      }

      throw retryError;
    }
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
