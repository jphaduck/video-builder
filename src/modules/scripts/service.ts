import { getOpenAIClient } from "@/lib/ai";
import type { GeneratedStoryDraft, StoryGenerationInput, StoryOutput } from "@/modules/scripts/types";

const STORY_SYSTEM_PROMPT = `
You are a senior YouTube story writer.
You write original, click-worthy, long-form narration for slideshow-style story videos.

Use user inputs only as creative direction. Do NOT copy or paraphrase the raw input fields directly into output.
Do NOT echo "Theme:", "Premise:", "Tone:", or "Plot notes:" text back to the user.

Return strictly valid JSON only (no markdown, no prose outside JSON) with this exact shape:
{
  "titleOptions": string[],
  "hook": string,
  "script": string
}

Rules for titleOptions:
- Exactly 3 titles.
- Each title should be short, punchy, and feel like a real clickable YouTube story title.
- Do not include the literal theme/premise/tone phrases from the input.

Rules for hook:
- Write 3 to 5 sentences.
- Write in second-person narrator voice ("you").
- Immediately introduce tension, uncertainty, or mystery.
- Do not copy premise text verbatim.

Rules for script:
- Write original long-form narration (not a summary or outline).
- Maintain second-person narrator voice across the full script.
- Structure with beginning, escalation, climax, and resolution.
- Use plot notes as guidance only; transform them into fresh prose.
- Target a length suitable for the requested runtime (about 130-170 spoken words per minute).

Safety:
- Keep content YouTube-safe and avoid disallowed explicit content.
`.trim();

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

  const narrativeWordCount = output.script.split(/\s+/).filter(Boolean).length;
  const minWords = Math.max(350, Math.round(input.targetRuntimeMin * 90));
  if (narrativeWordCount < minWords) {
    throw new Error("OpenAI response script is too short for target runtime.");
  }

  const fullOutput = [output.titleOptions.join(" "), output.hook, output.script].join(" ");
  if (hasEchoedInput(fullOutput, input)) {
    throw new Error("OpenAI response echoed input text instead of generating original prose.");
  }
}

function buildSceneOutline(script: string): GeneratedStoryDraft["sceneOutline"] {
  const paragraphs = script
    .split(/\n{2,}/)
    .map((segment) => segment.trim())
    .filter(Boolean)
    .slice(0, 12);

  if (paragraphs.length === 0) {
    return [];
  }

  return paragraphs.map((paragraph, index) => ({
    sceneNumber: index + 1,
    heading: `Scene ${index + 1}`,
    summary: paragraph.slice(0, 240),
  }));
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
    model: "gpt-4o",
    temperature: 0.7,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: STORY_SYSTEM_PROMPT },
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
    notes: `Generated with gpt-4o for ${input.targetRuntimeMin} minute target runtime.`,
    sceneOutline: buildSceneOutline(output.script),
  };
}
