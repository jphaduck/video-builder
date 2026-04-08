import type { CaptionSegment } from "@/types/caption";

function formatSrtTimestamp(milliseconds: number): string {
  const totalMilliseconds = Math.max(0, Math.round(milliseconds));
  const hours = Math.floor(totalMilliseconds / 3_600_000);
  const minutes = Math.floor((totalMilliseconds % 3_600_000) / 60_000);
  const seconds = Math.floor((totalMilliseconds % 60_000) / 1_000);
  const ms = totalMilliseconds % 1_000;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
}

export function captionSegmentsToSrt(segments: Array<Pick<CaptionSegment, "startMs" | "endMs" | "text">>): string {
  return segments
    .map((segment, index) => {
      const text = segment.text.trim();
      return `${index + 1}\n${formatSrtTimestamp(segment.startMs)} --> ${formatSrtTimestamp(segment.endMs)}\n${text}`;
    })
    .join("\n\n");
}
