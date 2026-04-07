import { beforeEach, describe, expect, it, vi } from "vitest";
import { getOpenAIClient } from "@/lib/ai";
import { measureMp3DurationSeconds } from "@/lib/mp3-duration";
import {
  approveNarrationTrackForProject,
  getProjectById,
  replaceNarrationTrackForProject,
  saveNarrationTrackForProject,
} from "@/modules/projects/repository";
import { getScenesForProject } from "@/modules/scenes/repository";
import { getCaptionTrack, saveCaptionTrack } from "@/modules/captions/repository";
import {
  deleteNarrationTrack,
  getNarrationTrack,
  saveNarrationTrack,
  saveSceneAudioFile,
} from "@/modules/narration/repository";
import {
  approveNarrationTrack,
  generateNarrationTrack,
  regenerateNarrationTrack,
} from "@/modules/narration/service";
import type { NarrationTrack } from "@/types/narration";
import type { ProjectRecord, StoryDraftRecord } from "@/types/project";
import type { Scene } from "@/types/scene";
import type { CaptionTrack } from "@/types/caption";

vi.mock("@/lib/ai", () => ({
  getOpenAIClient: vi.fn(),
}));

vi.mock("@/lib/mp3-duration", () => ({
  measureMp3DurationSeconds: vi.fn(),
}));

vi.mock("@/modules/projects/repository", () => ({
  approveNarrationTrackForProject: vi.fn(),
  getProjectById: vi.fn(),
  replaceNarrationTrackForProject: vi.fn(),
  saveNarrationTrackForProject: vi.fn(),
}));

vi.mock("@/modules/scenes/repository", () => ({
  getScenesForProject: vi.fn(),
}));

vi.mock("@/modules/captions/repository", () => ({
  getCaptionTrack: vi.fn(),
  saveCaptionTrack: vi.fn(),
}));

vi.mock("@/modules/narration/repository", () => ({
  deleteNarrationTrack: vi.fn(),
  getNarrationTrack: vi.fn(),
  saveNarrationTrack: vi.fn(),
  saveSceneAudioFile: vi.fn(),
}));

const mockedGetOpenAIClient = vi.mocked(getOpenAIClient);
const mockedMeasureMp3DurationSeconds = vi.mocked(measureMp3DurationSeconds);
const mockedApproveNarrationTrackForProject = vi.mocked(approveNarrationTrackForProject);
const mockedGetProjectById = vi.mocked(getProjectById);
const mockedReplaceNarrationTrackForProject = vi.mocked(replaceNarrationTrackForProject);
const mockedSaveNarrationTrackForProject = vi.mocked(saveNarrationTrackForProject);
const mockedGetScenesForProject = vi.mocked(getScenesForProject);
const mockedGetCaptionTrack = vi.mocked(getCaptionTrack);
const mockedSaveCaptionTrack = vi.mocked(saveCaptionTrack);
const mockedDeleteNarrationTrack = vi.mocked(deleteNarrationTrack);
const mockedGetNarrationTrack = vi.mocked(getNarrationTrack);
const mockedSaveNarrationTrack = vi.mocked(saveNarrationTrack);
const mockedSaveSceneAudioFile = vi.mocked(saveSceneAudioFile);

