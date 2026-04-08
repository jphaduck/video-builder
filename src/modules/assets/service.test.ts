import { beforeEach, describe, expect, it, vi } from "vitest";
import { getOpenAIClient } from "@/lib/ai";
import {
  deleteAssetCandidate,
  getAssetCandidatesForProject,
  getAssetCandidatesForScene,
  saveAssetCandidate,
  saveAssetImageFile,
} from "@/modules/assets/repository";
import {
  approveImagePlan,
  generateSceneImages,
  selectSceneImage,
} from "@/modules/assets/service";
import { deleteRenderJob } from "@/modules/rendering/repository";
import {
  getProjectById,
  replaceAssetCandidateIdsForProject,
  setProjectStatus,
} from "@/modules/projects/repository";
import { getScene, getScenesForProject } from "@/modules/scenes/repository";
import { deleteTimelineDraft } from "@/modules/timeline/repository";
import type { AssetCandidate } from "@/modules/assets/types";
import type { ProjectRecord, StoryDraftRecord } from "@/types/project";
import type { Scene } from "@/types/scene";

vi.mock("@/lib/ai", () => ({
  getOpenAIClient: vi.fn(),
}));

vi.mock("@/modules/assets/repository", () => ({
  deleteAssetCandidate: vi.fn(),
  getAssetCandidate: vi.fn(),
  getAssetCandidatesForProject: vi.fn(),
  getAssetCandidatesForScene: vi.fn(),
  saveAssetCandidate: vi.fn(),
  saveAssetImageFile: vi.fn(),
}));

vi.mock("@/modules/rendering/repository", () => ({
  deleteRenderJob: vi.fn(),
}));

vi.mock("@/modules/projects/repository", () => ({
  getProjectById: vi.fn(),
  replaceAssetCandidateIdsForProject: vi.fn(),
  setProjectStatus: vi.fn(),
}));

vi.mock("@/modules/scenes/repository", () => ({
  getScene: vi.fn(),
  getScenesForProject: vi.fn(),
}));

vi.mock("@/modules/timeline/repository", () => ({
  deleteTimelineDraft: vi.fn(),
}));

const mockedGetOpenAIClient = vi.mocked(getOpenAIClient);
const mockedDeleteAssetCandidate = vi.mocked(deleteAssetCandidate);
const mockedGetAssetCandidatesForProject = vi.mocked(getAssetCandidatesForProject);
const mockedGetAssetCandidatesForScene = vi.mocked(getAssetCandidatesForScene);
const mockedSaveAssetCandidate = vi.mocked(saveAssetCandidate);
const mockedSaveAssetImageFile = vi.mocked(saveAssetImageFile);
const mockedDeleteRenderJob = vi.mocked(deleteRenderJob);
const mockedGetProjectById = vi.mocked(getProjectById);
const mockedReplaceAssetCandidateIdsForProject = vi.mocked(replaceAssetCandidateIdsForProject);
const mockedSetProjectStatus = vi.mocked(setProjectStatus);
const mockedGetScene = vi.mocked(getScene);
const mockedGetScenesForProject = vi.mocked(getScenesForProject);
const mockedDeleteTimelineDraft = vi.mocked(deleteTimelineDraft);

function createDraft(overrides: Partial<StoryDraftRecord> = {}): StoryDraftRecord {
  return {
    id: "draft-1",
    createdAt: "2026-04-07T00:00:00.000Z",
    versionLabel: "v1",
    titleOptions: ["Title 1", "Title 2", "Title 3"],
    hook: "You hear the floorboards groan behind you.",
    fullNarrationDraft: "You pause at the threshold and listen for the next sound in the house.",
    approvalStatus: "approved",
    source: "generated",
    sceneOutline: [],
    ...overrides,
  };
}

