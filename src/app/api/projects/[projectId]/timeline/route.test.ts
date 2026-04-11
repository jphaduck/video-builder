import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockAuth, mockUnauthenticated } from "@/test/auth-mock";

const mockedGetProjectById = vi.fn();
const mockedSetProjectStatus = vi.fn();
const mockedGetTimelineDraftForProject = vi.fn();
const mockedBuildTimelineDraft = vi.fn();
const validProjectId = "11111111-1111-4111-8111-111111111111";
const missingProjectId = "22222222-2222-4222-8222-222222222222";

vi.mock("@/modules/projects/repository", () => ({
  getProjectById: (...args: unknown[]) => mockedGetProjectById(...args),
  setProjectStatus: (...args: unknown[]) => mockedSetProjectStatus(...args),
}));

vi.mock("@/modules/timeline/service", () => ({
  getTimelineDraftForProject: (...args: unknown[]) => mockedGetTimelineDraftForProject(...args),
  buildTimelineDraft: (...args: unknown[]) => mockedBuildTimelineDraft(...args),
}));

describe("/api/projects/[projectId]/timeline", () => {
  const timelineDraft = { id: "timeline-1", projectId: validProjectId };

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockAuth();
    mockedGetProjectById.mockResolvedValue({ id: validProjectId });
    mockedGetTimelineDraftForProject.mockResolvedValue(timelineDraft);
    mockedBuildTimelineDraft.mockResolvedValue(timelineDraft);
    mockedSetProjectStatus.mockResolvedValue({ id: validProjectId });
  });

  it("returns the current timeline draft", async () => {
    const { GET } = await import("@/app/api/projects/[projectId]/timeline/route");
    const response = await GET({} as never, {
      params: Promise.resolve({ projectId: validProjectId }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ data: timelineDraft });
    expect(mockedGetProjectById).toHaveBeenCalledWith(validProjectId, "test-user-id");
  });

  it("returns 400 when projectId is missing", async () => {
    const { GET } = await import("@/app/api/projects/[projectId]/timeline/route");
    const response = await GET({} as never, {
      params: Promise.resolve({ projectId: "   " }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Project ID is required." });
  });

  it("returns 400 when projectId is not a UUID", async () => {
    const { GET } = await import("@/app/api/projects/[projectId]/timeline/route");
    const response = await GET({} as never, {
      params: Promise.resolve({ projectId: "../captions/abc" }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid project ID." });
    expect(mockedGetProjectById).not.toHaveBeenCalled();
  });

  it("returns 404 when the project does not exist", async () => {
    mockedGetProjectById.mockResolvedValue(null);

    const { GET } = await import("@/app/api/projects/[projectId]/timeline/route");
    const response = await GET({} as never, {
      params: Promise.resolve({ projectId: missingProjectId }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Project not found." });
  });

  it("returns 401 when GET is unauthenticated", async () => {
    vi.resetModules();
    mockUnauthenticated();

    const { GET } = await import("@/app/api/projects/[projectId]/timeline/route");
    const response = await GET({} as never, {
      params: Promise.resolve({ projectId: validProjectId }),
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Authentication required." });
    expect(mockedGetProjectById).not.toHaveBeenCalled();
  });

  it("returns 500 for unexpected GET failures", async () => {
    mockedGetProjectById.mockRejectedValue(new Error("boom"));

    const { GET } = await import("@/app/api/projects/[projectId]/timeline/route");
    const response = await GET({} as never, {
      params: Promise.resolve({ projectId: validProjectId }),
    });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "Internal server error." });
  });

  it("builds a timeline draft on POST", async () => {
    const { POST } = await import("@/app/api/projects/[projectId]/timeline/route");
    const response = await POST({} as never, {
      params: Promise.resolve({ projectId: validProjectId }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ data: timelineDraft });
    expect(mockedBuildTimelineDraft).toHaveBeenCalledWith(validProjectId);
    expect(mockedSetProjectStatus).toHaveBeenCalledWith(validProjectId, "timeline_ready", {
      clearRenderJobIds: true,
    }, "test-user-id");
  });

  it("returns 400 for POST when projectId is not a UUID", async () => {
    const { POST } = await import("@/app/api/projects/[projectId]/timeline/route");
    const response = await POST({} as never, {
      params: Promise.resolve({ projectId: "../captions/abc" }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid project ID." });
    expect(mockedGetProjectById).not.toHaveBeenCalled();
    expect(mockedBuildTimelineDraft).not.toHaveBeenCalled();
  });

  it("returns 404 for POST when the project does not exist", async () => {
    mockedGetProjectById.mockResolvedValue(null);

    const { POST } = await import("@/app/api/projects/[projectId]/timeline/route");
    const response = await POST({} as never, {
      params: Promise.resolve({ projectId: missingProjectId }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Project not found." });
  });

  it("returns 401 when POST is unauthenticated", async () => {
    vi.resetModules();
    mockUnauthenticated();

    const { POST } = await import("@/app/api/projects/[projectId]/timeline/route");
    const response = await POST({} as never, {
      params: Promise.resolve({ projectId: validProjectId }),
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Authentication required." });
    expect(mockedBuildTimelineDraft).not.toHaveBeenCalled();
  });

  it("returns 500 for unexpected POST failures", async () => {
    mockedBuildTimelineDraft.mockRejectedValue(new Error("boom"));

    const { POST } = await import("@/app/api/projects/[projectId]/timeline/route");
    const response = await POST({} as never, {
      params: Promise.resolve({ projectId: validProjectId }),
    });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "Internal server error." });
  });
});
