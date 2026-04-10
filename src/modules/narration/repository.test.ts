import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NarrationTrack } from "@/types/narration";

const fs = vi.hoisted(() => ({
  mkdir: vi.fn(),
  readFile: vi.fn(),
  readdir: vi.fn(),
  rename: vi.fn(),
  rm: vi.fn(),
  unlink: vi.fn(),
  writeFile: vi.fn(),
}));

vi.mock("node:fs/promises", () => ({ ...fs, default: fs }));

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

beforeEach(() => {
  vi.clearAllMocks();
  fs.mkdir.mockResolvedValue(undefined);
  fs.writeFile.mockResolvedValue(undefined);
  fs.rename.mockResolvedValue(undefined);
  fs.readFile.mockResolvedValue("");
  fs.readdir.mockResolvedValue([]);
  fs.rm.mockResolvedValue(undefined);
  fs.unlink.mockResolvedValue(undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

describe("narration repository", () => {
  it("saves a narration track and reloads the same data", async () => {
    const repo = await loadRepository();
    const track = createTrack();
    fs.readFile.mockResolvedValueOnce(JSON.stringify(track));

    await repo.saveNarrationTrack(track);
    await expect(repo.getNarrationTrack(track.id)).resolves.toEqual(track);
  });

  it("returns null when the track does not exist", async () => {
    const repo = await loadRepository();
    fs.readFile.mockRejectedValueOnce(Object.assign(new Error("missing"), { code: "ENOENT" }));

    await expect(repo.getNarrationTrack("missing-track")).resolves.toBeNull();
  });

  it("deletes metadata and tolerates missing audio files", async () => {
    const repo = await loadRepository();
    const track = createTrack();
    fs.readFile.mockResolvedValueOnce(JSON.stringify(track));
    fs.unlink
      .mockRejectedValueOnce(Object.assign(new Error("missing audio"), { code: "ENOENT" }))
      .mockResolvedValueOnce(undefined);

    await expect(repo.deleteNarrationTrack(track.id)).resolves.toBeUndefined();

    expect(fs.unlink).toHaveBeenCalledWith(path.join(process.cwd(), track.scenes[0].audioFilePath));
    expect(fs.unlink).toHaveBeenCalledWith(path.join(process.cwd(), "data", "narration", track.id, "track.json"));
    expect(fs.rm).toHaveBeenCalledWith(path.join(process.cwd(), "data", "narration", track.id), {
      recursive: true,
      force: true,
    });
  });

  it("saves scene audio under the track directory and returns a relative path", async () => {
    const repo = await loadRepository();

    const relativePath = await repo.saveSceneAudioFile("track-1", 2, Buffer.from([1, 2, 3]));

    expect(relativePath).toBe(path.join("data", "narration", "track-1", "scene-2.mp3"));
    expect(fs.rename).toHaveBeenCalledWith(expect.any(String), path.join(process.cwd(), relativePath));
  });
});
