import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CaptionTrack } from "@/types/caption";

const originalCwd = process.cwd();
let tempDir = "";

function createCaptionTrack(overrides: Partial<CaptionTrack> = {}): CaptionTrack {
  const now = "2026-04-09T00:00:00.000Z";

  return {
    id: "caption-1",
    projectId: "project-1",
    narrationTrackId: "track-1",
    language: "en",
    source: "whisper",
    isStale: false,
    segments: [
      {
        id: "segment-1",
        startMs: 0,
        endMs: 1200,
        text: "You pause at the threshold.",
        sceneId: "scene-1",
        sceneNumber: 1,
        edited: false,
      },
    ],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

async function loadRepository() {
  vi.resetModules();
  return import("@/modules/captions/repository");
}

beforeEach(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), "captions-repo-test-"));
  process.chdir(tempDir);
});

afterEach(async () => {
  process.chdir(originalCwd);
  await rm(tempDir, { recursive: true, force: true });
});

describe("captions repository", () => {
  it("saves and reloads caption tracks", async () => {
    const { getCaptionTrack, saveCaptionTrack } = await loadRepository();
    const track = createCaptionTrack();

    await saveCaptionTrack(track);

    await expect(getCaptionTrack(track.id)).resolves.toEqual(track);
  });

  it("writes export sidecars and removes them with the track file", async () => {
    const { deleteCaptionTrack, saveCaptionExport, saveCaptionTrack } = await loadRepository();
    const track = createCaptionTrack();
    const captionsDir = path.join(tempDir, "data", "captions");
    const trackFilePath = path.join(captionsDir, `${track.id}.json`);
    const srtFilePath = path.join(captionsDir, `${track.id}.srt`);
    const vttFilePath = path.join(captionsDir, `${track.id}.vtt`);

    await saveCaptionTrack(track);
    await saveCaptionExport(track.id, "srt", "1\n00:00:00,000 --> 00:00:01,200\nYou pause at the threshold.");
    await saveCaptionExport(track.id, "vtt", "WEBVTT\n\n00:00:00.000 --> 00:00:01.200\nYou pause at the threshold.");

    await expect(readFile(srtFilePath, "utf8")).resolves.toContain("You pause at the threshold.");
    await expect(readFile(vttFilePath, "utf8")).resolves.toContain("WEBVTT");

    await deleteCaptionTrack(track.id);

    await expect(access(trackFilePath)).rejects.toMatchObject({ code: "ENOENT" });
    await expect(access(srtFilePath)).rejects.toMatchObject({ code: "ENOENT" });
    await expect(access(vttFilePath)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("throws a descriptive error when a caption track file is malformed", async () => {
    const { getCaptionTrack } = await loadRepository();
    const filePath = path.join(tempDir, "data", "captions", "caption-1.json");

    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, "{invalid json", "utf8");

    await expect(getCaptionTrack("caption-1")).rejects.toThrow("Failed to parse ");
    await expect(getCaptionTrack("caption-1")).rejects.toThrow("caption-1.json:");
  });
});
