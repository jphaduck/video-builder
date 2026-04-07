import "server-only";

// File-backed narration storage layer for reading and writing track metadata and scene audio files in data/narration.

import { mkdir, readFile, readdir, rename, rm, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { NarrationTrack } from "@/types/narration";

const DATA_DIR = path.join(process.cwd(), "data");
const NARRATION_DIR = path.join(DATA_DIR, "narration");

let narrationWriteQueue: Promise<unknown> = Promise.resolve();

function isErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

function withNarrationWriteLock<T>(operation: () => Promise<T>): Promise<T> {
  const queuedOperation = narrationWriteQueue.then(operation, operation);
  narrationWriteQueue = queuedOperation.then(
    () => undefined,
    () => undefined,
  );
  return queuedOperation;
}

function getNarrationTrackDir(trackId: string): string {
  return path.join(NARRATION_DIR, trackId);
}

function getNarrationTrackFilePath(trackId: string): string {
  return path.join(getNarrationTrackDir(trackId), "track.json");
}

function getSceneAudioFilePath(trackId: string, sceneNumber: number): string {
  return path.join(getNarrationTrackDir(trackId), `scene-${sceneNumber}.mp3`);
}

function parseNarrationTrack(raw: string, filePath: string): NarrationTrack {
  try {
    return JSON.parse(raw) as NarrationTrack;
  } catch (error) {
    throw new Error(`Failed to parse ${filePath}: ${error instanceof Error ? error.message : "unknown error"}`);
  }
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
  await ensureNarrationDirectory(track.id);

  await withNarrationWriteLock(async () => {
    const trackFilePath = getNarrationTrackFilePath(track.id);
    const tempFilePath = path.join(getNarrationTrackDir(track.id), `track.${randomUUID()}.tmp`);
    await writeFile(tempFilePath, JSON.stringify(track, null, 2), "utf8");
    await rename(tempFilePath, trackFilePath);
  });
}

export async function getNarrationTrack(trackId: string): Promise<NarrationTrack | null> {
  await ensureNarrationDirectory(trackId);

  try {
    const filePath = getNarrationTrackFilePath(trackId);
    const raw = await readFile(filePath, "utf8");
    return parseNarrationTrack(raw, filePath);
  } catch (error) {
    if (isErrnoException(error) && error.code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

export async function deleteNarrationTrack(trackId: string): Promise<void> {
  await ensureNarrationDirectory(trackId);

  await withNarrationWriteLock(async () => {
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

    await unlinkWithWarning(getNarrationTrackFilePath(trackId), `Narration track ${trackId}`);

    try {
      const remainingEntries = await readdir(trackDir);
      await Promise.all(remainingEntries.map((entry) => unlink(path.join(trackDir, entry)).catch(() => undefined)));
    } catch (error) {
      if (!(isErrnoException(error) && error.code === "ENOENT")) {
        throw error;
      }
    }

    await rm(trackDir, { recursive: true, force: true });
  });
}

export async function saveSceneAudioFile(trackId: string, sceneNumber: number, buffer: Buffer): Promise<string> {
  await ensureNarrationDirectory(trackId);

  return withNarrationWriteLock(async () => {
    const filePath = getSceneAudioFilePath(trackId, sceneNumber);
    const tempFilePath = path.join(getNarrationTrackDir(trackId), `scene-${sceneNumber}.${randomUUID()}.tmp`);
    await writeFile(tempFilePath, buffer);
    await rename(tempFilePath, filePath);
    return path.relative(process.cwd(), filePath);
  });
}