function createDraft(overrides: Partial<StoryDraftRecord> = {}): StoryDraftRecord {
  return {
    id: "draft-1",
    createdAt: "2026-04-06T00:00:00.000Z",
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
  const approvedDraft = createDraft();

  return {
    id: "project-1",
    name: "Project One",
    status: "scene_ready",
    createdAt: "2026-04-06T00:00:00.000Z",
    updatedAt: "2026-04-06T00:00:00.000Z",
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
    heading: "Scene Heading",
    scriptExcerpt: "You pause at the threshold.",
    sceneSummary: "The narrator establishes a tense threshold moment.",
    durationTargetSeconds: 18,
    visualIntent: "Suspenseful framing with a sense of looming discovery.",
    imagePrompt:
      "A suspenseful cinematic reveal through a doorway, moody side lighting, narrow framing, polished storytelling still.",
    promptVersion: 1,
    approvalStatus: "approved",
    source: "generated",
    createdAt: "2026-04-06T00:00:00.000Z",
    updatedAt: "2026-04-06T00:00:00.000Z",
    ...overrides,
  };
}

function createNarrationTrack(overrides: Partial<NarrationTrack> = {}): NarrationTrack {
  return {
    id: "track-1",
    projectId: "project-1",
    approvedScriptDraftId: "draft-1",
    approvedScenePlanId: "scene-1,scene-2",
    voiceName: "onyx",
    provider: "openai",
    speed: 1,
    style: null,
    pronunciationOverrides: {},
    scenes: [
      {
        sceneId: "scene-1",
        sceneNumber: 1,
        audioFilePath: "data/narration/track-1/scene-1.mp3",
        durationSeconds: 2,
        measuredDurationSeconds: 2,
        generatedAt: "2026-04-06T00:00:00.000Z",
      },
    ],
    totalDurationSeconds: 2,
    approvalStatus: "pending",
    source: "generated",
    createdAt: "2026-04-06T00:00:00.000Z",
    updatedAt: "2026-04-06T00:00:00.000Z",
    ...overrides,
  };
}

function createCaptionTrack(overrides: Partial<CaptionTrack> = {}): CaptionTrack {
  return {
    id: "caption-1",
    projectId: "project-1",
    narrationTrackId: "track-1",
    language: "en",
    source: "whisper",
    isStale: false,
    segments: [],
    createdAt: "2026-04-06T00:00:00.000Z",
    updatedAt: "2026-04-06T00:00:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();

  mockedGetOpenAIClient.mockReturnValue({
    audio: {
      speech: {
        create: vi.fn().mockResolvedValue({
          arrayBuffer: vi.fn().mockResolvedValue(Uint8Array.from([1, 2, 3]).buffer),
        }),
      },
    },
  } as never);
  mockedMeasureMp3DurationSeconds.mockReturnValue(2);
  mockedGetProjectById.mockResolvedValue(createProject());
  mockedGetScenesForProject.mockResolvedValue([
    createScene({ id: "scene-1", approvalStatus: "approved" }),
    createScene({ id: "scene-2", sceneNumber: 2, approvalStatus: "approved" }),
  ]);
  mockedSaveSceneAudioFile.mockImplementation(async (trackId, sceneNumber) => `data/narration/${trackId}/scene-${sceneNumber}.mp3`);
  mockedSaveNarrationTrack.mockResolvedValue();
  mockedSaveNarrationTrackForProject.mockResolvedValue(createProject());
  mockedReplaceNarrationTrackForProject.mockResolvedValue(createProject());
  mockedApproveNarrationTrackForProject.mockResolvedValue(createProject({ status: "voice_ready" }));
  mockedDeleteNarrationTrack.mockResolvedValue();
  mockedSaveCaptionTrack.mockResolvedValue();
  mockedGetCaptionTrack.mockResolvedValue(null);
});

describe("generateNarrationTrack", () => {
  it("throws if no approved script draft exists", async () => {
    mockedGetProjectById.mockResolvedValue(createProject({ approvedScriptDraftId: undefined }));

    await expect(
      generateNarrationTrack("project-1", {
        voiceName: "onyx",
        speed: 1,
        style: null,
        pronunciationOverrides: {},
      }),
    ).rejects.toThrow("Narration requires an approved script draft.");
  });

  it("throws if the scene plan is not approved", async () => {
    mockedGetProjectById.mockResolvedValue(
      createProject({
        status: "scene_planning",
        workflow: {
          scriptDraftIds: ["draft-1"],
          sceneIds: [],
          assetIds: [],
          narrationTrackIds: [],
          captionTrackIds: [],
          renderJobIds: [],
        },
      }),
    );

    await expect(
      generateNarrationTrack("project-1", {
        voiceName: "onyx",
        speed: 1,
        style: null,
        pronunciationOverrides: {},
      }),
    ).rejects.toThrow("Narration requires an approved scene plan.");
  });

  it("throws if any scene is not approved", async () => {
    mockedGetProjectById.mockResolvedValue(createProject());
    mockedGetScenesForProject.mockResolvedValue([
      createScene({ id: "scene-1", approvalStatus: "approved" }),
      createScene({ id: "scene-2", sceneNumber: 2, approvalStatus: "pending" }),
    ]);

    await expect(
      generateNarrationTrack("project-1", {
        voiceName: "onyx",
        speed: 1,
        style: null,
        pronunciationOverrides: {},
      }),
    ).rejects.toThrow("All scenes must be approved before narration can be generated.");
  });

  it("calls TTS once per scene", async () => {
    const createSpeech = vi.fn().mockResolvedValue({
      arrayBuffer: vi.fn().mockResolvedValue(Uint8Array.from([1, 2, 3]).buffer),
    });
    mockedGetOpenAIClient.mockReturnValue({
      audio: {
        speech: {
          create: createSpeech,
        },
      },
    } as never);
    mockedGetProjectById.mockResolvedValue(createProject());
    mockedGetScenesForProject.mockResolvedValue([
      createScene({ id: "scene-1", sceneNumber: 1 }),
      createScene({ id: "scene-2", sceneNumber: 2, scriptExcerpt: "You hear a second step behind you." }),
    ]);

    const track = await generateNarrationTrack("project-1", {
      voiceName: "onyx",
      speed: 1,
      style: null,
      pronunciationOverrides: {},
    });

    expect(createSpeech).toHaveBeenCalledTimes(2);
    expect(mockedSaveSceneAudioFile).toHaveBeenCalledTimes(2);
    expect(mockedSaveNarrationTrack).toHaveBeenCalledWith(expect.objectContaining({ id: track.id, scenes: expect.any(Array) }));
    expect(mockedSaveNarrationTrackForProject).toHaveBeenCalledWith("project-1", track.id);
    expect(mockedMeasureMp3DurationSeconds).toHaveBeenCalledTimes(2);
    expect(track.scenes.every((scene) => scene.measuredDurationSeconds === 2)).toBe(true);
  });
});

describe("approveNarrationTrack", () => {
  it("sets the track status to approved", async () => {
    mockedGetNarrationTrack.mockResolvedValue(createNarrationTrack());

    const track = await approveNarrationTrack("track-1", "project-1");

    expect(track.approvalStatus).toBe("approved");
    expect(mockedSaveNarrationTrack).toHaveBeenCalledWith(expect.objectContaining({ approvalStatus: "approved" }));
    expect(mockedApproveNarrationTrackForProject).toHaveBeenCalledWith("project-1");
  });
});

describe("regenerateNarrationTrack", () => {
  it("marks the latest caption track as stale", async () => {
    const createSpeech = vi.fn().mockResolvedValue({
      arrayBuffer: vi.fn().mockResolvedValue(Uint8Array.from([1, 2, 3]).buffer),
    });
    mockedGetOpenAIClient.mockReturnValue({
      audio: {
        speech: {
          create: createSpeech,
        },
      },
    } as never);
    mockedGetNarrationTrack.mockResolvedValue(createNarrationTrack());
    mockedGetProjectById.mockResolvedValue(
      createProject({
        workflow: {
          scriptDraftIds: ["draft-1"],
          sceneIds: ["scene-1"],
          assetIds: [],
          narrationTrackIds: ["track-1"],
          captionTrackIds: ["caption-1"],
          renderJobIds: [],
        },
      }),
    );
    mockedGetScenesForProject.mockResolvedValue([createScene()]);
    mockedGetCaptionTrack.mockResolvedValue(createCaptionTrack());

    await regenerateNarrationTrack("track-1", "project-1", {
      voiceName: "onyx",
      speed: 1,
      style: null,
      pronunciationOverrides: {},
    });

    expect(mockedDeleteNarrationTrack).toHaveBeenCalledWith("track-1");
    expect(mockedSaveCaptionTrack).toHaveBeenCalledWith(expect.objectContaining({ id: "caption-1", isStale: true }));
    expect(mockedReplaceNarrationTrackForProject).toHaveBeenCalledWith("project-1", "track-1", expect.any(String));
  });
});
