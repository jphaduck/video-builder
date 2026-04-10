import { beforeEach, describe, expect, it, vi } from "vitest";

const mockedGetProjectById = vi.fn();
const mockedEnqueueRender = vi.fn();
const mockedGetJobStatus = vi.fn();
const mockedGetLatestJobForProject = vi.fn();
const validProjectId = "11111111-1111-4111-8111-111111111111";
const missingProjectId = "22222222-2222-4222-8222-222222222222";

vi.mock("@/modules/projects/repository", () => ({
  getProjectById: (...args: unknown[]) => mockedGetProjectById(...args),
}));

vi.mock("@/modules/rendering/queue", () => ({
  enqueueRender: (...args: unknown[]) => mockedEnqueueRender(...args),
  getJobStatus: (...args: unknown[]) => mockedGetJobStatus(...args),
  getLatestJobForProject: (...args: unknown[]) => mockedGetLatestJobForProject(...args),
}));

describe("/api/projects/[projectId]/render", () => {
  const job = { id: "render-1", projectId: validProjectId, timelineDraftId: "timeline-1", status: "queued" };

  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetProjectById.mockResolvedValue({ id: validProjectId });
    mockedGetLatestJobForProject.mockResolvedValue(job);
    mockedEnqueueRender.mockResolvedValue("render-1");
    mockedGetJobStatus.mockResolvedValue(job);
  });

  it("returns the current render status", async () => {
    const { GET } = await import("@/app/api/projects/[projectId]/render/route");
    const response = await GET({} as never, {
      params: Promise.resolve({ projectId: validProjectId }),
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

  it("returns 400 when projectId is not a UUID", async () => {
    const { GET } = await import("@/app/api/projects/[projectId]/render/route");
    const response = await GET({} as never, {
      params: Promise.resolve({ projectId: "../captions/abc" }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid project ID." });
    expect(mockedGetProjectById).not.toHaveBeenCalled();
    expect(mockedGetLatestJobForProject).not.toHaveBeenCalled();
  });

  it("returns 404 when the project does not exist", async () => {
    mockedGetProjectById.mockResolvedValue(null);

    const { GET } = await import("@/app/api/projects/[projectId]/render/route");
    const response = await GET({} as never, {
      params: Promise.resolve({ projectId: missingProjectId }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Project not found." });
  });

  it("returns 500 for unexpected GET failures", async () => {
    mockedGetLatestJobForProject.mockRejectedValue(new Error("boom"));

    const { GET } = await import("@/app/api/projects/[projectId]/render/route");
    const response = await GET({} as never, {
      params: Promise.resolve({ projectId: validProjectId }),
    });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "Internal server error." });
  });

  it("queues a render job on POST", async () => {
    const { POST } = await import("@/app/api/projects/[projectId]/render/route");
    const response = await POST({} as never, {
      params: Promise.resolve({ projectId: validProjectId }),
    });

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({ data: { ...job, jobId: "render-1" } });
  });

  it("returns 400 for POST when projectId is not a UUID", async () => {
    const { POST } = await import("@/app/api/projects/[projectId]/render/route");
    const response = await POST({} as never, {
      params: Promise.resolve({ projectId: "../captions/abc" }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid project ID." });
    expect(mockedGetProjectById).not.toHaveBeenCalled();
    expect(mockedEnqueueRender).not.toHaveBeenCalled();
  });

  it("returns 404 for POST when the project does not exist", async () => {
    mockedGetProjectById.mockResolvedValue(null);

    const { POST } = await import("@/app/api/projects/[projectId]/render/route");
    const response = await POST({} as never, {
      params: Promise.resolve({ projectId: missingProjectId }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Project not found." });
  });

  it("returns 500 for unexpected POST failures", async () => {
    mockedEnqueueRender.mockRejectedValue(new Error("boom"));

    const { POST } = await import("@/app/api/projects/[projectId]/render/route");
    const response = await POST({} as never, {
      params: Promise.resolve({ projectId: validProjectId }),
    });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "Internal server error." });
  });
});
