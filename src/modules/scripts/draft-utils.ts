import type { GeneratedStoryDraft } from "@/modules/scripts/types";

export function countWords(value: string): number {
  return value.split(/\s+/).filter(Boolean).length;
}

const HEADING_STOPWORDS = new Set([
  "a",
  "about",
  "after",
  "all",
  "an",
  "and",
  "as",
  "at",
  "before",
  "but",
  "by",
  "for",
  "from",
  "in",
  "into",
  "of",
  "on",
  "or",
  "the",
  "through",
  "to",
  "with",
  "you",
  "your",
]);

function getNarrativeParagraphs(script: string): string[] {
  return script
    .split(/\n{2,}/)
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function mergeShortParagraphs(paragraphs: string[]): string[] {
  return paragraphs.reduce<string[]>((mergedParagraphs, paragraph) => {
    const wordCount = countWords(paragraph);
    if (wordCount >= 12 || mergedParagraphs.length === 0) {
      mergedParagraphs.push(paragraph);
      return mergedParagraphs;
    }

    mergedParagraphs[mergedParagraphs.length - 1] = `${mergedParagraphs.at(-1)} ${paragraph}`.trim();
    return mergedParagraphs;
  }, []);
}

function toTitleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      if (word === word.toUpperCase()) {
        return word;
      }

      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

function buildHeadingFromText(text: string, index: number): string {
  const firstSentence = text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .find(Boolean);

  if (!firstSentence) {
    return `Scene ${index + 1}`;
  }

  const keywords = firstSentence
    .replace(/[^a-zA-Z0-9'\s-]/g, " ")
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length >= 3)
    .filter((word) => !HEADING_STOPWORDS.has(word.toLowerCase()));

  if (keywords.length === 0) {
    return `Scene ${index + 1}`;
  }

  return toTitleCase(keywords.slice(0, 4).join(" "));
}

export function buildSceneOutline(script: string): GeneratedStoryDraft["sceneOutline"] {
  const paragraphs = mergeShortParagraphs(getNarrativeParagraphs(script));

  if (paragraphs.length === 0) {
    return [];
  }

  const paragraphsPerScene = Math.max(1, Math.ceil(paragraphs.length / 12));
  const sceneChunks = Array.from({ length: Math.ceil(paragraphs.length / paragraphsPerScene) }, (_, index) =>
    paragraphs.slice(index * paragraphsPerScene, (index + 1) * paragraphsPerScene),
  );

  return sceneChunks.slice(0, 12).map((chunk, index) => ({
    sceneNumber: index + 1,
    heading: buildHeadingFromText(chunk[0] ?? "", index),
    summary: chunk.join(" ").slice(0, 240),
  }));
}

export function parseTitleOptionsText(value: string): string[] {
  return value
    .split(/\n+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function serializeTitleOptions(titleOptions: string[]): string {
  return titleOptions.join("\n");
}
