import { describe, expect, it } from "vitest";
import { captionSegmentsToSrt } from "@/modules/captions/srt";

describe("captionSegmentsToSrt", () => {
  it("formats caption segments as numbered SRT blocks", () => {
    const result = captionSegmentsToSrt([
      { startMs: 0, endMs: 1500, text: "First sentence." },
      { startMs: 1500, endMs: 3200, text: "Second sentence." },
    ]);

    expect(result).toContain("1\n00:00:00,000 --> 00:00:01,500\nFirst sentence.");
    expect(result).toContain("2\n00:00:01,500 --> 00:00:03,200\nSecond sentence.");
  });
});
