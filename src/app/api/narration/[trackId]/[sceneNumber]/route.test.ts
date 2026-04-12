import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Readable } from "node:stream";
import { mockAuth, mockUnauthenticated } from "@/test/auth-mock";

const mockedCreateReadStream = vi.fn();
const mockedAccess = vi.fn();
const mockedStat = vi.fn();
const mockedGetNarrationTrack = vi.fn();

vi.mock("node:fs", () => ({
  default: {
    createReadStream: (...args: unknown[]) => mockedCreateReadStream(...args),
    constants: {
      R_OK: 4,
    },
  },
  createReadStream: (...args: unknown[]) => mockedCreateReadStream(...args),
  constants: {
    R_OK: 4,
  },
}));

vi.mock("node:fs/promises", () => ({
  default: {
    access: (...args: unknown[]) => mockedAccess(...args),
    stat: (...args: unknown[]) => mockedStat(...args),
  },
  access: (...args: unknown[]) => mockedAccess(...args),
  stat: (...args: unknown[]) => mockedStat(...args),
}));

vi.mock("@/modules/narration/repository", () => ({
  getNarrationTrack: (...args: unknown[]) => mockedGetNarrationTrack(...args),
}));

describe("GET /api/narration/[trackId]/[sceneNumber]", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockAuth();
    mockedAccess.mockResolvedValue(undefined);
    mockedStat.mockResolvedValue({ size: 5 });
    mockedCreateReadStream.mockReturnValue(Readable.from(["audio"]));
    mockedGetNarrationTrack.mockResolvedValue({
      id: "123e4567-e89b-42d3-a456-426614174000",
      projectId: "project-1",
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 400 for an invalid track id", async () => {
    const { GET } = await import("@/app/api/narration/[trackId]/[sceneNumber]/route");
    const response = await GET({} as never, {
      params: Promise.resolve({ trackId: "not-a-uuid", sceneNumber: "1" }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid narration asset path." });
  });

  it("returns 400 for an invalid scene number", async () => {
    const { GET } = await import("@/app/api/narration/[trackId]/[sceneNumber]/route");
    const response = await GET({} as never, {
      params: Promise.resolve({ trackId: "123e4567-e89b-12d3-a456-426614174000", sceneNumber: "../1" }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid narration asset path." });
  });

  it("returns 404 when the audio file is missing", async () => {
    mockedAccess.mockRejectedValue(Object.assign(new Error("missing"), { code: "ENOENT" }));
    const { GET } = await import("@/app/api/narration/[trackId]/[sceneNumber]/route");
    const response = await GET({} as never, {
      params: Promise.resolve({ trackId: "123e4567-e89b-42d3-a456-426614174000", sceneNumber: "2" }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Narration audio not found." });
  });

  it("returns 404 when the narration track belongs to a different user", async () => {
    mockedGetNarrationTrack.mockResolvedValue(null);

    const { GET } = await import("@/app/api/narration/[trackId]/[sceneNumber]/route");
    const response = await GET({} as never, {
      params: Promise.resolve({ trackId: "123e4567-e89b-42d3-a456-426614174000", sceneNumber: "2" }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Narration audio not found." });
  });

  it("returns 401 when the request is unauthenticated", async () => {
    vi.resetModules();
    mockUnauthenticated();

    const { GET } = await import("@/app/api/narration/[trackId]/[sceneNumber]/route");
    const response = await GET({} as never, {
      params: Promise.resolve({ trackId: "123e4567-e89b-42d3-a456-426614174000", sceneNumber: "2" }),
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Authentication required." });
    expect(mockedGetNarrationTrack).not.toHaveBeenCalled();
  });

  it("returns 500 for unexpected filesystem failures", async () => {
    mockedStat.mockRejectedValue(new Error("boom"));

    const { GET } = await import("@/app/api/narration/[trackId]/[sceneNumber]/route");
    const response = await GET({} as never, {
      params: Promise.resolve({ trackId: "123e4567-e89b-42d3-a456-426614174000", sceneNumber: "2" }),
    });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "Internal server error." });
  });

  it("streams the audio file for valid requests", async () => {
    const { GET } = await import("@/app/api/narration/[trackId]/[sceneNumber]/route");
    const response = await GET({} as never, {
      params: Promise.resolve({ trackId: "123e4567-e89b-42d3-a456-426614174000", sceneNumber: "2" }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("audio/mpeg");
    expect(mockedGetNarrationTrack).toHaveBeenCalledWith("123e4567-e89b-42d3-a456-426614174000");
    expect(mockedCreateReadStream).toHaveBeenCalledTimes(1);
    expect(mockedStat).toHaveBeenCalledTimes(1);
  });
});
