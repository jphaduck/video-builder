import { beforeEach, describe, expect, it, vi } from "vitest";
import { getProjectById, addAssetCandidateIdsToProject } from "@/modules/projects/repository";
import { getAssetCandidatesForProject, saveAssetCandidate } from "@/modules/assets/repository";
import { ensureAssetCandidatesForScene } from "@/modules/assets/service";
import type { ProjectRecord, StoryDraftRecord } from "@/types/project";
import type { Scene } from "@/types/scene";

vi.mock("@/modules/projects/repository", () => ({
  getProjectById: vi.fn(),
  addAssetCandidateIdsToProject: vi.fn(),
}));

vi.mock("@/modules/assets/repository", () => ({
  getAssetCandidatesForProject: vi.fn(),
  saveAssetCandidate: vi.fn(),
}));

const mockedGetProjectById = vi.mocked(getProjectById);
const mockedAddAssetCandidateIdsToProject = vi.mocked(addAssetCandidateIdsToProject);
const mockedGetAssetCandidatesForProject = vi.mocked(getAssetCandidatesForProject);
const mockedSaveAssetCandidate = vi.mocked(saveAssetCandidate);

function createDraft(overrides: Partial<StoryDraftRecord> = {}): StoryDraftRecord {
  return {
    id: "draft-1",
    createdAt: "2026-04-07T00:00:00.000Z",
    versionLabel: "v1",
    titleOptions: ["Title 1", "Title 2", "Title 3"],
    hook: "You hear the door click shut behind you.",
    fullNarrationDraft: "You step into a silent hallway and feel the air change around you.",
    approvalStatus: "approved",
    source: "generated",
    sceneOutline: [],
    ...overrides,
  };
}

function createProject(overrides: Partial<ProjectRecord> = {}): ProjectRecord {
  const draft = createDraft();

  return {
    id: "project-1",
    name: "Project One",
    status: "scene_ready",
    createdAt: "2026-04-07T00:00:00.000Z",
    updatedAt: "2026-04-07T00:00:00.000Z",
    storyInput: { premise: "A quiet town hides something wrong.", targetRuntimeMin: 10 },
    scriptDrafts: [draft],
    activeScriptDraftId: draft.id,
    approvedScriptDraftId: draft.id,
    latestScriptDraftId: draft.id,
    storyDraft: draft,
    workflow: {
      scriptDraftIds: [draft.id],
      sceneIds: ["scene-1"],
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
    sceneSummary: "The narrator establishes tension.",
    durationTargetSeconds: 18,
    visualIntent: "Make the viewer feel watched.",
    imagePrompt: "A narrow hallway with practical lamp light and heavy shadow texture.",
    promptVersion: 1,
    approvalStatus: "approved",
    source: "generated",
    createdAt: "2026-04-07T00:00:00.000Z",
    updatedAt: "2026-04-07T00:00:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedGetProjectById.mockResolvedValue(createProject());
  mockedGetAssetCandidatesForProject.mockResolvedValue([]);
  mockedSaveAssetCandidate.mockResolvedValue();
  mockedAddAssetCandidateIdsToProject.mockResolvedValue(createProject());
});

describe("ensureAssetCandidatesForScene", () => {
  it("creates three asset candidates the first time a scene is approved", async () => {
    const candidates = await ensureAssetCandidatesForScene(createScene());

    expect(candidates).toHaveLength(3);
    expect(mockedSaveAssetCandidate).toHaveBeenCalledTimes(3);
    expect(mockedAddAssetCandidateIdsToProject).toHaveBeenCalledWith(
      "project-1",
      expect.arrayContaining([expect.any(String), expect.any(String), expect.any(String)]),
    );
  });

  it("reuses existing candidates instead of duplicating them", async () => {
    mockedGetAssetCandidatesForProject.mockResolvedValue([
      {
        id: "asset-1",
        projectId: "project-1",
        sceneId: "scene-1",
        sceneNumber: 1,
        candidateIndex: 1,
        prompt: "Prompt",
        source: "scene_approval",
        status: "pending",
        createdAt: "2026-04-07T00:00:00.000Z",
        updatedAt: "2026-04-07T00:00:00.000Z",
      },
    ]);

    const candidates = await ensureAssetCandidatesForScene(createScene());

    expect(candidates).toHaveLength(1);
    expect(mockedSaveAssetCandidate).not.toHaveBeenCalled();
    expect(mockedAddAssetCandidateIdsToProject).not.toHaveBeenCalled();
  });
});
