import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Project } from "@/types/project";
import type { AssetCandidate } from "@/modules/assets/types";

const originalCwd = process.cwd();

let tempDir = "";
const mockedGetProject = vi.fn();
const mockedAuth = vi.fn();

vi.mock("@/auth", () => ({
  auth: (...args: unknown[]) => mockedAuth(...args),
}));

vi.mock("@/lib/project-store", () => ({
  getProject: (...args: unknown[]) => mockedGetProject(...args),
  getProjectByAnyOwner: (...args: unknown[]) => mockedGetProject(...args),
}));

async function loadModules() {
  vi.resetModules();
  mockedAuth.mockResolvedValue({
    user: { id: "test-user-id", name: "Test User", email: "test@test.com" },
  });
  const assets = await import("@/modules/assets/repository");

  return { assets };
}

function createProject(assetId: string): Project {
  const now = "2026-04-07T00:00:00.000Z";

  return {
    id: "project-1",
    name: "Project One",
    status: "images_ready",
    createdAt: now,
    updatedAt: now,
    storyInput: {
      premise: "A quiet town hides something wrong.",
      targetRuntimeMin: 10,
    },
    scriptDrafts: [],
    workflow: {
      scriptDraftIds: [],
      sceneIds: ["scene-1"],
      assetIds: [assetId],
      narrationTrackIds: [],
      captionTrackIds: [],
      renderJobIds: [],
      imagePlanApprovedAt: now,
    },
  };
}

function createAssetCandidate(imageFilePath: string): AssetCandidate {
  const now = "2026-04-07T00:00:00.000Z";

  return {
    id: "asset-1",
    projectId: "project-1",
    sceneId: "scene-1",
    sceneNumber: 1,
    candidateIndex: 1,
    imagePrompt: "A dim hallway lit by a weak lamp from the next room.",
    promptVersion: 2,
    provider: "openai",
    imageFilePath,
    selected: true,
    approvalStatus: "approved",
    createdAt: now,
    updatedAt: now,
  };
}

beforeEach(async () => {
  vi.clearAllMocks();
  tempDir = await mkdtemp(path.join(os.tmpdir(), "asset-repo-test-"));
  process.chdir(tempDir);
});

afterEach(async () => {
  process.chdir(originalCwd);
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true });
  }
});

describe("asset repository persistence", () => {
  it("persists asset metadata and image files across reloads", async () => {
    const { assets } = await loadModules();
    const imageFilePath = await assets.saveAssetImageFile("asset-1", Buffer.from("png-bytes"));
    const candidate = createAssetCandidate(imageFilePath);

    mockedGetProject.mockResolvedValue(createProject(candidate.id));
    await assets.saveAssetCandidate(candidate);

    expect(await assets.getAssetCandidate(candidate.id)).toEqual(candidate);
    expect(await readFile(path.join(tempDir, imageFilePath))).toEqual(Buffer.from("png-bytes"));

    const reloaded = await loadModules();
    expect(await reloaded.assets.getAssetCandidate(candidate.id)).toEqual(candidate);
    expect(await reloaded.assets.getAssetCandidatesForProject(candidate.projectId)).toEqual([candidate]);
    expect(mockedGetProject).toHaveBeenCalledWith(candidate.projectId, "test-user-id");
  });

  it("does not delete files outside data/assets when metadata stores an unsafe image path", async () => {
    const { assets } = await loadModules();
    const outsideFilePath = path.join(tempDir, "outside.png");
    const safeAssetImagePath = path.join(tempDir, "data", "assets", "asset-1.png");
    const candidate = createAssetCandidate("../outside.png");

    await mkdir(path.dirname(safeAssetImagePath), { recursive: true });
    await writeFile(outsideFilePath, "outside-image", "utf8");
    await writeFile(safeAssetImagePath, "safe-image", "utf8");
    await assets.saveAssetCandidate(candidate);

    await assets.deleteAssetCandidate(candidate.id);

    expect(await assets.getAssetCandidate(candidate.id)).toBeNull();
    await expect(access(outsideFilePath)).resolves.toBeUndefined();
    await expect(access(safeAssetImagePath)).rejects.toMatchObject({ code: "ENOENT" });
  });
});
