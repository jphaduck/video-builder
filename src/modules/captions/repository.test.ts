import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import type { CaptionTrack } from "@/types/caption";

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

function createTrack(): CaptionTrack {
  return {
    id: "caption-1",
    projectId: "project-1",
    narrationTrackId: "track-1",
    language: "en",
    source: "whisper",
    isStale: false,
    segments: [{ id: "segment-1", startMs: 0, endMs: 1200, text: "You pause at the threshold.", sceneId: null, sceneNumber: null, edited: false }],
    createdAt: "2026-04-09T00:00:00.000Z",
    updatedAt: "2026-04-09T00:00:00.000Z",
  };
}

async function loadRepository() {
  vi.resetModules();
  mockedAuth.mockResolvedValue({ user: { id: "test-user-id", name: "Test User", email: "test@test.com" } });
  return import("@/modules/captions/repository");
}

beforeEach(async () => {
  vi.clearAllMocks();
  tempDir = await mkdtemp(path.join(os.tmpdir(), "captions-repo-test-"));
  process.chdir(tempDir);
  process.env.STUDIO_DB_PATH = ":memory:";
  mockedGetProject.mockResolvedValue({ id: "project-1" });
});

afterEach(async () => {
  process.chdir(originalCwd);
  process.env.STUDIO_DB_PATH = originalDbPath;
  await rm(tempDir, { recursive: true, force: true });
});

describe("captions repository", () => {
  it("saves a caption track and reloads the same data", async () => {
    const repo = await loadRepository();
    const track = createTrack();

    await repo.saveCaptionTrack(track);
    await expect(repo.getCaptionTrack(track.id)).resolves.toEqual(track);
  });

  it("returns null when the track does not exist", async () => {
    const repo = await loadRepository();
    await expect(repo.getCaptionTrack("missing-track")).resolves.toBeNull();
  });

  it("returns null when the track belongs to a different user's project", async () => {
    const repo = await loadRepository();
    const track = createTrack();

    await repo.saveCaptionTrack(track);
    mockedGetProject.mockResolvedValue(null);

    await expect(repo.getCaptionTrack(track.id)).resolves.toBeNull();
  });

  it("deletes caption metadata and ignores missing export files", async () => {
    const repo = await loadRepository();
    const track = createTrack();

    await repo.saveCaptionTrack(track);
    await expect(repo.deleteCaptionTrack(track.id)).resolves.toBeUndefined();
    await expect(repo.getCaptionTrack(track.id)).resolves.toBeNull();
  });

  it("stores and reloads caption segments with the correct field types", async () => {
    const repo = await loadRepository();
    const track = createTrack();

    await repo.saveCaptionTrack(track);
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
