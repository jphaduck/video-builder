import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const originalCwd = process.cwd();
const originalDbPath = process.env.STUDIO_DB_PATH;
let tempDir = "";

async function writeJson(relativePath: string, value: unknown) {
  const filePath = path.join(tempDir, relativePath);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(value, null, 2), "utf8");
}

beforeEach(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), "db-migration-test-"));
  process.chdir(tempDir);
  process.env.STUDIO_DB_PATH = ":memory:";
});

afterEach(async () => {
  process.chdir(originalCwd);
  process.env.STUDIO_DB_PATH = originalDbPath;
  await rm(tempDir, { recursive: true, force: true });
});

describe("runMigration", () => {
  it("imports legacy workflow JSON stores into SQLite", async () => {
    await writeJson("data/projects/project-1.json", { id: "project-1", createdAt: "2026-04-12T00:00:00.000Z", updatedAt: "2026-04-12T00:00:00.000Z" });
    await writeJson("data/scenes/scene-1.json", { id: "scene-1", projectId: "project-1", updatedAt: "2026-04-12T00:00:00.000Z" });
    await writeJson("data/assets/asset-1.json", { id: "asset-1", projectId: "project-1", sceneId: "scene-1", updatedAt: "2026-04-12T00:00:00.000Z" });
    await writeJson("data/narration/track-1/track.json", { id: "track-1", projectId: "project-1", updatedAt: "2026-04-12T00:00:00.000Z" });
    await writeJson("data/captions/caption-1.json", { id: "caption-1", projectId: "project-1", updatedAt: "2026-04-12T00:00:00.000Z" });
    await writeJson("data/timeline/project-1.json", { projectId: "project-1", updatedAt: "2026-04-12T00:00:00.000Z" });
    await writeJson("data/rendering/render-1.json", { id: "render-1", projectId: "project-1", updatedAt: "2026-04-12T00:00:00.000Z" });
    await writeJson("data/rendering/queue.json", { jobs: [{ jobId: "queued-1" }] });

    vi.resetModules();
    const { db, runMigration } = await import("@/lib/db");
    await runMigration();

    expect((db.prepare("SELECT COUNT(*) AS count FROM projects").get() as { count: number }).count).toBe(1);
    expect((db.prepare("SELECT COUNT(*) AS count FROM scenes").get() as { count: number }).count).toBe(1);
    expect((db.prepare("SELECT COUNT(*) AS count FROM assets").get() as { count: number }).count).toBe(1);
    expect((db.prepare("SELECT COUNT(*) AS count FROM narration_tracks").get() as { count: number }).count).toBe(1);
    expect((db.prepare("SELECT COUNT(*) AS count FROM caption_tracks").get() as { count: number }).count).toBe(1);
    expect((db.prepare("SELECT COUNT(*) AS count FROM timelines").get() as { count: number }).count).toBe(1);
    expect((db.prepare("SELECT COUNT(*) AS count FROM render_jobs").get() as { count: number }).count).toBe(1);
  });
});
