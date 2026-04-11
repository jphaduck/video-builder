import "server-only";

import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { mkdir, readdir, readFile } from "node:fs/promises";
import path from "node:path";

const DATA_DIR = path.join(process.cwd(), "data");
const PROJECTS_DIR = path.join(DATA_DIR, "projects");
const DB_PATH = path.join(DATA_DIR, "studio.db");

type ProjectRow = {
  id: string;
  data: string;
  created_at: string;
  updated_at: string;
};

mkdirSync(DATA_DIR, { recursive: true });

export const db = new Database(DB_PATH);

db.pragma("journal_mode = WAL");
db.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`);

let migrationPromise: Promise<void> | null = null;

function getExistingProjectIds(): Set<string> {
  const rows = db.prepare("SELECT id FROM projects").all() as Array<{ id: string }>;
  return new Set(rows.map((row) => row.id));
}

export async function runMigration(): Promise<void> {
  if (migrationPromise) {
    return migrationPromise;
  }

  migrationPromise = (async () => {
    await mkdir(PROJECTS_DIR, { recursive: true });
    const entries = await readdir(PROJECTS_DIR, { withFileTypes: true });
    const existingIds = getExistingProjectIds();
    const insert = db.prepare(
      "INSERT INTO projects (id, data, created_at, updated_at) VALUES (?, ?, ?, ?)",
    );

    let migratedCount = 0;
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".json")) {
        continue;
      }

      const filePath = path.join(PROJECTS_DIR, entry.name);
      const raw = await readFile(filePath, "utf8");
      const parsed = JSON.parse(raw) as Partial<ProjectRow> & { id?: string; createdAt?: string; updatedAt?: string };
      const projectId = parsed.id;

      if (!projectId || existingIds.has(projectId)) {
        continue;
      }

      insert.run(projectId, raw, parsed.createdAt ?? "", parsed.updatedAt ?? "");
      existingIds.add(projectId);
      migratedCount += 1;
    }

    console.info(`[project-store] migrated ${migratedCount} project record(s) into SQLite.`);
  })().catch((error) => {
    migrationPromise = null;
    throw error;
  });

  return migrationPromise;
}

export function parseProjectRow(row: ProjectRow | undefined | null): string | null {
  return row?.data ?? null;
}

export { DB_PATH, DATA_DIR, PROJECTS_DIR };
