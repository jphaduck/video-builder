import { beforeEach, describe, expect, it, vi } from "vitest";
import { Readable } from "node:stream";

const mockedGetAssetCandidate = vi.fn();
const mockedAccess = vi.fn();
const mockedStat = vi.fn();
const mockedCreateReadStream = vi.fn();

vi.mock("@/modules/assets/repository", () => ({
  getAssetCandidate: (...args: unknown[]) => mockedGetAssetCandidate(...args),
}));

vi.mock("node:fs", () => ({
  default: {
    constants: { R_OK: 4 },
    createReadStream: (...args: unknown[]) => mockedCreateReadStream(...args),
  },
  constants: { R_OK: 4 },
  createReadStream: (...args: unknown[]) => mockedCreateReadStream(...args),
}));

vi.mock("node:fs/promises", () => ({
  default: {
    access: (...args: unknown[]) => mockedAccess(...args),
    stat: (...args: unknown[]) => mockedStat(...args),
  },
  access: (...args: unknown[]) => mockedAccess(...args),
  stat: (...args: unknown[]) => mockedStat(...args),
}));

describe("GET /api/assets/[assetId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetAssetCandidate.mockResolvedValue({
      id: "123e4567-e89b-42d3-a456-426614174000",
      imageFilePath: "data/assets/123e4567-e89b-42d3-a456-426614174000/image.png",
    });
    mockedAccess.mockResolvedValue(undefined);
    mockedStat.mockResolvedValue({ size: 12 });
    mockedCreateReadStream.mockReturnValue(Readable.from(["image"]));
  });

  it("streams an existing asset image", async () => {
    const { GET } = await import("@/app/api/assets/[assetId]/route");
    const response = await GET({} as never, {
      params: Promise.resolve({ assetId: "123e4567-e89b-42d3-a456-426614174000" }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/png");
    expect(mockedGetAssetCandidate).toHaveBeenCalledWith("123e4567-e89b-42d3-a456-426614174000");
  });

  it("returns 400 for an invalid asset id", async () => {
    const { GET } = await import("@/app/api/assets/[assetId]/route");
    const response = await GET({} as never, {
      params: Promise.resolve({ assetId: "not-a-uuid" }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid asset path." });
  });

  it("returns 404 when the asset does not exist", async () => {
    mockedGetAssetCandidate.mockResolvedValue(null);

    const { GET } = await import("@/app/api/assets/[assetId]/route");
    const response = await GET({} as never, {
      params: Promise.resolve({ assetId: "123e4567-e89b-42d3-a456-426614174000" }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Asset not found." });
  });

  it("returns 500 for unexpected repository failures", async () => {
    mockedGetAssetCandidate.mockRejectedValue(new Error("boom"));

    const { GET } = await import("@/app/api/assets/[assetId]/route");
    const response = await GET({} as never, {
      params: Promise.resolve({ assetId: "123e4567-e89b-42d3-a456-426614174000" }),
    });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "Internal server error." });
  });
});
