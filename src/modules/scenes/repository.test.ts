import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Project } from "@/types/project";
import type { Scene } from "@/types/scene";

const mockedGetProject = vi.fn();
const mockedAuth = vi.fn();

vi.mock("@/auth", () => ({
  auth: (...args: unknown[]) => mockedAuth(...args),
}));

vi.mock("@/lib/project-store", () => ({
  getProject: (...args: unknown[]) => mockedGetProject(...args),
  getProjectByAnyOwner: (...args: unknown[]) => mockedGetProject(...args),
}));

const originalCwd = process.cwd();
const originalDbPath = process.env.STUDIO_DB_PATH;
let tempDir = "";

function createScene(overrides: Partial<Scene> = {}): Scene {
  const now = "2026-04-09T00:00:00.000Z";
  return {
    id: "scene-1",
    projectId: "project-1",
    approvedScriptDraftId: "draft-1",
    sceneNumber: 1,
    heading: "An envelope appears on the desk",
    scriptExcerpt: "An unsigned envelope waits where there should be nothing.",
    sceneSummary: "Introduce the first unexplained disruption.",
    durationTargetSeconds: 12,
    visualIntent: "Quiet suspense in a fluorescent office.",
    imagePrompt: "cinematic office desk with a sealed envelope, suspenseful lighting",
    promptVersion: 1,
    approvalStatus: "pending",
    source: "generated",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function createProject(sceneIds: string[]): Project {
  const now = "2026-04-09T00:00:00.000Z";
  return {
    id: "project-1",
    name: "Project One",
    status: "scene_ready",
    createdAt: now,
    updatedAt: now,
    storyInput: { premise: "A sealed letter starts a quiet bureaucratic collapse.", targetRuntimeMin: 5 },
    scriptDrafts: [],
    workflow: { scriptDraftIds: [], sceneIds, assetIds: [], narrationTrackIds: [], captionTrackIds: [], renderJobIds: [] },
  };
}

async function loadRepository() {
  vi.resetModules();
  mockedAuth.mockResolvedValue({ user: { id: "test-user-id", name: "Test User", email: "test@test.com" } });
  return import("@/modules/scenes/repository");
}

beforeEach(async () => {
  vi.clearAllMocks();
  tempDir = await mkdtemp(path.join(os.tmpdir(), "scenes-repo-test-"));
  process.chdir(tempDir);
  process.env.STUDIO_DB_PATH = ":memory:";
  mockedGetProject.mockResolvedValue(null);
});

afterEach(async () => {
  process.chdir(originalCwd);
  process.env.STUDIO_DB_PATH = originalDbPath;
  await rm(tempDir, { recursive: true, force: true });
});

describe("scenes repository", () => {
  it("saves, reloads, and deletes scenes from SQLite", async () => {
    const { deleteScene, getScene, saveScene } = await loadRepository();
    const scene = createScene();

    await saveScene(scene);
    await expect(getScene(scene.id)).resolves.toEqual(scene);

    await deleteScene(scene.id);
    await expect(getScene(scene.id)).resolves.toBeNull();
  });

  it("returns project scenes ordered by scene number and creation time", async () => {
    const { getScenesForProject, saveScene } = await loadRepository();
    const first = createScene({ id: "scene-1", sceneNumber: 2, createdAt: "2026-04-09T00:00:02.000Z" });
    const second = createScene({ id: "scene-2", sceneNumber: 1, createdAt: "2026-04-09T00:00:03.000Z" });
    const third = createScene({ id: "scene-3", sceneNumber: 2, createdAt: "2026-04-09T00:00:01.000Z" });

    mockedGetProject.mockResolvedValue(createProject([first.id, second.id, third.id]));
    await Promise.all([saveScene(first), saveScene(second), saveScene(third)]);

    const scenes = await getScenesForProject("project-1");
    expect(scenes.map((scene) => scene.id)).toEqual(["scene-2", "scene-3", "scene-1"]);
    expect(mockedGetProject).toHaveBeenCalledWith("project-1", "test-user-id");
  });

  it("migrates legacy scene JSON files into SQLite on first access", async () => {
    const legacyScene = createScene();
    const legacyFilePath = path.join(tempDir, "data", "scenes", "scene-1.json");

    await mkdir(path.dirname(legacyFilePath), { recursive: true });
    await writeFile(legacyFilePath, JSON.stringify(legacyScene, null, 2), "utf8");

    const { getScene } = await loadRepository();
    await expect(getScene("scene-1")).resolves.toEqual(legacyScene);
  });
});