function createProject(overrides: Partial<ProjectRecord> = {}): ProjectRecord {
  const approvedDraft = createDraft();

  return {
    id: "project-1",
    name: "Project One",
    status: "scene_ready",
    createdAt: "2026-04-07T00:00:00.000Z",
    updatedAt: "2026-04-07T00:00:00.000Z",
    storyInput: {
      premise: "A quiet town hides something wrong.",
      targetRuntimeMin: 10,
    },
    scriptDrafts: [approvedDraft],
    activeScriptDraftId: approvedDraft.id,
    approvedScriptDraftId: approvedDraft.id,
    latestScriptDraftId: approvedDraft.id,
    storyDraft: approvedDraft,
    workflow: {
      scriptDraftIds: [approvedDraft.id],
      sceneIds: ["scene-1", "scene-2"],
      assetIds: [],
      narrationTrackIds: [],
      captionTrackIds: [],
      renderJobIds: [],
    },
    ...overrides,
  };
}

function createScene(overrides: Partial<Scene> = {}): Scene {
  return {
    id: "scene-1",
    projectId: "project-1",
    approvedScriptDraftId: "draft-1",
    sceneNumber: 1,
    heading: "Threshold",
    scriptExcerpt: "You pause at the threshold.",
    sceneSummary: "The narrator establishes a tense threshold moment.",
    durationTargetSeconds: 18,
    visualIntent: "Make the viewer feel watched and boxed in by the doorway.",
    imagePrompt:
      "An empty hallway lit by a weak lamp spilling from the next room, painterly realism, desaturated palette, claustrophobic framing.",
    promptVersion: 2,
    approvalStatus: "approved",
    source: "generated",
    createdAt: "2026-04-07T00:00:00.000Z",
    updatedAt: "2026-04-07T00:00:00.000Z",
    ...overrides,
  };
}

function createAssetCandidate(overrides: Partial<AssetCandidate> = {}): AssetCandidate {
  return {
    id: "asset-1",
    projectId: "project-1",
    sceneId: "scene-1",
    sceneNumber: 1,
    candidateIndex: 1,
    imagePrompt: createScene().imagePrompt,
    promptVersion: 2,
    provider: "openai",
    imageFilePath: "data/assets/asset-1.png",
    selected: false,
    approvalStatus: "pending",
    createdAt: "2026-04-07T00:00:00.000Z",
    updatedAt: "2026-04-07T00:00:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();

  mockedGetOpenAIClient.mockReturnValue({
    images: {
      generate: vi.fn().mockResolvedValue({
        data: [
          { b64_json: Buffer.from("image-one").toString("base64") },
          { b64_json: Buffer.from("image-two").toString("base64") },
        ],
      }),
    },
  } as never);
  mockedGetProjectById.mockResolvedValue(createProject());
  mockedGetScene.mockResolvedValue(createScene());
  mockedGetScenesForProject.mockResolvedValue([
    createScene({ id: "scene-1", sceneNumber: 1 }),
    createScene({ id: "scene-2", sceneNumber: 2, heading: "Reveal" }),
  ]);
  mockedGetAssetCandidatesForScene.mockResolvedValue([]);
  mockedGetAssetCandidatesForProject.mockResolvedValue([]);
  mockedSaveAssetCandidate.mockResolvedValue();
  mockedSaveAssetImageFile
    .mockResolvedValueOnce("data/assets/generated-1.png")
    .mockResolvedValueOnce("data/assets/generated-2.png");
  mockedReplaceAssetCandidateIdsForProject.mockResolvedValue(createProject());
  mockedSetProjectStatus.mockResolvedValue(createProject());
  mockedDeleteAssetCandidate.mockResolvedValue();
  mockedDeleteTimelineDraft.mockResolvedValue();
  mockedDeleteRenderJob.mockResolvedValue();
});

