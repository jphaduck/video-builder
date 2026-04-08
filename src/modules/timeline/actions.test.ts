import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TimelineDraft } from "@/modules/timeline/types";

const mockedRevalidatePath = vi.fn();
const mockedBuildTimelineDraft = vi.fn();
const mockedSetProjectStatus = vi.fn();

vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => mockedRevalidatePath(...args),
}));

vi.mock("@/modules/timeline/service", () => ({
  buildTimelineDraft: (...args: unknown[]) => mockedBuildTimelineDraft(...args),
}));

vi.mock("@/modules/projects/repository", () => ({
  setProjectStatus: (...args: unknown[]) => mockedSetProjectStatus(...args),
}));

function createTimelineDraft(): TimelineDraft {
  const now = new Date().toISOString();
  return {
    id: "timeline-1",
    projectId: "project-1",
    scenes: [],
    assets: [],
    narrationTrack: {
      id: "narration-1",
      projectId: "project-1",
      approvedScriptDraftId: "draft-1",
      approvedScenePlanId: "scene-plan-1",
      voiceName: "onyx",
      provider: "openai",
      speed: 1,
      style: null,
      pronunciationOverrides: {},
      scenes: [],
      totalDurationSeconds: 0,
      approvalStatus: "approved",
      source: "generated",
      createdAt: now,
      updatedAt: now,
    },
    captionTrack: {
      id: "caption-1",
      projectId: "project-1",
      narrationTrackId: "narration-1",
      language: "en",
      source: "whisper",
      isStale: false,
      segments: [],
      createdAt: now,
      updatedAt: now,
    },
    createdAt: now,
    updatedAt: now,
  };
}

describe("buildTimelineForProjectAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedSetProjectStatus.mockResolvedValue(undefined);
  });

  it("builds the timeline, marks the project timeline_ready, and revalidates the page", async () => {
    const draft = createTimelineDraft();
    mockedBuildTimelineDraft.mockResolvedValue(draft);

    const { buildTimelineForProjectAction } = await import("@/modules/timeline/actions");
    const result = await buildTimelineForProjectAction("project-1");

    expect(result).toEqual({ ok: true, data: draft });
    expect(mockedBuildTimelineDraft).toHaveBeenCalledWith("project-1");
    expect(mockedSetProjectStatus).toHaveBeenCalledWith("project-1", "timeline_ready", { clearRenderJobIds: true });
    expect(mockedRevalidatePath).toHaveBeenCalledWith("/projects/project-1");
  });

  it("returns a typed error when timeline building fails", async () => {
    mockedBuildTimelineDraft.mockRejectedValue(new Error("Timeline draft requires narration and captions."));

    const { buildTimelineForProjectAction } = await import("@/modules/timeline/actions");
    const result = await buildTimelineForProjectAction("project-1");

    expect(result).toEqual({
      ok: false,
      error: "Timeline draft requires narration and captions.",
    });
    expect(mockedSetProjectStatus).not.toHaveBeenCalled();
  });
});
