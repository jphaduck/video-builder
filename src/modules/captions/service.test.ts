import { beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import { getOpenAIClient } from "@/lib/ai";
import { getNarrationTrack } from "@/modules/narration/repository";
import { getProjectById, saveCaptionTrackForProject } from "@/modules/projects/repository";
import { getScenesForProject } from "@/modules/scenes/repository";
import { getCaptionTrack, saveCaptionExport, saveCaptionTrack } from "@/modules/captions/repository";
import { exportSrt, exportVtt, generateCaptionTrack, updateCaptionSegment } from "@/modules/captions/service";
import type { CaptionTrack } from "@/types/caption";
import type { NarrationTrack } from "@/types/narration";
import type { ProjectRecord, StoryDraftRecord } from "@/types/project";
import type { Scene } from "@/types/scene";

vi.mock("node:fs", () => ({
  default: {
    createReadStream: vi.fn(),
  },
  createReadStream: vi.fn(),
}));

vi.mock("@/lib/ai", () => ({
  getOpenAIClient: vi.fn(),
}));

vi.mock("@/modules/narration/repository", () => ({
  getNarrationTrack: vi.fn(),
}));

vi.mock("@/modules/projects/repository", () => ({
  getProjectById: vi.fn(),
  saveCaptionTrackForProject: vi.fn(),
}));

vi.mock("@/modules/scenes/repository", () => ({
  getScenesForProject: vi.fn(),
}));

vi.mock("@/modules/captions/repository", () => ({
  getCaptionTrack: vi.fn(),
  saveCaptionExport: vi.fn(),
  saveCaptionTrack: vi.fn(),
}));

const mockedCreateReadStream = vi.mocked(fs.createReadStream);
const mockedGetOpenAIClient = vi.mocked(getOpenAIClient);
const mockedGetNarrationTrack = vi.mocked(getNarrationTrack);
const mockedGetProjectById = vi.mocked(getProjectById);
const mockedSaveCaptionTrackForProject = vi.mocked(saveCaptionTrackForProject);
const mockedGetScenesForProject = vi.mocked(getScenesForProject);
const mockedGetCaptionTrack = vi.mocked(getCaptionTrack);
const mockedSaveCaptionExport = vi.mocked(saveCaptionExport);
const mockedSaveCaptionTrack = vi.mocked(saveCaptionTrack);

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
    status: "voice_ready",
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
      sceneIds: ["scene-1"],
      assetIds: [],
      narrationTrackIds: ["track-1"],
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
    approvedScenePlanId: "scene-1",
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
        durationSeconds: 3,
        measuredDurationSeconds: 3,
        generatedAt: "2026-04-06T00:00:00.000Z",
      },
    ],
    totalDurationSeconds: 3,
    approvalStatus: "approved",
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
    segments: [
      {
        id: "segment-1",
        startMs: 0,
        endMs: 1200,
        text: "You pause at the threshold.",
        sceneId: "scene-1",
        sceneNumber: 1,
        edited: false,
      },
    ],
    createdAt: "2026-04-06T00:00:00.000Z",
    updatedAt: "2026-04-06T00:00:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();

  mockedCreateReadStream.mockReturnValue({} as never);
  mockedGetOpenAIClient.mockReturnValue({
    audio: {
      transcriptions: {
        create: vi.fn().mockResolvedValue({
          words: [
            { word: "You", start: 0, end: 0.2 },
            { word: "pause", start: 0.2, end: 0.4 },
            { word: "at", start: 0.4, end: 0.5 },
            { word: "the", start: 0.5, end: 0.6 },
            { word: "threshold.", start: 0.6, end: 0.9 },
          ],
        }),
      },
    },
  } as never);
  mockedGetProjectById.mockResolvedValue(createProject());
  mockedGetScenesForProject.mockResolvedValue([createScene()]);
  mockedSaveCaptionTrack.mockResolvedValue();
  mockedSaveCaptionExport.mockResolvedValue();
  mockedSaveCaptionTrackForProject.mockResolvedValue(createProject());
});

