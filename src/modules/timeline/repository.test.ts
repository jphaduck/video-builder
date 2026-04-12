import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TimelineDraft } from "@/modules/timeline/types";

const mockedGetProject = vi.fn();
const mockedAuth = vi.fn();

vi.mock("@/auth", () => ({
  auth: (...args: unknown[]) => mockedAuth(...args),
}));

vi.mock("@/lib/project-store", () => ({
  getProject: (...args: unknown[]) => mockedGetProject(...args),
  getProjectByAnyOwner: (...args: unknown[]) => mockedGetProject(...args),
}));

const originalCwd = process.cwd();
const originalDbPath = process.env.STUDIO_DB_PATH;
let tempDir = "";

function createDraft(overrides: Partial<TimelineDraft> = {}): TimelineDraft {
  const now = "2026-04-09T00:00:00.000Z";
  return {
    id: "timeline-1",
    projectId: "project-1",
    scenes: [],
    assets: [],
    narrationTrack: {
      id: "track-1",
      projectId: "project-1",
      approvedScriptDraftId: "draft-1",
      approvedScenePlanId: "plan-1",
      voiceName: "onyx",
      provider: "openai",
      speed: 1,
      style: null,
      pronunciationOverrides: {},
      scenes: [],
      totalDurationSeconds: 0,
      approvalStatus: "approved",
      source: "generated",
      createdAt: now,
      updatedAt: now,
    },
    captionTrack: {
      id: "caption-1",
      projectId: "project-1",
      narrationTrackId: "track-1",
      language: "en",
      source: "whisper",
      isStale: false,
      segments: [],
      createdAt: now,
      updatedAt: now,
    },
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

async function loadRepository() {
  vi.resetModules();
  mockedAuth.mockResolvedValue({ user: { id: "test-user-id", name: "Test User", email: "test@test.com" } });
  return import("@/modules/timeline/repository");
}

beforeEach(async () => {
  vi.clearAllMocks();
  tempDir = await mkdtemp(path.join(os.tmpdir(), "timeline-repo-test-"));
  process.chdir(tempDir);
  process.env.STUDIO_DB_PATH = ":memory:";
  mockedGetProject.mockResolvedValue({ id: "project-1" });
});

afterEach(async () => {
  process.chdir(originalCwd);
  process.env.STUDIO_DB_PATH = originalDbPath;
  await rm(tempDir, { recursive: true, force: true });
});

describe("timeline repository", () => {
  it("saves, reloads, and deletes timeline drafts from SQLite", async () => {
    const repo = await loadRepository();
    const draft = createDraft();

    await repo.saveTimelineDraft(draft);
    await expect(repo.getTimelineDraft(draft.projectId)).resolves.toEqual(draft);

    await repo.deleteTimelineDraft(draft.projectId);
    await expect(repo.getTimelineDraft(draft.projectId)).resolves.toBeNull();
  });

  it("migrates legacy timeline JSON files into SQLite on first access", async () => {
    const draft = createDraft();
    const legacyFilePath = path.join(tempDir, "data", "timeline", `${draft.projectId}.json`);

    await mkdir(path.dirname(legacyFilePath), { recursive: true });
    await writeFile(legacyFilePath, JSON.stringify(draft, null, 2), "utf8");

    const repo = await loadRepository();
    await expect(repo.getTimelineDraft(draft.projectId)).resolves.toEqual(draft);
  });

  it("returns null when the timeline belongs to a different user's project", async () => {
    const repo = await loadRepository();
    const draft = createDraft();

    await repo.saveTimelineDraft(draft);
    mockedGetProject.mockResolvedValue(null);

    await expect(repo.getTimelineDraft(draft.projectId)).resolves.toBeNull();
  });
});
