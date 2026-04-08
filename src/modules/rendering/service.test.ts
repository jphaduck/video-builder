import { beforeEach, describe, expect, it, vi } from "vitest";

const mockedGetProjectById = vi.fn();
const mockedSaveRenderJobForProject = vi.fn();
const mockedSetProjectStatus = vi.fn();
const mockedGetTimelineDraftForProject = vi.fn();
const mockedGetRenderJob = vi.fn();
const mockedSaveRenderJob = vi.fn();
const mockedUpdateRenderJob = vi.fn();

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
  status: "pending" | "rendering" | "complete" | "error";
  outputFilePath: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

describe("renderProject", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedSetProjectStatus.mockResolvedValue(undefined);
    mockedUpdateRenderJob.mockImplementation(async (_jobId: string, updater: (job: MockRenderJob) => MockRenderJob) =>
      updater({
        id: "render-job-1",
        projectId: "project-1",
        timelineDraftId: "timeline-1",
        status: "rendering",
        outputFilePath: null,
        errorMessage: null,
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
});
