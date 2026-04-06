import type { GeneratedSceneOutlineItem, GeneratedStoryDraft, StoryGenerationInput } from "@/modules/scripts/types";

function toSentenceCase(value: string): string {
  if (!value) {
    return value;
  }

  return value.charAt(0).toUpperCase() + value.slice(1);
}

function splitPlotBeats(plotNotes: string | undefined): string[] {
  if (!plotNotes) {
    return [];
  }

  return plotNotes
    .split(/\r?\n|,/)
    .map((beat) => beat.trim())
    .filter(Boolean)
    .slice(0, 6);
}

function estimateSceneCount(targetRuntimeMin: number): number {
  const estimated = Math.round(targetRuntimeMin * 0.8);
  return Math.min(12, Math.max(5, estimated));
}

function buildSceneOutline(input: StoryGenerationInput): GeneratedSceneOutlineItem[] {
  const sceneCount = estimateSceneCount(input.targetRuntimeMin);
  const beats = splitPlotBeats(input.plotNotes);

  return Array.from({ length: sceneCount }, (_, index) => {
    const sceneNumber = index + 1;
    const beat = beats[index % Math.max(1, beats.length)];
    const fallbackBeat =
      index === 0
        ? "Introduce the setup and emotional stakes."
        : index === sceneCount - 1
          ? "Deliver the resolution and lasting takeaway."
          : "Escalate tension with a concrete reveal.";

    return {
      sceneNumber,
      heading: `Scene ${sceneNumber}: ${toSentenceCase(input.theme || "Story progression")}`,
      summary: beat || fallbackBeat,
    };
  });
}

export function generateStoryDraft(input: StoryGenerationInput): GeneratedStoryDraft {
  const tone = input.tone || "cinematic";
  const theme = input.theme || "mystery";
  const sceneOutline = buildSceneOutline(input);

  const titleOptions = [
    `${toSentenceCase(theme)}: ${input.projectName}`,
    `The Hidden Truth Behind ${input.projectName}`,
    `${input.projectName} | A ${toSentenceCase(tone)} Story`,
  ];

  const hook = `What begins as ${input.premise.toLowerCase()} quickly turns into a ${tone} unraveling no one expects.`;

  const narrationDraft = [
    `Tonight's story explores ${theme} through the lens of ${input.premise}.`,
    `Over roughly ${input.targetRuntimeMin} minutes, we follow key turning points that slowly reframe what looked obvious at first.`,
    input.plotNotes
      ? `Core plot beats include: ${splitPlotBeats(input.plotNotes).join("; ")}.`
      : "As tension rises, each reveal adds pressure and reshapes the stakes.",
    "By the end, the audience should feel both emotional closure and a lingering question that keeps the story memorable.",
  ].join("\n\n");

  return {
    titleOptions,
    hook,
    narrationDraft,
    notes: `Generated from structured inputs (${input.targetRuntimeMin} min target, tone: ${tone}).`,
    sceneOutline,
  };
}