describe("generateCaptionTrack", () => {
  it("throws if narration is not approved", async () => {
    mockedGetNarrationTrack.mockResolvedValue(createNarrationTrack({ approvalStatus: "pending" }));

    await expect(generateCaptionTrack("project-1", "track-1")).rejects.toThrow(
      "Captions can only be generated from an approved narration track.",
    );
  });

  it("calls Whisper once per scene", async () => {
    const createTranscription = vi.fn().mockResolvedValue({
      words: [
        { word: "You", start: 0, end: 0.2 },
        { word: "pause", start: 0.2, end: 0.4 },
        { word: "at", start: 0.4, end: 0.5 },
        { word: "the", start: 0.5, end: 0.6 },
        { word: "threshold.", start: 0.6, end: 0.9 },
      ],
    });
    mockedGetOpenAIClient.mockReturnValue({
      audio: {
        transcriptions: {
          create: createTranscription,
        },
      },
    } as never);
    mockedGetNarrationTrack.mockResolvedValue(
      createNarrationTrack({
        scenes: [
          createNarrationTrack().scenes[0],
          {
            sceneId: "scene-2",
            sceneNumber: 2,
            audioFilePath: "data/narration/track-1/scene-2.mp3",
            durationSeconds: 2,
            measuredDurationSeconds: 2,
            generatedAt: "2026-04-06T00:00:00.000Z",
          },
        ],
      }),
    );
    mockedGetScenesForProject.mockResolvedValue([
      createScene({ id: "scene-1", sceneNumber: 1 }),
      createScene({ id: "scene-2", sceneNumber: 2 }),
    ]);

    await generateCaptionTrack("project-1", "track-1");

    expect(createTranscription).toHaveBeenCalledTimes(2);
  });

  it("chunks words into segments of at most 8 words", async () => {
    const createTranscription = vi.fn().mockResolvedValue({
      words: [
        { word: "One", start: 0, end: 0.1 },
        { word: "two", start: 0.1, end: 0.2 },
        { word: "three", start: 0.2, end: 0.3 },
        { word: "four", start: 0.3, end: 0.4 },
        { word: "five", start: 0.4, end: 0.5 },
        { word: "six", start: 0.5, end: 0.6 },
        { word: "seven", start: 0.6, end: 0.7 },
        { word: "eight", start: 0.7, end: 0.8 },
        { word: "nine", start: 0.8, end: 0.9 },
      ],
    });
    mockedGetOpenAIClient.mockReturnValue({
      audio: {
        transcriptions: {
          create: createTranscription,
        },
      },
    } as never);
    mockedGetNarrationTrack.mockResolvedValue(createNarrationTrack());

    const track = await generateCaptionTrack("project-1", "track-1");

    expect(track.segments).toHaveLength(2);
    expect(track.segments[0]?.text).toBe("One two three four five six seven eight");
    expect(track.segments[1]?.text).toBe("nine");
  });

  it("offsets later scene captions by measured narration duration and writes SRT/VTT exports", async () => {
    const createTranscription = vi
      .fn()
      .mockResolvedValueOnce({
        words: [{ word: "First.", start: 0, end: 0.5 }],
      })
      .mockResolvedValueOnce({
        words: [{ word: "Second.", start: 0, end: 0.5 }],
      });
    mockedGetOpenAIClient.mockReturnValue({
      audio: {
        transcriptions: {
          create: createTranscription,
        },
      },
    } as never);
    mockedGetNarrationTrack.mockResolvedValue(
      createNarrationTrack({
        scenes: [
          {
            sceneId: "scene-1",
            sceneNumber: 1,
            audioFilePath: "data/narration/track-1/scene-1.mp3",
            durationSeconds: 3,
            measuredDurationSeconds: 3,
            generatedAt: "2026-04-06T00:00:00.000Z",
          },
          {
            sceneId: "scene-2",
            sceneNumber: 2,
            audioFilePath: "data/narration/track-1/scene-2.mp3",
            durationSeconds: 2,
            measuredDurationSeconds: 2,
            generatedAt: "2026-04-06T00:00:00.000Z",
          },
        ],
      }),
    );
    mockedGetScenesForProject.mockResolvedValue([
      createScene({ id: "scene-1", sceneNumber: 1 }),
      createScene({ id: "scene-2", sceneNumber: 2 }),
    ]);

    const track = await generateCaptionTrack("project-1", "track-1");

    expect(track.segments[1]?.startMs).toBe(3000);
    expect(mockedSaveCaptionExport).toHaveBeenCalledWith(track.id, "srt", expect.stringContaining("00:00:03,000"));
    expect(mockedSaveCaptionExport).toHaveBeenCalledWith(track.id, "vtt", expect.stringContaining("00:00:03.000"));
  });
});

describe("updateCaptionSegment", () => {
  it("sets edited to true", async () => {
    mockedGetCaptionTrack.mockResolvedValue(createCaptionTrack());

    const track = await updateCaptionSegment("caption-1", "segment-1", "Updated caption text");

    expect(track.segments[0]?.edited).toBe(true);
    expect(track.segments[0]?.text).toBe("Updated caption text");
    expect(mockedSaveCaptionTrack).toHaveBeenCalledWith(expect.objectContaining({ source: "manual" }));
  });
});

describe("caption export helpers", () => {
  it("renders SRT and VTT with the expected timestamp format", () => {
    const track = createCaptionTrack();

    expect(exportSrt(track)).toContain("00:00:00,000 --> 00:00:01,200");
    expect(exportVtt(track)).toContain("WEBVTT");
    expect(exportVtt(track)).toContain("00:00:00.000 --> 00:00:01.200");
  });
});
