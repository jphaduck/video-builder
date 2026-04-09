import { access, mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ProjectRecord } from "@/types/project";

const mockedDeleteAssetCandidate = vi.fn();
const mockedDeleteCaptionTrack = vi.fn();
const mockedDeleteNarrationTrack = vi.fn();
const mockedDeleteRenderJob = vi.fn();
const mockedListRenderJobs = vi.fn();
const mockedDeleteScene = vi.fn();
const mockedDeleteTimelineDraft = vi.fn();

vi.mock("@/modules/assets/repository", () => ({ deleteAssetCandidate: (...args: unknown[]) => mockedDeleteAssetCandidate(...args) }));
vi.mock("@/modules/captions/repository", () => ({ deleteCaptionTrack: (...args: unknown[]) => mockedDeleteCaptionTrack(...args) }));
vi.mock("@/modules/narration/repository", () => ({ deleteNarrationTrack: (...args: unknown[]) => mockedDeleteNarrationTrack(...args) }));
vi.mock("@/modules/rendering/repository", () => ({
  deleteRenderJob: (...args: unknown[]) => mockedDeleteRenderJob(...args),
  listRenderJobs: (...args: unknown[]) => mockedListRenderJobs(...args),
}));
vi.mock("@/modules/scenes/repository", () => ({ deleteScene: (...args: unknown[]) => mockedDeleteScene(...args) }));
vi.mock("@/modules/timeline/repository", () => ({ deleteTimelineDraft: (...args: unknown[]) => mockedDeleteTimelineDraft(...args) }));

const originalCwd = process.cwd();
let tempDir = "";

function createProject(): ProjectRecord {
  const now = "2026-04-09T00:00:00.000Z";
  return {
    id: "project-1",
    name: "Project One",
    status: "rendered",
    createdAt: now,
    updatedAt: now,
    storyInput: { premise: "A hidden system closes around you.", targetRuntimeMin: 5 },
    scriptDrafts: [],
    workflow: {
      scriptDraftIds: [],
      sceneIds: ["scene-1", "scene-2"],
      assetIds: ["asset-1"],
      narrationTrackIds: ["track-1"],
      captionTrackIds: ["caption-1"],
      renderJobIds: ["render-1"],
    },
  };
}

async function loadRepository() {
  vi.resetModules();
  return import("@/modules/projects/repository");
}

beforeEach(async () => {
  vi.clearAllMocks();
  tempDir = await mkdtemp(path.join(os.tmpdir(), "project-repo-test-"));
  process.chdir(tempDir);
  mockedListRenderJobs.mockResolvedValue([{ id: "render-1", projectId: "project-1" }]);
});

afterEach(async () => {
  process.chdir(originalCwd);
  await rm(tempDir, { recursive: true, force: true });
});

describe("projects repository", () => {
  it("deletes the stored project and all derived artifacts", async () => {
    const project = createProject();
    const filePath = path.join(tempDir, "data", "projects", `${project.id}.json`);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, JSON.stringify(project, null, 2), "utf8");

    const { deleteProjectById } = await loadRepository();
    await deleteProjectById(project.id);

    expect(mockedDeleteScene).toHaveBeenCalledTimes(2);
    expect(mockedDeleteScene).toHaveBeenCalledWith("scene-1");
    expect(mockedDeleteAssetCandidate).toHaveBeenCalledWith("asset-1");
    expect(mockedDeleteNarrationTrack).toHaveBeenCalledWith("track-1");
    expect(mockedDeleteCaptionTrack).toHaveBeenCalledWith("caption-1");
    expect(mockedDeleteTimelineDraft).toHaveBeenCalledWith("project-1");
    expect(mockedListRenderJobs).toHaveBeenCalledWith("project-1");
    expect(mockedDeleteRenderJob).toHaveBeenCalledWith("render-1");
    await expect(access(filePath)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("throws when deleting a missing project", async () => {
    const { deleteProjectById } = await loadRepository();

    await expect(deleteProjectById("missing-project")).rejects.toThrow("Project not found: missing-project");
    expect(mockedDeleteScene).not.toHaveBeenCalled();
    expect(mockedDeleteRenderJob).not.toHaveBeenCalled();
  });
});
