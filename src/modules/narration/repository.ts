import "server-only";

import { mkdir, readdir, rename, rm, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { db, runMigration } from "@/lib/db";
import type { NarrationTrack } from "@/types/narration";

const DATA_DIR = path.join(process.cwd(), "data");
const NARRATION_DIR = path.join(DATA_DIR, "narration");

type NarrationDataRow = {
  data: string;
};

function isErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

function getNarrationTrackDir(trackId: string): string {
  return path.join(NARRATION_DIR, trackId);
}

function getSceneAudioFilePath(trackId: string, sceneNumber: number): string {
  return path.join(getNarrationTrackDir(trackId), `scene-${sceneNumber}.mp3`);
}

function parseNarrationTrack(raw: string, context: string): NarrationTrack {
  try {
    const parsed = JSON.parse(raw) as NarrationTrack;

    return {
      ...parsed,
      scenes: parsed.scenes.map((sceneAudio) => ({
        ...sceneAudio,
        measuredDurationSeconds: sceneAudio.measuredDurationSeconds ?? sceneAudio.durationSeconds,
      })),
      totalDurationSeconds:
        parsed.totalDurationSeconds ??
        Number(
          parsed.scenes
            .reduce(
              (sum, sceneAudio) => sum + (sceneAudio.measuredDurationSeconds ?? sceneAudio.durationSeconds),
              0,
            )
            .toFixed(2),
        ),
    };
  } catch (error) {
    throw new Error(`Failed to parse ${context}: ${error instanceof Error ? error.message : "unknown error"}`);
  }
}

async function ensureNarrationStoreReady(): Promise<void> {
  await runMigration();
}

async function ensureNarrationDirectory(trackId?: string): Promise<void> {
  await mkdir(trackId ? getNarrationTrackDir(trackId) : NARRATION_DIR, { recursive: true });
}

async function unlinkWithWarning(filePath: string, warningLabel: string): Promise<void> {
  try {
    await unlink(filePath);
  } catch (error) {
    if (isErrnoException(error) && error.code === "ENOENT") {
      console.warn(`${warningLabel} was missing while deleting narration assets. Continuing.`);
      return;
    }

    throw error;
  }
}

export async function saveNarrationTrack(track: NarrationTrack): Promise<void> {
  await ensureNarrationStoreReady();

  db.prepare(
    `
      INSERT INTO narration_tracks (id, project_id, data, updated_at)
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

export async function getNarrationTrack(trackId: string): Promise<NarrationTrack | null> {
  await ensureNarrationStoreReady();

  const row = db.prepare("SELECT data FROM narration_tracks WHERE id = ?").get(trackId) as NarrationDataRow | undefined;
  return row ? parseNarrationTrack(row.data, `narration_tracks row ${trackId}`) : null;
}

export async function deleteNarrationTrack(trackId: string): Promise<void> {
  await ensureNarrationStoreReady();
  await ensureNarrationDirectory(trackId);

  const trackDir = getNarrationTrackDir(trackId);
  const track = await getNarrationTrack(trackId);
  const expectedAudioFiles =
    track?.scenes.map((sceneAudio) => ({
      filePath: path.join(process.cwd(), sceneAudio.audioFilePath),
      warningLabel: `Narration audio file ${sceneAudio.audioFilePath}`,
    })) ?? [];

  for (const sceneFile of expectedAudioFiles) {
    await unlinkWithWarning(sceneFile.filePath, sceneFile.warningLabel);
  }

  try {
    const remainingEntries = await readdir(trackDir);
    await Promise.all(remainingEntries.map((entry) => unlink(path.join(trackDir, entry)).catch(() => undefined)));
  } catch (error) {
    if (!(isErrnoException(error) && error.code === "ENOENT")) {
      throw error;
    }
  }

  await rm(trackDir, { recursive: true, force: true });
  db.prepare("DELETE FROM narration_tracks WHERE id = ?").run(trackId);
}

export async function saveSceneAudioFile(trackId: string, sceneNumber: number, buffer: Buffer): Promise<string> {
  await ensureNarrationDirectory(trackId);

  const filePath = getSceneAudioFilePath(trackId, sceneNumber);
  const tempFilePath = path.join(getNarrationTrackDir(trackId), `scene-${sceneNumber}.${randomUUID()}.tmp`);
  await writeFile(tempFilePath, buffer);
  await rename(tempFilePath, filePath);
  return path.relative(process.cwd(), filePath);
}
