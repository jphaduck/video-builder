import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockAuth, mockUnauthenticated } from "@/test/auth-mock";

const mockedGetProjectById = vi.fn();
const mockedGetLatestJobForProject = vi.fn();
const validProjectId = "11111111-1111-4111-8111-111111111111";
const missingProjectId = "22222222-2222-4222-8222-222222222222";

vi.mock("@/modules/projects/repository", () => ({
  getProjectById: (...args: unknown[]) => mockedGetProjectById(...args),
}));

vi.mock("@/modules/rendering/queue", () => ({
  getLatestJobForProject: (...args: unknown[]) => mockedGetLatestJobForProject(...args),
}));

describe("GET /api/projects/[projectId]/render/progress", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockAuth();
    mockedGetProjectById.mockResolvedValue({ id: validProjectId });
    mockedGetLatestJobForProject.mockResolvedValue({
      id: "render-1",
      projectId: validProjectId,
      timelineDraftId: "timeline-1",
      status: "complete",
      outputFilePath: `data/renders/${validProjectId}.mp4`,
      errorMessage: null,
      progressMessage: "Render complete.",
      createdAt: "2026-04-09T00:00:00.000Z",
      updatedAt: "2026-04-09T00:01:00.000Z",
    });
  });

  it("streams progress events for a valid request", async () => {
    const { GET } = await import("@/app/api/projects/[projectId]/render/progress/route");
    const response = await GET(new Request("http://localhost/render/progress"), {
      params: Promise.resolve({ projectId: validProjectId }),
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

  it("returns 400 when projectId is not a UUID", async () => {
    const { GET } = await import("@/app/api/projects/[projectId]/render/progress/route");
    const response = await GET(new Request("http://localhost/render/progress"), {
      params: Promise.resolve({ projectId: "../captions/abc" }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid project ID." });
    expect(mockedGetProjectById).not.toHaveBeenCalled();
    expect(mockedGetLatestJobForProject).not.toHaveBeenCalled();
  });

  it("returns 404 when the project does not exist", async () => {
    mockedGetProjectById.mockResolvedValue(null);

    const { GET } = await import("@/app/api/projects/[projectId]/render/progress/route");
    const response = await GET(new Request("http://localhost/render/progress"), {
      params: Promise.resolve({ projectId: missingProjectId }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Project not found." });
  });

  it("returns 401 when the request is unauthenticated", async () => {
    vi.resetModules();
    mockUnauthenticated();

    const { GET } = await import("@/app/api/projects/[projectId]/render/progress/route");
    const response = await GET(new Request("http://localhost/render/progress"), {
      params: Promise.resolve({ projectId: validProjectId }),
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Authentication required." });
    expect(mockedGetProjectById).not.toHaveBeenCalled();
  });

  it("returns 500 for unexpected preflight failures", async () => {
    mockedGetLatestJobForProject.mockRejectedValue(new Error("boom"));

    const { GET } = await import("@/app/api/projects/[projectId]/render/progress/route");
    const response = await GET(new Request("http://localhost/render/progress"), {
      params: Promise.resolve({ projectId: validProjectId }),
    });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "Internal server error." });
  });
});
