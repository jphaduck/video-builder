import { access, mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
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
    storyInput: {
      premise: "A sealed letter starts a quiet bureaucratic collapse.",
      targetRuntimeMin: 5,
    },
    scriptDrafts: [],
    workflow: {
      scriptDraftIds: [],
      sceneIds,
      assetIds: [],
      narrationTrackIds: [],
      captionTrackIds: [],
      renderJobIds: [],
    },
  };
}

async function loadRepository() {
  vi.resetModules();
  mockedAuth.mockResolvedValue({
    user: { id: "test-user-id", name: "Test User", email: "test@test.com" },
  });
  return import("@/modules/scenes/repository");
}

beforeEach(async () => {
  vi.clearAllMocks();
  tempDir = await mkdtemp(path.join(os.tmpdir(), "scenes-repo-test-"));
  process.chdir(tempDir);
  mockedGetProject.mockResolvedValue(null);
});

afterEach(async () => {
  process.chdir(originalCwd);
  await rm(tempDir, { recursive: true, force: true });
});

describe("scenes repository", () => {
  it("saves and reloads scene files", async () => {
    const { getScene, saveScene } = await loadRepository();
    const scene = createScene();

    await saveScene(scene);

    await expect(getScene(scene.id)).resolves.toEqual(scene);
  });

  it("returns project scenes ordered by scene number and creation time while skipping missing files", async () => {
    const { getScenesForProject, saveScene } = await loadRepository();
    const first = createScene({
      id: "scene-1",
      sceneNumber: 2,
      createdAt: "2026-04-09T00:00:02.000Z",
    });
    const second = createScene({
      id: "scene-2",
      sceneNumber: 1,
      createdAt: "2026-04-09T00:00:03.000Z",
      heading: "The first warning lands",
    });
    const third = createScene({
      id: "scene-3",
      sceneNumber: 2,
      createdAt: "2026-04-09T00:00:01.000Z",
      heading: "A quieter earlier beat",
    });

    mockedGetProject.mockResolvedValue(createProject(["missing-scene", first.id, second.id, third.id]));

    await saveScene(first);
    await saveScene(second);
    await saveScene(third);

    const scenes = await getScenesForProject("project-1");

    expect(scenes.map((scene) => scene.id)).toEqual(["scene-2", "scene-3", "scene-1"]);
    expect(mockedGetProject).toHaveBeenCalledWith("project-1", "test-user-id");
  });

  it("deletes persisted scene files", async () => {
    const { deleteScene, saveScene } = await loadRepository();
    const scene = createScene();
    const sceneFilePath = path.join(tempDir, "data", "scenes", `${scene.id}.json`);

    await saveScene(scene);
    await deleteScene(scene.id);

    await expect(access(sceneFilePath)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("throws a descriptive error when a scene file is malformed", async () => {
    const { getScene } = await loadRepository();
    const filePath = path.join(tempDir, "data", "scenes", "scene-1.json");

    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, "{invalid json", "utf8");

    await expect(getScene("scene-1")).rejects.toThrow("Failed to parse ");
    await expect(getScene("scene-1")).rejects.toThrow("scene-1.json:");
  });
});
