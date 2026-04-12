import "server-only";

import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { mkdir, readdir, readFile } from "node:fs/promises";
import path from "node:path";

const DATA_DIR = path.join(process.cwd(), "data");
const PROJECTS_DIR = path.join(DATA_DIR, "projects");
const SCENES_DIR = path.join(DATA_DIR, "scenes");
const ASSETS_DIR = path.join(DATA_DIR, "assets");
const NARRATION_DIR = path.join(DATA_DIR, "narration");
const CAPTIONS_DIR = path.join(DATA_DIR, "captions");
const TIMELINE_DIR = path.join(DATA_DIR, "timeline");
const RENDERING_DIR = path.join(DATA_DIR, "rendering");
const DB_PATH = process.env.STUDIO_DB_PATH ?? path.join(DATA_DIR, "studio.db");

type ProjectRow = {
  id?: string;
  createdAt?: string;
  updatedAt?: string;
};

type SceneRow = {
  id?: string;
  projectId?: string;
  updatedAt?: string;
};

type AssetRow = {
  id?: string;
  projectId?: string;
  sceneId?: string;
  updatedAt?: string;
};

type NarrationTrackRow = {
  id?: string;
  projectId?: string;
  updatedAt?: string;
};

type CaptionTrackRow = {
  id?: string;
  projectId?: string;
  updatedAt?: string;
};

type TimelineRow = {
  projectId?: string;
  updatedAt?: string;
};

type RenderJobRow = {
  id?: string;
  projectId?: string;
  updatedAt?: string;
};

type JsonDataRow = {
  data: string;
};

if (DB_PATH !== ":memory:") {
  mkdirSync(DATA_DIR, { recursive: true });
}

export const db = new Database(DB_PATH);

export function initializeDatabase(database: Database.Database = db): void {
  if (database === db && DB_PATH !== ":memory:") {
    database.pragma("journal_mode = WAL");
  }

  database.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      user_id TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS scenes (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      data TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS assets (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      scene_id TEXT NOT NULL,
      data TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS narration_tracks (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      data TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS caption_tracks (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      data TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS timelines (
      project_id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS render_jobs (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      data TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  try {
    database.exec("ALTER TABLE projects ADD COLUMN user_id TEXT NOT NULL DEFAULT ''");
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes("duplicate column name: user_id")) {
      throw error;
    }
  }
}

initializeDatabase(db);

function getExistingIds(query: string): Set<string> {
  const rows = db.prepare(query).all() as Array<{ id?: string; project_id?: string }>;
  return new Set(rows.map((row) => row.id ?? row.project_id).filter((value): value is string => Boolean(value)));
}

async function migrateProjects(existingIds: Set<string>): Promise<number> {
  await mkdir(PROJECTS_DIR, { recursive: true });
  const entries = await readdir(PROJECTS_DIR, { withFileTypes: true });
  const insert = db.prepare(
    "INSERT OR IGNORE INTO projects (id, data, created_at, updated_at, user_id) VALUES (?, ?, ?, ?, ?)",
  );

  let migratedCount = 0;
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) {
      continue;
    }

    const filePath = path.join(PROJECTS_DIR, entry.name);
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as ProjectRow;
    if (!parsed.id || existingIds.has(parsed.id)) {
      continue;
    }

    insert.run(parsed.id, raw, parsed.createdAt ?? "", parsed.updatedAt ?? "", "");
    existingIds.add(parsed.id);
    migratedCount += 1;
  }

  return migratedCount;
}

async function migrateScenes(existingIds: Set<string>): Promise<number> {
  await mkdir(SCENES_DIR, { recursive: true });
  const entries = await readdir(SCENES_DIR, { withFileTypes: true });
  const insert = db.prepare("INSERT OR IGNORE INTO scenes (id, project_id, data, updated_at) VALUES (?, ?, ?, ?)");

  let migratedCount = 0;
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) {
      continue;
    }

    const filePath = path.join(SCENES_DIR, entry.name);
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as SceneRow;
    if (!parsed.id || !parsed.projectId || existingIds.has(parsed.id)) {
      continue;
    }

    insert.run(parsed.id, parsed.projectId, raw, parsed.updatedAt ?? "");
    existingIds.add(parsed.id);
    migratedCount += 1;
  }

  return migratedCount;
}

async function migrateAssets(existingIds: Set<string>): Promise<number> {
  await mkdir(ASSETS_DIR, { recursive: true });
  const entries = await readdir(ASSETS_DIR, { withFileTypes: true });
  const insert = db.prepare(
    "INSERT OR IGNORE INTO assets (id, project_id, scene_id, data, updated_at) VALUES (?, ?, ?, ?, ?)",
  );

  let migratedCount = 0;
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) {
      continue;
    }

    const filePath = path.join(ASSETS_DIR, entry.name);
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as AssetRow;
    if (!parsed.id || !parsed.projectId || !parsed.sceneId || existingIds.has(parsed.id)) {
      continue;
    }

    insert.run(parsed.id, parsed.projectId, parsed.sceneId, raw, parsed.updatedAt ?? "");
    existingIds.add(parsed.id);
    migratedCount += 1;
  }

  return migratedCount;
}

