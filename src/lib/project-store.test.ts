import { access, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Project } from "@/types/project";

const originalCwd = process.cwd();
let tempDir = "";
const userId = "user-1";
const otherUserId = "user-2";

function createProject(id = "project-1", overrides: Partial<Project> = {}): Project {
  const now = overrides.createdAt ?? "2026-04-11T00:00:00.000Z";

  return {
    id,
    name: `Project ${id}`,
    status: "draft",
    createdAt: now,
    updatedAt: overrides.updatedAt ?? now,
    storyInput: {
      premise: "A hidden system closes in.",
      targetRuntimeMin: 10,
    },
    scriptDrafts: [],
    workflow: {
      scriptDraftIds: [],
      sceneIds: [],
      assetIds: [],
      narrationTrackIds: [],
      captionTrackIds: [],
      renderJobIds: [],
    },
    ...overrides,
  };
}

async function loadStore() {
  vi.resetModules();
  return import("@/lib/project-store");
}

beforeEach(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), "project-store-test-"));
  process.chdir(tempDir);
});

afterEach(async () => {
  process.chdir(originalCwd);
  await rm(tempDir, { recursive: true, force: true });
});

describe("project store", () => {
  it("saves, loads, lists, and deletes projects in SQLite", async () => {
    const store = await loadStore();
    const older = createProject("project-1", { createdAt: "2026-04-10T00:00:00.000Z", updatedAt: "2026-04-10T00:00:00.000Z" });
    const newer = createProject("project-2", { createdAt: "2026-04-11T00:00:00.000Z", updatedAt: "2026-04-11T00:00:00.000Z" });

    await store.saveProject(older, userId);
    await store.saveProject(newer, userId);

    await expect(store.getProject("project-1", userId)).resolves.toEqual(older);
    await expect(store.getProject("project-1", otherUserId)).resolves.toBeNull();
    await expect(store.listProjects(userId)).resolves.toMatchObject([newer, older]);
    await expect(store.listProjects(otherUserId)).resolves.toEqual([]);

    await expect(store.deleteProject("project-1", otherUserId)).rejects.toThrow("Project not found: project-1");
    await store.deleteProject("project-1", userId);
    await expect(store.getProject("project-1", userId)).resolves.toBeNull();
    await expect(access(path.join(tempDir, "data", "studio.db"))).resolves.toBeUndefined();
  });

  it("migrates legacy JSON project files into SQLite on first access", async () => {
    const legacyProject = createProject("legacy-project");
    const legacyFilePath = path.join(tempDir, "data", "projects", "legacy-project.json");

    await mkdir(path.dirname(legacyFilePath), { recursive: true });
    await writeFile(legacyFilePath, JSON.stringify(legacyProject, null, 2), "utf8");

    const store = await loadStore();

    await expect(store.getProject("legacy-project", "")).resolves.toEqual(legacyProject);
    await expect(store.listProjects("")).resolves.toHaveLength(1);
  });
});
