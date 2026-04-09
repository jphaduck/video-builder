import { beforeEach, describe, expect, it, vi } from "vitest";
import { getAssetCandidatesForProject } from "@/modules/assets/repository";
import { getCaptionTrack } from "@/modules/captions/repository";
import { getNarrationTrack } from "@/modules/narration/repository";
import { getProjectById } from "@/modules/projects/repository";
import { getScenesForProject } from "@/modules/scenes/repository";
import { saveTimelineDraft } from "@/modules/timeline/repository";

vi.mock("@/modules/assets/repository", () => ({ getAssetCandidatesForProject: vi.fn() }));
vi.mock("@/modules/captions/repository", () => ({ getCaptionTrack: vi.fn() }));
vi.mock("@/modules/narration/repository", () => ({ getNarrationTrack: vi.fn() }));
vi.mock("@/modules/projects/repository", () => ({ getProjectById: vi.fn() }));
vi.mock("@/modules/scenes/repository", () => ({ getScenesForProject: vi.fn() }));
vi.mock("@/modules/timeline/repository", () => ({ getTimelineDraft: vi.fn(), saveTimelineDraft: vi.fn() }));

const mockedGetAssetCandidatesForProject = vi.mocked(getAssetCandidatesForProject);
const mockedGetCaptionTrack = vi.mocked(getCaptionTrack);
const mockedGetNarrationTrack = vi.mocked(getNarrationTrack);
const mockedGetProjectById = vi.mocked(getProjectById);
const mockedGetScenesForProject = vi.mocked(getScenesForProject);
const mockedSaveTimelineDraft = vi.mocked(saveTimelineDraft);

beforeEach(() => {
  vi.clearAllMocks();
  mockedGetProjectById.mockResolvedValue({
    id: "project-1",
    workflow: { narrationTrackIds: ["track-1"], captionTrackIds: ["caption-1"] },
  } as never);
  mockedGetScenesForProject.mockResolvedValue([{ id: "scene-1", sceneNumber: 1, heading: "Opening" }] as never);
  mockedGetAssetCandidatesForProject.mockResolvedValue([{ id: "asset-1", sceneId: "scene-1" }] as never);
  mockedGetNarrationTrack.mockResolvedValue({ id: "track-1", scenes: [], approvalStatus: "approved" } as never);
  mockedGetCaptionTrack.mockResolvedValue({ id: "caption-1", segments: [] } as never);
  mockedSaveTimelineDraft.mockResolvedValue();
});

describe("buildTimelineDraft", () => {
  it("assembles scenes, assets, narration, and captions into a saved draft", async () => {
    const { buildTimelineDraft } = await import("@/modules/timeline/service");
    const draft = await buildTimelineDraft("project-1");

    expect(draft.projectId).toBe("project-1");
    expect(draft.scenes).toHaveLength(1);
    expect(draft.assets).toHaveLength(1);
    expect(draft.narrationTrack.id).toBe("track-1");
    expect(draft.captionTrack.id).toBe("caption-1");
    expect(mockedSaveTimelineDraft).toHaveBeenCalledWith(draft);
  });

  it("throws when the latest narration or caption track is missing", async () => {
    mockedGetNarrationTrack.mockResolvedValue(null);

    const { buildTimelineDraft } = await import("@/modules/timeline/service");

    await expect(buildTimelineDraft("project-1")).rejects.toThrow(
      "Timeline draft requires current narration and caption tracks.",
    );
    expect(mockedSaveTimelineDraft).not.toHaveBeenCalled();
  });
});
