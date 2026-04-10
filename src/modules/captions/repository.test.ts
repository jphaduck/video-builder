import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CaptionTrack } from "@/types/caption";

const fs = vi.hoisted(() => ({
  mkdir: vi.fn(),
  readFile: vi.fn(),
  rename: vi.fn(),
  unlink: vi.fn(),
  writeFile: vi.fn(),
}));

vi.mock("node:fs/promises", () => ({ ...fs, default: fs }));

function createTrack(): CaptionTrack {
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
        sceneId: null,
        sceneNumber: null,
        edited: false,
      },
    ],
    createdAt: "2026-04-09T00:00:00.000Z",
    updatedAt: "2026-04-09T00:00:00.000Z",
  };
}

async function loadRepository() {
  vi.resetModules();
  return import("@/modules/captions/repository");
}

beforeEach(() => {
  vi.clearAllMocks();
  fs.mkdir.mockResolvedValue(undefined);
  fs.readFile.mockResolvedValue("");
  fs.rename.mockResolvedValue(undefined);
  fs.unlink.mockResolvedValue(undefined);
  fs.writeFile.mockResolvedValue(undefined);
});

describe("captions repository", () => {
  it("saves a caption track and reloads the same data", async () => {
    const repo = await loadRepository();
    const track = createTrack();
    fs.readFile.mockResolvedValueOnce(JSON.stringify(track));

    await repo.saveCaptionTrack(track);
    await expect(repo.getCaptionTrack(track.id)).resolves.toEqual(track);
  });

  it("returns null when the track does not exist", async () => {
    const repo = await loadRepository();
    fs.readFile.mockRejectedValueOnce(Object.assign(new Error("missing"), { code: "ENOENT" }));

    await expect(repo.getCaptionTrack("missing-track")).resolves.toBeNull();
  });

  it("deletes caption files without throwing when the track file is already missing", async () => {
    const repo = await loadRepository();
    fs.unlink
      .mockRejectedValueOnce(Object.assign(new Error("missing track"), { code: "ENOENT" }))
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined);

    await expect(repo.deleteCaptionTrack("caption-1")).resolves.toBeUndefined();

    expect(fs.unlink).toHaveBeenCalledWith(path.join(process.cwd(), "data", "captions", "caption-1.json"));
    expect(fs.unlink).toHaveBeenCalledWith(path.join(process.cwd(), "data", "captions", "caption-1.srt"));
    expect(fs.unlink).toHaveBeenCalledWith(path.join(process.cwd(), "data", "captions", "caption-1.vtt"));
  });

  it("stores and reloads caption segments with the correct field types", async () => {
    const repo = await loadRepository();
    const track = createTrack();
    fs.readFile.mockResolvedValueOnce(JSON.stringify(track));

    const reloaded = await repo.getCaptionTrack(track.id);

    expect(reloaded?.segments[0]).toEqual(track.segments[0]);
    expect(typeof reloaded?.segments[0].startMs).toBe("number");
    expect(typeof reloaded?.segments[0].endMs).toBe("number");
    expect(typeof reloaded?.segments[0].text).toBe("string");
    expect(reloaded?.segments[0].sceneId).toBeNull();
    expect(reloaded?.segments[0].sceneNumber).toBeNull();
    expect(typeof reloaded?.segments[0].edited).toBe("boolean");
  });
});
