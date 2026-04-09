import { beforeEach, describe, expect, it, vi } from "vitest";

const mockedGetProjectById = vi.fn();
const mockedGetLatestRenderJobForProject = vi.fn();
const mockedStartRenderForProject = vi.fn();

vi.mock("@/modules/projects/repository", () => ({
  getProjectById: (...args: unknown[]) => mockedGetProjectById(...args),
}));

vi.mock("@/modules/rendering/repository", () => ({
  getLatestRenderJobForProject: (...args: unknown[]) => mockedGetLatestRenderJobForProject(...args),
}));

vi.mock("@/modules/rendering/service", () => ({
  startRenderForProject: (...args: unknown[]) => mockedStartRenderForProject(...args),
}));

describe("/api/projects/[projectId]/render", () => {
  const job = { id: "render-1", projectId: "project-123", status: "pending" };

  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetProjectById.mockResolvedValue({ id: "project-123" });
    mockedGetLatestRenderJobForProject.mockResolvedValue(job);
    mockedStartRenderForProject.mockResolvedValue(job);
  });

  it("returns the current render status", async () => {
    const { GET } = await import("@/app/api/projects/[projectId]/render/route");
    const response = await GET({} as never, {
      params: Promise.resolve({ projectId: "project-123" }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: {
        job,
        renderStatus: "rendering",
      },
    });
  });

  it("returns 400 when projectId is missing", async () => {
    const { GET } = await import("@/app/api/projects/[projectId]/render/route");
    const response = await GET({} as never, {
      params: Promise.resolve({ projectId: "" }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Project ID is required." });
  });

  it("returns 404 when the project does not exist", async () => {
    mockedGetProjectById.mockResolvedValue(null);

    const { GET } = await import("@/app/api/projects/[projectId]/render/route");
    const response = await GET({} as never, {
      params: Promise.resolve({ projectId: "missing-project" }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Project not found." });
  });

  it("returns 500 for unexpected GET failures", async () => {
    mockedGetLatestRenderJobForProject.mockRejectedValue(new Error("boom"));

    const { GET } = await import("@/app/api/projects/[projectId]/render/route");
    const response = await GET({} as never, {
      params: Promise.resolve({ projectId: "project-123" }),
    });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "Internal server error." });
  });

  it("starts a render job on POST", async () => {
    const { POST } = await import("@/app/api/projects/[projectId]/render/route");
    const response = await POST({} as never, {
      params: Promise.resolve({ projectId: "project-123" }),
    });

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({ data: job });
  });

  it("returns 404 for POST when the project does not exist", async () => {
    mockedGetProjectById.mockResolvedValue(null);

    const { POST } = await import("@/app/api/projects/[projectId]/render/route");
    const response = await POST({} as never, {
      params: Promise.resolve({ projectId: "missing-project" }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Project not found." });
  });

  it("returns 500 for unexpected POST failures", async () => {
    mockedStartRenderForProject.mockRejectedValue(new Error("boom"));

    const { POST } = await import("@/app/api/projects/[projectId]/render/route");
    const response = await POST({} as never, {
      params: Promise.resolve({ projectId: "project-123" }),
    });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "Internal server error." });
  });
});