describe("generateSceneImages", () => {
  it("throws if the scene plan is not approved", async () => {
    mockedGetScenesForProject.mockResolvedValue([
      createScene({ id: "scene-1", approvalStatus: "approved" }),
      createScene({ id: "scene-2", sceneNumber: 2, approvalStatus: "pending" }),
    ]);

    await expect(generateSceneImages("project-1", "scene-1", { numCandidates: 2 })).rejects.toThrow(
      "Image generation requires an approved scene plan.",
    );
  });

  it("throws if the scene plan has not been explicitly approved yet", async () => {
    mockedGetProjectById.mockResolvedValue(createProject({ status: "scene_planning" }));
    mockedGetScenesForProject.mockResolvedValue([
      createScene({ id: "scene-1", approvalStatus: "approved" }),
      createScene({ id: "scene-2", sceneNumber: 2, approvalStatus: "approved" }),
    ]);

    await expect(generateSceneImages("project-1", "scene-1", { numCandidates: 2 })).rejects.toThrow(
      "Image generation requires an approved scene plan.",
    );
  });

  it("throws if the scene itself is not approved", async () => {
    mockedGetScene.mockResolvedValue(createScene({ approvalStatus: "rejected" }));

    await expect(generateSceneImages("project-1", "scene-1", { numCandidates: 2 })).rejects.toThrow(
      "Image generation is only available for approved scenes.",
    );
  });

  it("persists generated candidates and their image files", async () => {
    const candidates = await generateSceneImages("project-1", "scene-1", { numCandidates: 2 });

    expect(candidates).toHaveLength(2);
    expect(candidates[0]).toMatchObject({
      projectId: "project-1",
      sceneId: "scene-1",
      sceneNumber: 1,
      candidateIndex: 1,
      imagePrompt: createScene().imagePrompt,
      promptVersion: 2,
      provider: "openai",
      imageFilePath: "data/assets/generated-1.png",
      selected: false,
      approvalStatus: "pending",
    });
    expect(mockedSaveAssetImageFile).toHaveBeenCalledTimes(2);
    expect(mockedSaveAssetCandidate).toHaveBeenCalledTimes(2);
    expect(mockedReplaceAssetCandidateIdsForProject).toHaveBeenCalledWith(
      "project-1",
      [],
      expect.arrayContaining([expect.any(String), expect.any(String)]),
      "scene_ready",
    );
  });
});

describe("selectSceneImage", () => {
  it("enforces a single selected candidate per scene", async () => {
    const firstCandidate = createAssetCandidate({
      id: "asset-1",
      selected: true,
      approvalStatus: "approved",
    });
    const secondCandidate = createAssetCandidate({
      id: "asset-2",
      candidateIndex: 2,
      imageFilePath: "data/assets/asset-2.png",
    });

    mockedGetAssetCandidatesForScene.mockResolvedValue([firstCandidate, secondCandidate]);
    mockedSaveAssetCandidate.mockResolvedValue();

    const updatedCandidates = await selectSceneImage("scene-1", "asset-2");

    expect(updatedCandidates).toEqual([
      expect.objectContaining({
        id: "asset-1",
        selected: false,
        approvalStatus: "pending",
      }),
      expect.objectContaining({
        id: "asset-2",
        selected: true,
        approvalStatus: "pending",
      }),
    ]);
    expect(mockedSaveAssetCandidate).toHaveBeenCalledTimes(2);
    expect(mockedDeleteTimelineDraft).toHaveBeenCalledWith("project-1");
    expect(mockedSetProjectStatus).toHaveBeenCalledWith("project-1", "scene_ready", {
      clearRenderJobIds: true,
      imagePlanApprovedAt: null,
    });
  });

  it("throws if the scene no longer belongs to an approved scene plan", async () => {
    const selectedCandidate = createAssetCandidate({
      id: "asset-1",
      selected: true,
      approvalStatus: "approved",
    });
    const unselectedCandidate = createAssetCandidate({
      id: "asset-2",
      candidateIndex: 2,
      imageFilePath: "data/assets/asset-2.png",
    });

    mockedGetProjectById.mockResolvedValue(createProject({ status: "script_ready" }));
    mockedGetAssetCandidatesForScene.mockResolvedValue([selectedCandidate, unselectedCandidate]);

    await expect(selectSceneImage("scene-1", "asset-2")).rejects.toThrow(
      "Asset review requires the scene to remain in the approved scene plan.",
    );
    expect(mockedSaveAssetCandidate).not.toHaveBeenCalled();
    expect(mockedDeleteTimelineDraft).not.toHaveBeenCalled();
  });

  it("treats re-selecting the current candidate as a no-op", async () => {
    const selectedCandidate = createAssetCandidate({
      id: "asset-1",
      selected: true,
      approvalStatus: "approved",
    });
    const unselectedCandidate = createAssetCandidate({
      id: "asset-2",
      candidateIndex: 2,
      imageFilePath: "data/assets/asset-2.png",
    });

    mockedGetAssetCandidatesForScene.mockResolvedValue([selectedCandidate, unselectedCandidate]);

    const updatedCandidates = await selectSceneImage("scene-1", "asset-1");

    expect(updatedCandidates).toEqual([selectedCandidate, unselectedCandidate]);
    expect(mockedSaveAssetCandidate).not.toHaveBeenCalled();
    expect(mockedDeleteTimelineDraft).not.toHaveBeenCalled();
    expect(mockedDeleteRenderJob).not.toHaveBeenCalled();
    expect(mockedSetProjectStatus).not.toHaveBeenCalled();
  });
});

