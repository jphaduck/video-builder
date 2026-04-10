import { beforeEach, describe, expect, it, vi } from "vitest";
import { Readable } from "node:stream";

const mockedGetProjectById = vi.fn();
const mockedGetLatestJobForProject = vi.fn();
const mockedStat = vi.fn();
const mockedCreateReadStream = vi.fn();
const validProjectId = "11111111-1111-4111-8111-111111111111";
const missingProjectId = "22222222-2222-4222-8222-222222222222";

vi.mock("@/modules/projects/repository", () => ({
  getProjectById: (...args: unknown[]) => mockedGetProjectById(...args),
}));

vi.mock("@/modules/rendering/queue", () => ({
  getLatestJobForProject: (...args: unknown[]) => mockedGetLatestJobForProject(...args),
}));

vi.mock("node:fs", () => ({
  default: {
    createReadStream: (...args: unknown[]) => mockedCreateReadStream(...args),
  },
  createReadStream: (...args: unknown[]) => mockedCreateReadStream(...args),
}));

vi.mock("node:fs/promises", () => ({
  default: {
    stat: (...args: unknown[]) => mockedStat(...args),
  },
  stat: (...args: unknown[]) => mockedStat(...args),
}));

describe("GET /api/projects/[projectId]/render/stream", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetProjectById.mockResolvedValue({ id: validProjectId });
    mockedGetLatestJobForProject.mockResolvedValue({
      id: "render-1",
      outputFilePath: `data/renders/${validProjectId}.mp4`,
    });
    mockedStat.mockResolvedValue({ size: 123 });
    mockedCreateReadStream.mockReturnValue(Readable.from(["video"]));
  });

  it("streams the rendered video when present", async () => {
    const { GET } = await import("@/app/api/projects/[projectId]/render/stream/route");
    const response = await GET({} as never, {
      params: Promise.resolve({ projectId: validProjectId }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("video/mp4");
    expect(response.headers.get("Content-Disposition")).toContain(`${validProjectId}.mp4`);
  });

  it("returns 400 when projectId is missing", async () => {
    const { GET } = await import("@/app/api/projects/[projectId]/render/stream/route");
    const response = await GET({} as never, {
      params: Promise.resolve({ projectId: "   " }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Project ID is required." });
  });

  it("returns 400 when projectId is not a UUID", async () => {
    const { GET } = await import("@/app/api/projects/[projectId]/render/stream/route");
    const response = await GET({} as never, {
      params: Promise.resolve({ projectId: "../captions/abc" }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid project ID." });
    expect(mockedGetProjectById).not.toHaveBeenCalled();
    expect(mockedGetLatestJobForProject).not.toHaveBeenCalled();
  });

  it("returns 404 when the project is missing", async () => {
    mockedGetProjectById.mockResolvedValue(null);

    const { GET } = await import("@/app/api/projects/[projectId]/render/stream/route");
    const response = await GET({} as never, {
      params: Promise.resolve({ projectId: missingProjectId }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Project not found." });
  });

  it("returns 400 when the persisted render output path escapes the renders directory", async () => {
    mockedGetLatestJobForProject.mockResolvedValue({
      id: "render-1",
      outputFilePath: "../secrets.mp4",
    });

    const { GET } = await import("@/app/api/projects/[projectId]/render/stream/route");
    const response = await GET({} as never, {
      params: Promise.resolve({ projectId: validProjectId }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid render output path." });
    expect(mockedStat).not.toHaveBeenCalled();
    expect(mockedCreateReadStream).not.toHaveBeenCalled();
  });

  it("returns 500 for unexpected stream failures", async () => {
    mockedStat.mockRejectedValue(new Error("boom"));

    const { GET } = await import("@/app/api/projects/[projectId]/render/stream/route");
    const response = await GET({} as never, {
      params: Promise.resolve({ projectId: validProjectId }),
    });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "Internal server error." });
  });
});
