import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const authState = vi.hoisted(() => ({
  session: null as { user: { id: string } } | null,
}));

vi.mock("@/auth", () => ({
  auth: (handler: (req: { auth: typeof authState.session; nextUrl: URL; url: string }) => Response | void) => {
    return (request: NextRequest) =>
      handler({
        auth: authState.session,
        nextUrl: request.nextUrl,
        url: request.url,
      });
  },
}));

describe("middleware", () => {
  beforeEach(() => {
    vi.resetModules();
    authState.session = null;
  });

  it("redirects unauthenticated project pages to sign-in", async () => {
    const middleware = (await import("@/middleware")).default;
    const response = await middleware(new NextRequest("http://localhost/projects"), {} as never);

    expect(response?.status).toBe(307);
    expect(response?.headers.get("location")).toBe("http://localhost/api/auth/signin");
  });

  it("redirects unauthenticated project APIs to sign-in", async () => {
    const middleware = (await import("@/middleware")).default;
    const response = await middleware(new NextRequest("http://localhost/api/projects/test"), {} as never);

    expect(response?.status).toBe(307);
    expect(response?.headers.get("location")).toBe("http://localhost/api/auth/signin");
  });

  it("allows the homepage without a session", async () => {
    const middleware = (await import("@/middleware")).default;
    const response = await middleware(new NextRequest("http://localhost/"), {} as never);

    expect(response).toBeUndefined();
  });

  it("allows authenticated project pages", async () => {
    authState.session = { user: { id: "user-1" } };

    const middleware = (await import("@/middleware")).default;
    const response = await middleware(new NextRequest("http://localhost/projects"), {} as never);

    expect(response).toBeUndefined();
  });

  it("allows auth endpoints without a session", async () => {
    const middleware = (await import("@/middleware")).default;
    const response = await middleware(new NextRequest("http://localhost/api/auth/signin"), {} as never);

    expect(response).toBeUndefined();
  });
});
