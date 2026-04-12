import { vi } from "vitest";

export function mockAuth(userId = "test-user-id") {
  vi.doUnmock("@/auth");
  vi.doMock("@/auth", () => ({
    auth: vi.fn().mockResolvedValue({
      user: { id: userId, name: "Test User", email: "test@test.com" },
    }),
  }));
}

export function mockUnauthenticated() {
  vi.doUnmock("@/auth");
  vi.doMock("@/auth", () => ({
    auth: vi.fn().mockResolvedValue(null),
  }));
}