async function migrateNarrationTracks(existingIds: Set<string>): Promise<number> {
  await mkdir(NARRATION_DIR, { recursive: true });
  const entries = await readdir(NARRATION_DIR, { withFileTypes: true });
  const insert = db.prepare(
    "INSERT OR IGNORE INTO narration_tracks (id, project_id, data, updated_at) VALUES (?, ?, ?, ?)",
  );

  let migratedCount = 0;
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const filePath = path.join(NARRATION_DIR, entry.name, "track.json");
    try {
      const raw = await readFile(filePath, "utf8");
      const parsed = JSON.parse(raw) as NarrationTrackRow;
      if (!parsed.id || !parsed.projectId || existingIds.has(parsed.id)) {
        continue;
      }

      insert.run(parsed.id, parsed.projectId, raw, parsed.updatedAt ?? "");
      existingIds.add(parsed.id);
      migratedCount += 1;
    } catch (error) {
      if (!(error instanceof Error) || !("code" in error) || (error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }
  }

  return migratedCount;
}

async function migrateCaptionTracks(existingIds: Set<string>): Promise<number> {
  await mkdir(CAPTIONS_DIR, { recursive: true });
  const entries = await readdir(CAPTIONS_DIR, { withFileTypes: true });
  const insert = db.prepare(
    "INSERT OR IGNORE INTO caption_tracks (id, project_id, data, updated_at) VALUES (?, ?, ?, ?)",
  );

  let migratedCount = 0;
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) {
      continue;
    }

    const filePath = path.join(CAPTIONS_DIR, entry.name);
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as CaptionTrackRow;
    if (!parsed.id || !parsed.projectId || existingIds.has(parsed.id)) {
      continue;
    }

    insert.run(parsed.id, parsed.projectId, raw, parsed.updatedAt ?? "");
    existingIds.add(parsed.id);
    migratedCount += 1;
  }

  return migratedCount;
}

async function migrateTimelines(existingProjectIds: Set<string>): Promise<number> {
  await mkdir(TIMELINE_DIR, { recursive: true });
  const entries = await readdir(TIMELINE_DIR, { withFileTypes: true });
  const insert = db.prepare("INSERT OR IGNORE INTO timelines (project_id, data, updated_at) VALUES (?, ?, ?)");

  let migratedCount = 0;
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) {
      continue;
    }

    const filePath = path.join(TIMELINE_DIR, entry.name);
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as TimelineRow;
    if (!parsed.projectId || existingProjectIds.has(parsed.projectId)) {
      continue;
    }

    insert.run(parsed.projectId, raw, parsed.updatedAt ?? "");
    existingProjectIds.add(parsed.projectId);
    migratedCount += 1;
  }

  return migratedCount;
}

async function migrateRenderJobs(existingIds: Set<string>): Promise<number> {
  await mkdir(RENDERING_DIR, { recursive: true });
  const entries = await readdir(RENDERING_DIR, { withFileTypes: true });
  const insert = db.prepare("INSERT OR IGNORE INTO render_jobs (id, project_id, data, updated_at) VALUES (?, ?, ?, ?)");

  let migratedCount = 0;
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".json") || entry.name === "queue.json") {
      continue;
    }

    const filePath = path.join(RENDERING_DIR, entry.name);
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as RenderJobRow;
    if (!parsed.id || !parsed.projectId || existingIds.has(parsed.id)) {
      continue;
    }

    insert.run(parsed.id, parsed.projectId, raw, parsed.updatedAt ?? "");
    existingIds.add(parsed.id);
    migratedCount += 1;
  }

  return migratedCount;
}

let migrationPromise: Promise<void> | null = null;

export async function runMigration(): Promise<void> {
  if (migrationPromise) {
    return migrationPromise;
  }

  migrationPromise = (async () => {
    const migratedProjects = await migrateProjects(getExistingIds("SELECT id FROM projects"));
    const migratedScenes = await migrateScenes(getExistingIds("SELECT id FROM scenes"));
    const migratedAssets = await migrateAssets(getExistingIds("SELECT id FROM assets"));
    const migratedNarrationTracks = await migrateNarrationTracks(getExistingIds("SELECT id FROM narration_tracks"));
    const migratedCaptionTracks = await migrateCaptionTracks(getExistingIds("SELECT id FROM caption_tracks"));
    const migratedTimelines = await migrateTimelines(getExistingIds("SELECT project_id FROM timelines"));
    const migratedRenderJobs = await migrateRenderJobs(getExistingIds("SELECT id FROM render_jobs"));

    console.info(
      `[storage] migrated ${migratedProjects} projects, ${migratedScenes} scenes, ${migratedAssets} assets, ${migratedNarrationTracks} narration tracks, ${migratedCaptionTracks} caption tracks, ${migratedTimelines} timelines, and ${migratedRenderJobs} render jobs into SQLite.`,
    );
  })().catch((error) => {
    migrationPromise = null;
    throw error;
  });

  return migrationPromise;
}

export function parseProjectRow(row: JsonDataRow | undefined | null): string | null {
  return row?.data ?? null;
}

export {
  ASSETS_DIR,
  CAPTIONS_DIR,
  DATA_DIR,
  DB_PATH,
  NARRATION_DIR,
  PROJECTS_DIR,
  RENDERING_DIR,
  SCENES_DIR,
  TIMELINE_DIR,
};
