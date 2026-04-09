import { access, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NarrationTrack } from "@/types/narration";

const originalCwd = process.cwd();
let tempDir = "";

function createTrack(overrides: Partial<NarrationTrack> = {}): NarrationTrack {
  const now = "2026-04-09T00:00:00.000Z";

  return {
    id: "track-1",
    projectId: "project-1",
    approvedScriptDraftId: "draft-1",
    approvedScenePlanId: "scene-plan-1",
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
        generatedAt: now,
      },
    ],
    totalDurationSeconds: 2.5,
    approvalStatus: "pending",
    source: "generated",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

async function loadRepository() {
  vi.resetModules();
  return import("@/modules/narration/repository");
}

beforeEach(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), "narration-repo-test-"));
  process.chdir(tempDir);
});

afterEach(async () => {
  process.chdir(originalCwd);
  await rm(tempDir, { recursive: true, force: true });
});

describe("narration repository", () => {
  it("backfills measured scene durations and total duration for legacy track files", async () => {
    const { getNarrationTrack } = await loadRepository();
    const legacyTrack = {
      ...createTrack(),
      totalDurationSeconds: undefined,
      scenes: [
        {
          sceneId: "scene-1",
          sceneNumber: 1,
          audioFilePath: path.join("data", "narration", "track-1", "scene-1.mp3"),
          durationSeconds: 2.5,
          generatedAt: "2026-04-09T00:00:00.000Z",
        },
        {
          sceneId: "scene-2",
          sceneNumber: 2,
          audioFilePath: path.join("data", "narration", "track-1", "scene-2.mp3"),
          durationSeconds: 3.25,
          generatedAt: "2026-04-09T00:00:01.000Z",
        },
      ],
    };

    const filePath = path.join(tempDir, "data", "narration", "track-1", "track.json");
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, JSON.stringify(legacyTrack, null, 2), "utf8");

    const track = await getNarrationTrack("track-1");

    expect(track).toMatchObject({
      id: "track-1",
      totalDurationSeconds: 5.75,
      scenes: [
        { sceneNumber: 1, durationSeconds: 2.5, measuredDurationSeconds: 2.5 },
        { sceneNumber: 2, durationSeconds: 3.25, measuredDurationSeconds: 3.25 },
      ],
    });
  });

  it("saves scene audio files under the track directory and returns a relative path", async () => {
    const { saveSceneAudioFile } = await loadRepository();

    const relativePath = await saveSceneAudioFile("track-1", 2, Buffer.from([1, 2, 3]));

    expect(relativePath).toBe(path.join("data", "narration", "track-1", "scene-2.mp3"));
    await expect(readFile(path.join(tempDir, relativePath))).resolves.toEqual(Buffer.from([1, 2, 3]));
  });

  it("deletes track metadata, expected audio files, and leftover files in the track directory", async () => {
    const { deleteNarrationTrack, saveNarrationTrack } = await loadRepository();
    const track = createTrack();
    const trackDir = path.join(tempDir, "data", "narration", track.id);
    const audioFilePath = path.join(tempDir, track.scenes[0].audioFilePath);
    const leftoverFilePath = path.join(trackDir, "orphan.tmp");

    await saveNarrationTrack(track);
    await writeFile(audioFilePath, "audio", "utf8");
    await writeFile(leftoverFilePath, "leftover", "utf8");

    await deleteNarrationTrack(track.id);

    await expect(access(path.join(trackDir, "track.json"))).rejects.toMatchObject({ code: "ENOENT" });
    await expect(access(audioFilePath)).rejects.toMatchObject({ code: "ENOENT" });
    await expect(access(leftoverFilePath)).rejects.toMatchObject({ code: "ENOENT" });
    await expect(access(trackDir)).rejects.toMatchObject({ code: "ENOENT" });
  });
});
