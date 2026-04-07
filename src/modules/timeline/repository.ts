import "server-only";

// File-backed timeline draft storage layer for reading and writing timeline drafts in data/timeline.

import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import type { TimelineDraft } from "@/modules/timeline/types";

const DATA_DIR = path.join(process.cwd(), "data");
const TIMELINE_DIR = path.join(DATA_DIR, "timeline");

let timelineWriteQueue: Promise<unknown> = Promise.resolve();

function isErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

function withTimelineWriteLock<T>(operation: () => Promise<T>): Promise<T> {
  const queuedOperation = timelineWriteQueue.then(operation, operation);
  timelineWriteQueue = queuedOperation.then(
    () => undefined,
    () => undefined,
  );
  return queuedOperation;
}

function getTimelineDraftFilePath(projectId: string): string {
  return path.join(TIMELINE_DIR, `${projectId}.json`);
}

async function ensureTimelineDirectory(): Promise<void> {
  await mkdir(TIMELINE_DIR, { recursive: true });
}

export async function saveTimelineDraft(draft: TimelineDraft): Promise<void> {
  await ensureTimelineDirectory();

  await withTimelineWriteLock(async () => {
    const tempFile = path.join(TIMELINE_DIR, `${draft.projectId}.${randomUUID()}.tmp`);
    await writeFile(tempFile, JSON.stringify(draft, null, 2), "utf8");
    await rename(tempFile, getTimelineDraftFilePath(draft.projectId));
  });
}

export async function getTimelineDraft(projectId: string): Promise<TimelineDraft | null> {
  await ensureTimelineDirectory();

  try {
    const filePath = getTimelineDraftFilePath(projectId);
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw) as TimelineDraft;
  } catch (error) {
    if (isErrnoException(error) && error.code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

export async function deleteTimelineDraft(projectId: string): Promise<void> {
  await ensureTimelineDirectory();

  await withTimelineWriteLock(async () => {
    try {
      await unlink(getTimelineDraftFilePath(projectId));
    } catch (error) {
      if (isErrnoException(error) && error.code === "ENOENT") {
        return;
      }

      throw error;
    }
  });
}
