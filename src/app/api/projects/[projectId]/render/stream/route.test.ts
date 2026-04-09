import { beforeEach, describe, expect, it, vi } from "vitest";
import { Readable } from "node:stream";

const mockedGetProjectById = vi.fn();
const mockedGetLatestRenderJobForProject = vi.fn();
const mockedStat = vi.fn();
const mockedCreateReadStream = vi.fn();

vi.mock("@/modules/projects/repository", () => ({
  getProjectById: (...args: unknown[]) => mockedGetProjectById(...args),
}));

vi.mock("@/modules/rendering/repository", () => ({
  getLatestRenderJobForProject: (...args: unknown[]) => mockedGetLatestRenderJobForProject(...args),
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
    mockedGetProjectById.mockResolvedValue({ id: "project-123" });
    mockedGetLatestRenderJobForProject.mockResolvedValue({
      id: "render-1",
      outputFilePath: "data/renders/project-123.mp4",
    });
    mockedStat.mockResolvedValue({ size: 123 });
    mockedCreateReadStream.mockReturnValue(Readable.from(["video"]));
  });

  it("streams the rendered video when present", async () => {
    const { GET } = await import("@/app/api/projects/[projectId]/render/stream/route");
    const response = await GET({} as never, {
      params: Promise.resolve({ projectId: "project-123" }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("video/mp4");
    expect(response.headers.get("Content-Disposition")).toContain("project-123.mp4");
  });

  it("returns 400 when projectId is missing", async () => {
    const { GET } = await import("@/app/api/projects/[projectId]/render/stream/route");
    const response = await GET({} as never, {
      params: Promise.resolve({ projectId: "   " }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Project ID is required." });
  });

  it("returns 404 when the project is missing", async () => {
    mockedGetProjectById.mockResolvedValue(null);

    const { GET } = await import("@/app/api/projects/[projectId]/render/stream/route");
    const response = await GET({} as never, {
      params: Promise.resolve({ projectId: "missing-project" }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Project not found." });
  });

  it("returns 500 for unexpected stream failures", async () => {
    mockedStat.mockRejectedValue(new Error("boom"));

    const { GET } = await import("@/app/api/projects/[projectId]/render/stream/route");
    const response = await GET({} as never, {
      params: Promise.resolve({ projectId: "project-123" }),
    });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "Internal server error." });
  });
});
