import { beforeEach, describe, expect, it, vi } from "vitest";

const mockedDeleteProjectById = vi.fn();

vi.mock("@/modules/projects/repository", () => ({
  deleteProjectById: (...args: unknown[]) => mockedDeleteProjectById(...args),
}));

describe("DELETE /api/projects/[projectId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedDeleteProjectById.mockResolvedValue(undefined);
  });

  it("deletes the project and returns data", async () => {
    const { DELETE } = await import("@/app/api/projects/[projectId]/route");
    const response = await DELETE({} as never, {
      params: Promise.resolve({ projectId: "project-123" }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ data: { deleted: true } });
    expect(mockedDeleteProjectById).toHaveBeenCalledWith("project-123");
  });

  it("returns 400 when projectId is missing", async () => {
    const { DELETE } = await import("@/app/api/projects/[projectId]/route");
    const response = await DELETE({} as never, {
      params: Promise.resolve({ projectId: "   " }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Project ID is required." });
  });

  it("returns 404 when the project is missing", async () => {
    mockedDeleteProjectById.mockRejectedValue(new Error("Project not found: missing-project"));

    const { DELETE } = await import("@/app/api/projects/[projectId]/route");
    const response = await DELETE({} as never, {
      params: Promise.resolve({ projectId: "missing-project" }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Project not found: missing-project" });
  });

  it("returns 500 for unexpected failures", async () => {
    mockedDeleteProjectById.mockRejectedValue(new Error("boom"));

    const { DELETE } = await import("@/app/api/projects/[projectId]/route");
    const response = await DELETE({} as never, {
      params: Promise.resolve({ projectId: "project-123" }),
    });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "Internal server error." });
  });
});
