import { mkdtemp, mkdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RenderJob } from "@/modules/rendering/types";

const mockedGetProjectById = vi.fn();
const mockedGetTimelineDraftForProject = vi.fn();
const mockedCreateRenderJob = vi.fn();
const mockedGetRenderJob = vi.fn();
const mockedRenderProject = vi.fn();
const mockedUpdateRenderJob = vi.fn();

vi.mock("@/modules/projects/repository", () => ({
  getProjectById: (...args: unknown[]) => mockedGetProjectById(...args),
}));

vi.mock("@/modules/timeline/service", () => ({
  getTimelineDraftForProject: (...args: unknown[]) => mockedGetTimelineDraftForProject(...args),
}));

vi.mock("@/modules/rendering/service", () => ({
  createRenderJob: (...args: unknown[]) => mockedCreateRenderJob(...args),
  renderProject: (...args: unknown[]) => mockedRenderProject(...args),
}));

vi.mock("@/modules/rendering/repository", () => ({
  getRenderJob: (...args: unknown[]) => mockedGetRenderJob(...args),
  updateRenderJob: (...args: unknown[]) => mockedUpdateRenderJob(...args),
}));

const originalCwd = process.cwd();
let tempDir = "";

function createJob(overrides: Partial<RenderJob> = {}): RenderJob {
  return {
    id: "render-1",
    projectId: "project-1",
    timelineDraftId: "timeline-1",
    status: "queued",
    outputFilePath: null,
    errorMessage: null,
    progressMessage: "Queued for render processing.",
    createdAt: "2026-04-09T00:00:00.000Z",
    updatedAt: "2026-04-09T00:00:00.000Z",
    ...overrides,
  };
}

async function loadQueue() {
  vi.resetModules();
  return import("@/modules/rendering/queue");
}

beforeEach(async () => {
  vi.clearAllMocks();
  tempDir = await mkdtemp(path.join(os.tmpdir(), "render-queue-test-"));
  await mkdir(path.join(tempDir, "data", "rendering"), { recursive: true });
  process.chdir(tempDir);
  mockedGetProjectById.mockResolvedValue({ id: "project-1" });
  mockedGetTimelineDraftForProject.mockResolvedValue({ id: "timeline-1" });
  mockedCreateRenderJob.mockResolvedValue(createJob());
  mockedGetRenderJob.mockResolvedValue(createJob());
  mockedRenderProject.mockResolvedValue("data/renders/project-1.mp4");
  mockedUpdateRenderJob.mockImplementation(async (_jobId: string, updater: (job: RenderJob) => RenderJob) =>
    updater(createJob({ status: "rendering" })),
  );
});

afterEach(async () => {
  process.chdir(originalCwd);
  await rm(tempDir, { recursive: true, force: true });
});

describe("render queue", () => {
  it("prevents duplicate queued or running jobs for the same project", async () => {
    const queue = await loadQueue();

    const firstJobId = await queue.enqueueRender("project-1");
    const secondJobId = await queue.enqueueRender("project-1");

    expect(firstJobId).toBe("render-1");
    expect(secondJobId).toBe("render-1");
    expect(mockedCreateRenderJob).toHaveBeenCalledTimes(1);
  });

  it("returns null for unknown job ids", async () => {
    const queue = await loadQueue();

    await expect(queue.getJobStatus("missing-job")).resolves.toBeNull();
    expect(mockedGetRenderJob).not.toHaveBeenCalled();
  });

  it("retries an in-flight job left in running state", async () => {
    const queue = await loadQueue();
    await queue.enqueueRender("project-1");

    mockedCreateRenderJob.mockReset();
    mockedGetRenderJob.mockResolvedValue(createJob({ status: "rendering" }));

    await expect(queue.processNextJob()).resolves.toMatchObject({ jobId: "render-1", status: "complete" });
    expect(mockedRenderProject).toHaveBeenCalledWith("project-1", "render-1");
  });
});
