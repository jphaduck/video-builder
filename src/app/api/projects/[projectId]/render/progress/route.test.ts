import { beforeEach, describe, expect, it, vi } from "vitest";

const mockedGetProjectById = vi.fn();
const mockedGetLatestRenderJobForProject = vi.fn();

vi.mock("@/modules/projects/repository", () => ({
  getProjectById: (...args: unknown[]) => mockedGetProjectById(...args),
}));

vi.mock("@/modules/rendering/repository", () => ({
  getLatestRenderJobForProject: (...args: unknown[]) => mockedGetLatestRenderJobForProject(...args),
}));

describe("GET /api/projects/[projectId]/render/progress", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetProjectById.mockResolvedValue({ id: "project-123" });
    mockedGetLatestRenderJobForProject.mockResolvedValue({
      id: "render-1",
      projectId: "project-123",
      timelineDraftId: "timeline-1",
      status: "complete",
      outputFilePath: "data/renders/project-123.mp4",
      errorMessage: null,
      progressMessage: "Render complete.",
      createdAt: "2026-04-09T00:00:00.000Z",
      updatedAt: "2026-04-09T00:01:00.000Z",
    });
  });

  it("streams progress events for a valid request", async () => {
    const { GET } = await import("@/app/api/projects/[projectId]/render/progress/route");
    const response = await GET(new Request("http://localhost/render/progress"), {
      params: Promise.resolve({ projectId: "project-123" }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/event-stream");
    await expect(response.text()).resolves.toContain("\"status\":\"complete\"");
  });

  it("returns 400 when projectId is missing", async () => {
    const { GET } = await import("@/app/api/projects/[projectId]/render/progress/route");
    const response = await GET(new Request("http://localhost/render/progress"), {
      params: Promise.resolve({ projectId: "" }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Project ID is required." });
  });

  it("returns 404 when the project does not exist", async () => {
    mockedGetProjectById.mockResolvedValue(null);

    const { GET } = await import("@/app/api/projects/[projectId]/render/progress/route");
    const response = await GET(new Request("http://localhost/render/progress"), {
      params: Promise.resolve({ projectId: "missing-project" }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Project not found." });
  });

  it("returns 500 for unexpected preflight failures", async () => {
    mockedGetLatestRenderJobForProject.mockRejectedValue(new Error("boom"));

    const { GET } = await import("@/app/api/projects/[projectId]/render/progress/route");
    const response = await GET(new Request("http://localhost/render/progress"), {
      params: Promise.resolve({ projectId: "project-123" }),
    });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "Internal server error." });
  });
});
