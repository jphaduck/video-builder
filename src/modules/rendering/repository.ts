import "server-only";

// File-backed render job storage layer for reading and writing render jobs in data/rendering.

import { mkdir, readFile, readdir, rename, unlink, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import type { RenderJob } from "@/modules/rendering/types";

const DATA_DIR = path.join(process.cwd(), "data");
const RENDERING_DIR = path.join(DATA_DIR, "rendering");

let renderWriteQueue: Promise<unknown> = Promise.resolve();

function isErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

function withRenderWriteLock<T>(operation: () => Promise<T>): Promise<T> {
  const queuedOperation = renderWriteQueue.then(operation, operation);
  renderWriteQueue = queuedOperation.then(
    () => undefined,
    () => undefined,
  );
  return queuedOperation;
}

function getRenderJobFilePath(jobId: string): string {
  return path.join(RENDERING_DIR, `${jobId}.json`);
}

async function ensureRenderingDirectory(): Promise<void> {
  await mkdir(RENDERING_DIR, { recursive: true });
}

export async function saveRenderJob(job: RenderJob): Promise<void> {
  await ensureRenderingDirectory();

  await withRenderWriteLock(async () => {
    const tempFile = path.join(RENDERING_DIR, `${job.id}.${randomUUID()}.tmp`);
    await writeFile(tempFile, JSON.stringify(job, null, 2), "utf8");
    await rename(tempFile, getRenderJobFilePath(job.id));
  });
}

export async function getRenderJob(jobId: string): Promise<RenderJob | null> {
  await ensureRenderingDirectory();

  try {
    const filePath = getRenderJobFilePath(jobId);
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw) as RenderJob;
  } catch (error) {
    if (isErrnoException(error) && error.code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

export async function listRenderJobs(projectId: string): Promise<RenderJob[]> {
  await ensureRenderingDirectory();
  const entries = await readdir(RENDERING_DIR, { withFileTypes: true });
  const jobs = await Promise.all(
    entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .map(async (entry) => {
        const filePath = path.join(RENDERING_DIR, entry.name);
        const raw = await readFile(filePath, "utf8");
        return JSON.parse(raw) as RenderJob;
      }),
  );

  return jobs.filter((job) => job.projectId === projectId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function deleteRenderJob(jobId: string): Promise<void> {
  await ensureRenderingDirectory();

  await withRenderWriteLock(async () => {
    try {
      await unlink(getRenderJobFilePath(jobId));
    } catch (error) {
      if (isErrnoException(error) && error.code === "ENOENT") {
        return;
      }

      throw error;
    }
  });
}
