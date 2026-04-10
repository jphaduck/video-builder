import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockedGetProjectById = vi.fn();
const mockedSaveRenderJobForProject = vi.fn();
const mockedSetProjectStatus = vi.fn();
const mockedGetTimelineDraftForProject = vi.fn();
const mockedGetRenderJob = vi.fn();
const mockedSaveRenderJob = vi.fn();
const mockedUpdateRenderJob = vi.fn();
const mockedAccess = vi.fn();
const mockedMkdir = vi.fn();
const mockedWriteFile = vi.fn();
const mockedExistsSync = vi.fn();
const mockedSharp = vi.fn(() => ({
  composite: vi.fn().mockReturnThis(),
  png: vi.fn().mockReturnThis(),
  toFile: vi.fn().mockResolvedValue(undefined),
}));
const ffmpegSaveCalls: string[] = [];

class MockFfmpegCommand {
  private endHandler?: () => void;

  input = vi.fn(() => this);
  inputOptions = vi.fn(() => this);
  outputOptions = vi.fn(() => this);
  videoFilters = vi.fn(() => this);
  complexFilter = vi.fn(() => this);
  on = vi.fn((event: string, handler: () => void) => {
    if (event === "end") {
      this.endHandler = handler;
    }

    return this;
  });
  save = vi.fn((outputPath: string) => {
    ffmpegSaveCalls.push(outputPath);
    this.endHandler?.();
    return this;
  });
}

const mockedFfmpeg = vi.fn(() => new MockFfmpegCommand());
mockedFfmpeg.setFfmpegPath = vi.fn();

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return {
    ...actual,
    default: {
      ...actual.default,
      existsSync: (...args: unknown[]) => mockedExistsSync(...args),
    },
    existsSync: (...args: unknown[]) => mockedExistsSync(...args),
  };
});

vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs/promises")>();
  return {
    ...actual,
    access: (...args: unknown[]) => mockedAccess(...args),
    mkdir: (...args: unknown[]) => mockedMkdir(...args),
    writeFile: (...args: unknown[]) => mockedWriteFile(...args),
  };
});

vi.mock("fluent-ffmpeg", () => ({
  default: mockedFfmpeg,
}));

vi.mock("sharp", () => ({
  default: mockedSharp,
}));

vi.mock("@/modules/projects/repository", () => ({
  getProjectById: (...args: unknown[]) => mockedGetProjectById(...args),
  saveRenderJobForProject: (...args: unknown[]) => mockedSaveRenderJobForProject(...args),
  setProjectStatus: (...args: unknown[]) => mockedSetProjectStatus(...args),
}));

vi.mock("@/modules/timeline/service", () => ({
  getTimelineDraftForProject: (...args: unknown[]) => mockedGetTimelineDraftForProject(...args),
}));

vi.mock("@/modules/rendering/repository", () => ({
  getRenderJob: (...args: unknown[]) => mockedGetRenderJob(...args),
  saveRenderJob: (...args: unknown[]) => mockedSaveRenderJob(...args),
  updateRenderJob: (...args: unknown[]) => mockedUpdateRenderJob(...args),
}));

type MockRenderJob = {
  id: string;
  projectId: string;
  timelineDraftId: string;
  status: "queued" | "rendering" | "complete" | "error";
  outputFilePath: string | null;
  errorMessage: string | null;
  progressMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

describe("renderProject", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    ffmpegSaveCalls.length = 0;
    mockedSetProjectStatus.mockResolvedValue(undefined);
    mockedAccess.mockResolvedValue(undefined);
    mockedMkdir.mockResolvedValue(undefined);
    mockedWriteFile.mockResolvedValue(undefined);
    mockedExistsSync.mockReturnValue(true);
    mockedUpdateRenderJob.mockImplementation(async (_jobId: string, updater: (job: MockRenderJob) => MockRenderJob) =>
      updater({
        id: "render-job-1",
        projectId: "project-1",
        timelineDraftId: "timeline-1",
        status: "rendering",
        outputFilePath: null,
        errorMessage: null,
        progressMessage: "Preparing scene images...",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
    );
  });

  it("throws a descriptive error when the timeline draft is missing", async () => {
    mockedGetProjectById.mockResolvedValue({
      id: "project-1",
      workflow: { renderJobIds: ["render-job-1"] },
    });
    mockedGetTimelineDraftForProject.mockResolvedValue(null);

    const { renderProject } = await import("@/modules/rendering/service");

    await expect(renderProject("project-1")).rejects.toThrow(
      "Timeline draft not found for this project. Build the timeline before rendering.",
    );
  });

  it("throws a descriptive error when narration audio for a scene is missing", async () => {
    mockedGetProjectById.mockResolvedValue({
      id: "project-1",
      musicTrack: "subtle",
      musicVolume: 0.08,
      workflow: { renderJobIds: ["render-job-1"] },
    });
    mockedGetTimelineDraftForProject.mockResolvedValue({
      id: "timeline-1",
      projectId: "project-1",
      scenes: [
        {
          id: "scene-1",
          sceneNumber: 1,
          heading: "Missing audio",
        },
      ],
      assets: [],
      narrationTrack: {
        scenes: [
          {
            sceneId: "scene-1",
            sceneNumber: 1,
            audioFilePath: "data/narration/missing.mp3",
            durationSeconds: 10,
            measuredDurationSeconds: 10,
          },
        ],
      },
      captionTrack: { segments: [] },
    });

    const { renderProject } = await import("@/modules/rendering/service");

    await expect(renderProject("project-1")).rejects.toThrow(
      "Narration file missing for scene 1: data/narration/missing.mp3",
    );
  });

  it("skips the music mix step when the project music track is none", async () => {
    mockedGetProjectById.mockResolvedValue({
      id: "project-1",
      musicTrack: "none",
      musicVolume: 0.08,
      workflow: { renderJobIds: ["render-job-1"] },
    });
    mockedGetTimelineDraftForProject.mockResolvedValue({
      id: "timeline-1",
      projectId: "project-1",
      scenes: [
        {
          id: "scene-1",
          sceneNumber: 1,
          heading: "Opening scene",
        },
      ],
      assets: [
        {
          id: "asset-1",
          sceneId: "scene-1",
          imageFilePath: "data/assets/scene-1.png",
          selected: true,
          approvalStatus: "approved",
        },
      ],
      narrationTrack: {
        scenes: [
          {
            sceneId: "scene-1",
            sceneNumber: 1,
            audioFilePath: "public/audio/ambient-subtle.mp3",
            durationSeconds: 10,
            measuredDurationSeconds: 10,
          },
        ],
      },
      captionTrack: {
        segments: [
          {
            id: "caption-1",
            startMs: 0,
            endMs: 1000,
            text: "Caption line",
            sceneId: "scene-1",
            sceneNumber: 1,
            edited: false,
          },
        ],
      },
    });

    const { renderProject } = await import("@/modules/rendering/service");

    await expect(renderProject("project-1")).resolves.toBe(path.join("data", "renders", "project-1.mp4"));
    expect(ffmpegSaveCalls).toEqual([
      path.join(process.cwd(), "data", "rendering", "project-1-audio.mp3"),
      path.join(process.cwd(), "data", "renders", "project-1.mp4"),
    ]);
  });
});
