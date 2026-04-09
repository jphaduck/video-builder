import { beforeEach, describe, expect, it, vi } from "vitest";

const mockedGetProjectById = vi.fn();
const mockedSetProjectStatus = vi.fn();
const mockedGetTimelineDraftForProject = vi.fn();
const mockedBuildTimelineDraft = vi.fn();

vi.mock("@/modules/projects/repository", () => ({
  getProjectById: (...args: unknown[]) => mockedGetProjectById(...args),
  setProjectStatus: (...args: unknown[]) => mockedSetProjectStatus(...args),
}));

vi.mock("@/modules/timeline/service", () => ({
  getTimelineDraftForProject: (...args: unknown[]) => mockedGetTimelineDraftForProject(...args),
  buildTimelineDraft: (...args: unknown[]) => mockedBuildTimelineDraft(...args),
}));

describe("/api/projects/[projectId]/timeline", () => {
  const timelineDraft = { id: "timeline-1", projectId: "project-123" };

  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetProjectById.mockResolvedValue({ id: "project-123" });
    mockedGetTimelineDraftForProject.mockResolvedValue(timelineDraft);
    mockedBuildTimelineDraft.mockResolvedValue(timelineDraft);
    mockedSetProjectStatus.mockResolvedValue({ id: "project-123" });
  });

  it("returns the current timeline draft", async () => {
    const { GET } = await import("@/app/api/projects/[projectId]/timeline/route");
    const response = await GET({} as never, {
      params: Promise.resolve({ projectId: "project-123" }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ data: timelineDraft });
  });

  it("returns 400 when projectId is missing", async () => {
    const { GET } = await import("@/app/api/projects/[projectId]/timeline/route");
    const response = await GET({} as never, {
      params: Promise.resolve({ projectId: "   " }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Project ID is required." });
  });

  it("returns 404 when the project does not exist", async () => {
    mockedGetProjectById.mockResolvedValue(null);

    const { GET } = await import("@/app/api/projects/[projectId]/timeline/route");
    const response = await GET({} as never, {
      params: Promise.resolve({ projectId: "missing-project" }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Project not found." });
  });

  it("returns 500 for unexpected GET failures", async () => {
    mockedGetProjectById.mockRejectedValue(new Error("boom"));

    const { GET } = await import("@/app/api/projects/[projectId]/timeline/route");
    const response = await GET({} as never, {
      params: Promise.resolve({ projectId: "project-123" }),
    });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "Internal server error." });
  });

  it("builds a timeline draft on POST", async () => {
    const { POST } = await import("@/app/api/projects/[projectId]/timeline/route");
    const response = await POST({} as never, {
      params: Promise.resolve({ projectId: "project-123" }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ data: timelineDraft });
    expect(mockedBuildTimelineDraft).toHaveBeenCalledWith("project-123");
    expect(mockedSetProjectStatus).toHaveBeenCalledWith("project-123", "timeline_ready", {
      clearRenderJobIds: true,
    });
  });

  it("returns 404 for POST when the project does not exist", async () => {
    mockedGetProjectById.mockResolvedValue(null);

    const { POST } = await import("@/app/api/projects/[projectId]/timeline/route");
    const response = await POST({} as never, {
      params: Promise.resolve({ projectId: "missing-project" }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Project not found." });
  });

  it("returns 500 for unexpected POST failures", async () => {
    mockedBuildTimelineDraft.mockRejectedValue(new Error("boom"));

    const { POST } = await import("@/app/api/projects/[projectId]/timeline/route");
    const response = await POST({} as never, {
      params: Promise.resolve({ projectId: "project-123" }),
    });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "Internal server error." });
  });
});