describe("approveImagePlan", () => {
  it("does not mark the project images_ready until every scene has an approved selected image", async () => {
    mockedGetAssetCandidatesForProject.mockResolvedValue([
      createAssetCandidate({
        id: "asset-1",
        sceneId: "scene-1",
        selected: true,
        approvalStatus: "approved",
      }),
      createAssetCandidate({
        id: "asset-2",
        sceneId: "scene-2",
        sceneNumber: 2,
        selected: false,
        approvalStatus: "pending",
      }),
    ]);

    await expect(approveImagePlan("project-1")).rejects.toThrow(
      "Every approved scene must have one selected and approved image before the image plan can be approved.",
    );
    expect(mockedSetProjectStatus).not.toHaveBeenCalled();
  });

  it("marks the project images_ready once every scene has an approved selected image", async () => {
    mockedGetAssetCandidatesForProject.mockResolvedValue([
      createAssetCandidate({
        id: "asset-1",
        sceneId: "scene-1",
        selected: true,
        approvalStatus: "approved",
      }),
      createAssetCandidate({
        id: "asset-2",
        sceneId: "scene-2",
        sceneNumber: 2,
        selected: true,
        approvalStatus: "approved",
      }),
    ]);

    await expect(approveImagePlan("project-1")).resolves.toBeUndefined();
    expect(mockedSetProjectStatus).toHaveBeenCalledWith(
      "project-1",
      "images_ready",
      expect.objectContaining({
        imagePlanApprovedAt: expect.any(String),
      }),
    );
  });

  it("preserves a downstream project status when narration already exists", async () => {
    mockedGetProjectById.mockResolvedValue(createProject({ status: "voice_ready" }));
    mockedGetAssetCandidatesForProject.mockResolvedValue([
      createAssetCandidate({
        id: "asset-1",
        sceneId: "scene-1",
        selected: true,
        approvalStatus: "approved",
      }),
      createAssetCandidate({
        id: "asset-2",
        sceneId: "scene-2",
        sceneNumber: 2,
        selected: true,
        approvalStatus: "approved",
      }),
    ]);

    await expect(approveImagePlan("project-1")).resolves.toBeUndefined();
    expect(mockedSetProjectStatus).toHaveBeenCalledWith(
      "project-1",
      "voice_ready",
      expect.objectContaining({
        imagePlanApprovedAt: expect.any(String),
      }),
    );
  });
});
