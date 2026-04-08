import type { GeneratedStoryDraft } from "@/modules/scripts/types";

const TRAILING_HEADING_WORDS = new Set([
  "a",
  "an",
  "and",
  "at",
  "but",
  "by",
  "for",
  "from",
  "in",
  "into",
  "of",
  "on",
  "or",
  "so",
  "the",
  "through",
  "to",
  "with",
]);
const TRAILING_ORPHANED_HEADING_WORDS = new Set([
  "bare",
  "black",
  "blue",
  "cold",
  "dark",
  "dim",
  "empty",
  "faint",
  "gray",
  "grey",
  "quiet",
  "red",
  "silent",
  "small",
  "still",
  "thin",
  "weak",
  "white",
]);

export function countWords(value: string): number {
  return value.split(/\s+/).filter(Boolean).length;
}

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

function getWords(value: string): string[] {
  return value
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}

function getHeadingSourceText(text: string): string {
  const firstSentence = text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .find(Boolean);

  if (firstSentence) {
    const firstSentenceWords = getWords(firstSentence);
    if (firstSentenceWords.length >= 4) {
      return firstSentenceWords.slice(0, 8).join(" ");
    }
  }

  return getWords(text).slice(0, 8).join(" ");
}

function trimTrailingHeadingWords(words: string[]): string[] {
  const trimmedWords = [...words];

  while (trimmedWords.length > 0) {
    const trailingWord = trimmedWords.at(-1)?.toLowerCase();
    if (
      !trailingWord ||
      (!TRAILING_HEADING_WORDS.has(trailingWord) && !TRAILING_ORPHANED_HEADING_WORDS.has(trailingWord))
    ) {
      break;
    }

    trimmedWords.pop();
  }

  return trimmedWords.length >= 3 ? trimmedWords : words;
}

function buildHeadingFromText(text: string, index: number): string {
  const rawHeadingWords = getWords(getHeadingSourceText(text).replace(/[^a-zA-Z0-9'\s-]/g, " ")).slice(0, 8);
  const headingWords = trimTrailingHeadingWords(rawHeadingWords);
  const headingSource = headingWords.join(" ").trim();

  if (!headingSource) {
    return `Scene ${index + 1}`;
  }

  return toTitleCase(headingSource);
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
