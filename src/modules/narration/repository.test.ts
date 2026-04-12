import { access, mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import type { NarrationTrack } from "@/types/narration";

const originalCwd = process.cwd();
const originalDbPath = process.env.STUDIO_DB_PATH;
let tempDir = "";

function createTrack(): NarrationTrack {
  return {
    id: "track-1",
    projectId: "project-1",
    approvedScriptDraftId: "draft-1",
    approvedScenePlanId: "plan-1",
    voiceName: "onyx",
    provider: "openai",
    speed: 1,
    style: null,
    pronunciationOverrides: {},
    scenes: [
      {
        sceneId: "scene-1",
        sceneNumber: 1,
        audioFilePath: path.join("data", "narration", "track-1", "scene-1.mp3"),
        durationSeconds: 2.5,
        measuredDurationSeconds: 2.5,
        generatedAt: "2026-04-09T00:00:00.000Z",
      },
    ],
    totalDurationSeconds: 2.5,
    approvalStatus: "pending",
    source: "generated",
    createdAt: "2026-04-09T00:00:00.000Z",
    updatedAt: "2026-04-09T00:00:00.000Z",
  };
}

async function loadRepository() {
  vi.resetModules();
  return import("@/modules/narration/repository");
}

beforeEach(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), "narration-repo-test-"));
  process.chdir(tempDir);
  process.env.STUDIO_DB_PATH = ":memory:";
});

afterEach(async () => {
  process.chdir(originalCwd);
  process.env.STUDIO_DB_PATH = originalDbPath;
  await rm(tempDir, { recursive: true, force: true });
});

describe("narration repository", () => {
  it("saves a narration track and reloads the same data", async () => {
    const repo = await loadRepository();
    const track = createTrack();

    await repo.saveNarrationTrack(track);
    await expect(repo.getNarrationTrack(track.id)).resolves.toEqual(track);
  });

  it("returns null when the track does not exist", async () => {
    const repo = await loadRepository();
    await expect(repo.getNarrationTrack("missing-track")).resolves.toBeNull();
  });

  it("deletes metadata and tolerates missing audio files", async () => {
    const repo = await loadRepository();
    const track = createTrack();
    const trackDir = path.join(tempDir, "data", "narration", track.id);

    await mkdir(trackDir, { recursive: true });
    await writeFile(path.join(trackDir, "notes.txt"), "leftover", "utf8");
    await repo.saveNarrationTrack(track);

    await expect(repo.deleteNarrationTrack(track.id)).resolves.toBeUndefined();
    await expect(repo.getNarrationTrack(track.id)).resolves.toBeNull();
    await expect(access(trackDir)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("saves scene audio under the track directory and returns a relative path", async () => {
    const repo = await loadRepository();
    const relativePath = await repo.saveSceneAudioFile("track-1", 2, Buffer.from([1, 2, 3]));

    expect(relativePath).toBe(path.join("data", "narration", "track-1", "scene-2.mp3"));
    await expect(access(path.join(tempDir, relativePath))).resolves.toBeUndefined();
  });
});
