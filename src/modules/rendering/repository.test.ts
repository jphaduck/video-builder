import { access, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RenderJob } from "@/modules/rendering/types";

const originalCwd = process.cwd();
const originalDbPath = process.env.STUDIO_DB_PATH;
let tempDir = "";
let repoDir = "";

function createJob(overrides: Partial<RenderJob> = {}): RenderJob {
  const now = "2026-04-09T00:00:00.000Z";
  return {
    id: "render-1",
    projectId: "project-1",
    timelineDraftId: "timeline-1",
    status: "complete",
    outputFilePath: "data/renders/project-1.mp4",
    errorMessage: null,
    progressMessage: "Render complete.",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

async function loadRepository() {
  vi.resetModules();
  return import("@/modules/rendering/repository");
}

beforeEach(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), "render-repo-test-"));
  repoDir = path.join(tempDir, "repo");
  await mkdir(repoDir, { recursive: true });
  process.chdir(repoDir);
  process.env.STUDIO_DB_PATH = ":memory:";
});

afterEach(async () => {
  process.chdir(originalCwd);
  process.env.STUDIO_DB_PATH = originalDbPath;
  await rm(tempDir, { recursive: true, force: true });
});

describe("rendering repository", () => {
  it("persists and lists render jobs by project", async () => {
    const repo = await loadRepository();
    const first = createJob({ id: "render-1", createdAt: "2026-04-09T00:00:00.000Z" });
    const second = createJob({ id: "render-2", createdAt: "2026-04-09T00:00:01.000Z" });
    const other = createJob({ id: "render-3", projectId: "project-2" });

    await repo.saveRenderJob(first);
    await repo.saveRenderJob(second);
    await repo.saveRenderJob(other);

    expect(await repo.getRenderJob("render-1")).toEqual(first);
    expect((await repo.listRenderJobs("project-1")).map((job) => job.id)).toEqual(["render-1", "render-2"]);
    expect((await repo.getLatestRenderJobForProject("project-1"))?.id).toBe("render-2");
  });

  it("deletes the row and related render artifacts", async () => {
    const repo = await loadRepository();
    const artifactPaths = ["data/renders/project-1.mp4", "data/rendering/project-1.srt", "data/rendering/project-1-audio.mp3", "data/rendering/project-1-images.txt", "data/rendering/project-1-audio.txt"];

    for (const relativePath of artifactPaths) {
      const filePath = path.join(repoDir, relativePath);
      await mkdir(path.dirname(filePath), { recursive: true });
      await writeFile(filePath, "artifact", "utf8");
    }

    await repo.saveRenderJob(createJob());
    await repo.deleteRenderJob("render-1");

    expect(await repo.getRenderJob("render-1")).toBeNull();
    await Promise.all(artifactPaths.map((relativePath) => expect(access(path.join(repoDir, relativePath))).rejects.toMatchObject({ code: "ENOENT" })));
  });

  it("does not delete files outside the renders directory when a job stores an unsafe output path", async () => {
    const repo = await loadRepository();
    const outsideFilePath = path.join(tempDir, "outside.mp4");

    await writeFile(outsideFilePath, "outside-artifact", "utf8");
    await repo.saveRenderJob(createJob({ outputFilePath: "../outside.mp4" }));
    await repo.deleteRenderJob("render-1");

    expect(await repo.getRenderJob("render-1")).toBeNull();
    await expect(access(outsideFilePath)).resolves.toBeUndefined();
  });
});
