import type { GeneratedStoryDraft } from "@/modules/scripts/types";

export function countWords(value: string): number {
  return value.split(/\s+/).filter(Boolean).length;
}

export function buildSceneOutline(script: string): GeneratedStoryDraft["sceneOutline"] {
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

export function parseTitleOptionsText(value: string): string[] {
  return value
    .split(/\n+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function serializeTitleOptions(titleOptions: string[]): string {
  return titleOptions.join("\n");
}
