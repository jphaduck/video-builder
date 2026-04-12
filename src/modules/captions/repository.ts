import "server-only";

import { mkdir, unlink, rename, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { db, runMigration } from "@/lib/db";
import type { CaptionTrack } from "@/types/caption";

const DATA_DIR = path.join(process.cwd(), "data");
const CAPTIONS_DIR = path.join(DATA_DIR, "captions");

type CaptionDataRow = {
  data: string;
};

function isErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

function getCaptionExportFilePath(trackId: string, extension: "srt" | "vtt"): string {
  return path.join(CAPTIONS_DIR, `${trackId}.${extension}`);
}

function parseCaptionTrack(raw: string, context: string): CaptionTrack {
  try {
    return JSON.parse(raw) as CaptionTrack;
  } catch (error) {
    throw new Error(`Failed to parse ${context}: ${error instanceof Error ? error.message : "unknown error"}`);
  }
}

async function ensureCaptionStoreReady(): Promise<void> {
  await runMigration();
}

async function ensureCaptionsDirectory(): Promise<void> {
  await mkdir(CAPTIONS_DIR, { recursive: true });
}

export async function saveCaptionTrack(track: CaptionTrack): Promise<void> {
  await ensureCaptionStoreReady();

  db.prepare(
    `
      INSERT INTO caption_tracks (id, project_id, data, updated_at)
      VALUES (@id, @project_id, @data, @updated_at)
      ON CONFLICT(id) DO UPDATE SET
        project_id = excluded.project_id,
        data = excluded.data,
        updated_at = excluded.updated_at
    `,
  ).run({
    id: track.id,
    project_id: track.projectId,
    data: JSON.stringify(track, null, 2),
    updated_at: track.updatedAt,
  });
}

export async function getCaptionTrack(trackId: string): Promise<CaptionTrack | null> {
  await ensureCaptionStoreReady();

  const row = db.prepare("SELECT data FROM caption_tracks WHERE id = ?").get(trackId) as CaptionDataRow | undefined;
  return row ? parseCaptionTrack(row.data, `caption_tracks row ${trackId}`) : null;
}

export async function deleteCaptionTrack(trackId: string): Promise<void> {
  await ensureCaptionStoreReady();
  await ensureCaptionsDirectory();

  for (const extension of ["srt", "vtt"] as const) {
    try {
      await unlink(getCaptionExportFilePath(trackId, extension));
    } catch (error) {
      if (isErrnoException(error) && error.code === "ENOENT") {
        continue;
      }

      throw error;
    }
  }

  db.prepare("DELETE FROM caption_tracks WHERE id = ?").run(trackId);
}

export async function saveCaptionExport(trackId: string, extension: "srt" | "vtt", content: string): Promise<void> {
  await ensureCaptionsDirectory();

  const tempFile = path.join(CAPTIONS_DIR, `${trackId}.${extension}.${randomUUID()}.tmp`);
  await writeFile(tempFile, content, "utf8");
  await rename(tempFile, getCaptionExportFilePath(trackId, extension));
}
