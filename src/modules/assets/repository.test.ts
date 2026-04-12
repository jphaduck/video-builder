import { access, mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Project } from "@/types/project";
import type { AssetCandidate } from "@/modules/assets/types";

const originalCwd = process.cwd();
const originalDbPath = process.env.STUDIO_DB_PATH;
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

async function loadRepository() {
  vi.resetModules();
  mockedAuth.mockResolvedValue({ user: { id: "test-user-id", name: "Test User", email: "test@test.com" } });
  return import("@/modules/assets/repository");
}

function createProject(assetId: string): Project {
  const now = "2026-04-07T00:00:00.000Z";
  return {
    id: "project-1",
    name: "Project One",
    status: "images_ready",
    createdAt: now,
    updatedAt: now,
    storyInput: { premise: "A quiet town hides something wrong.", targetRuntimeMin: 10 },
    scriptDrafts: [],
    workflow: { scriptDraftIds: [], sceneIds: ["scene-1"], assetIds: [assetId], narrationTrackIds: [], captionTrackIds: [], renderJobIds: [], imagePlanApprovedAt: now },
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
  process.env.STUDIO_DB_PATH = ":memory:";
});

afterEach(async () => {
  process.chdir(originalCwd);
  process.env.STUDIO_DB_PATH = originalDbPath;
  await rm(tempDir, { recursive: true, force: true });
});

describe("asset repository persistence", () => {
  it("persists asset metadata in SQLite and image files on disk", async () => {
    const assets = await loadRepository();
    const imageFilePath = await assets.saveAssetImageFile("asset-1", Buffer.from("png-bytes"));
    const candidate = createAssetCandidate(imageFilePath);

    mockedGetProject.mockResolvedValue(createProject(candidate.id));
    await assets.saveAssetCandidate(candidate);

    expect(await assets.getAssetCandidate(candidate.id)).toEqual(candidate);
    expect(await readFile(path.join(tempDir, imageFilePath))).toEqual(Buffer.from("png-bytes"));
    expect(await assets.getAssetCandidatesForProject(candidate.projectId)).toEqual([candidate]);
    expect(mockedGetProject).toHaveBeenCalledWith(candidate.projectId, "test-user-id");
  });

  it("lists all asset candidates from SQLite", async () => {
    const assets = await loadRepository();
    const first = createAssetCandidate(path.join("data", "assets", "asset-1.png"));
    const second = { ...first, id: "asset-2", candidateIndex: 2, updatedAt: "2026-04-07T00:00:01.000Z" };

    await assets.saveAssetCandidate(second);
    await assets.saveAssetCandidate(first);

    expect((await assets.listAssetCandidates()).map((asset) => asset.id)).toEqual(["asset-1", "asset-2"]);
  });

  it("does not delete files outside data/assets when metadata stores an unsafe image path", async () => {
    const assets = await loadRepository();
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
