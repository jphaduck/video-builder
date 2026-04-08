import "server-only";

// File-backed caption storage layer for reading and writing caption tracks in data/captions.

import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import type { CaptionTrack } from "@/types/caption";

const DATA_DIR = path.join(process.cwd(), "data");
const CAPTIONS_DIR = path.join(DATA_DIR, "captions");

let captionWriteQueue: Promise<unknown> = Promise.resolve();

function isErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

function withCaptionWriteLock<T>(operation: () => Promise<T>): Promise<T> {
  const queuedOperation = captionWriteQueue.then(operation, operation);
  captionWriteQueue = queuedOperation.then(
    () => undefined,
    () => undefined,
  );
  return queuedOperation;
}

function getCaptionTrackFilePath(trackId: string): string {
  return path.join(CAPTIONS_DIR, `${trackId}.json`);
}

function getCaptionExportFilePath(trackId: string, extension: "srt" | "vtt"): string {
  return path.join(CAPTIONS_DIR, `${trackId}.${extension}`);
}

function parseCaptionTrack(raw: string, filePath: string): CaptionTrack {
  try {
    return JSON.parse(raw) as CaptionTrack;
  } catch (error) {
    throw new Error(`Failed to parse ${filePath}: ${error instanceof Error ? error.message : "unknown error"}`);
  }
}

async function ensureCaptionsDirectory(): Promise<void> {
  await mkdir(CAPTIONS_DIR, { recursive: true });
}

export async function saveCaptionTrack(track: CaptionTrack): Promise<void> {
  await ensureCaptionsDirectory();

  await withCaptionWriteLock(async () => {
    const tempFile = path.join(CAPTIONS_DIR, `${track.id}.${randomUUID()}.tmp`);
    await writeFile(tempFile, JSON.stringify(track, null, 2), "utf8");
    await rename(tempFile, getCaptionTrackFilePath(track.id));
  });
}

export async function getCaptionTrack(trackId: string): Promise<CaptionTrack | null> {
  await ensureCaptionsDirectory();

  try {
    const filePath = getCaptionTrackFilePath(trackId);
    const raw = await readFile(filePath, "utf8");
    return parseCaptionTrack(raw, filePath);
  } catch (error) {
    if (isErrnoException(error) && error.code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

export async function deleteCaptionTrack(trackId: string): Promise<void> {
  await ensureCaptionsDirectory();

  await withCaptionWriteLock(async () => {
    const filePaths = [getCaptionTrackFilePath(trackId), getCaptionExportFilePath(trackId, "srt"), getCaptionExportFilePath(trackId, "vtt")];

    for (const filePath of filePaths) {
      try {
        await unlink(filePath);
      } catch (error) {
        if (isErrnoException(error) && error.code === "ENOENT") {
          continue;
        }

        throw error;
      }
    }
  });
}

export async function saveCaptionExport(trackId: string, extension: "srt" | "vtt", content: string): Promise<void> {
  await ensureCaptionsDirectory();

  await withCaptionWriteLock(async () => {
    const tempFile = path.join(CAPTIONS_DIR, `${trackId}.${extension}.${randomUUID()}.tmp`);
    await writeFile(tempFile, content, "utf8");
    await rename(tempFile, getCaptionExportFilePath(trackId, extension));
  });
}
