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

export async function updateRenderJob(
  jobId: string,
  updater: (job: RenderJob) => Promise<RenderJob> | RenderJob,
): Promise<RenderJob> {
  await ensureRenderingDirectory();

  return withRenderWriteLock(async () => {
    const currentJob = await getRenderJob(jobId);
    if (!currentJob) {
      throw new Error(`Render job not found: ${jobId}`);
    }

    const updatedJob = await updater(currentJob);
    const tempFile = path.join(RENDERING_DIR, `${updatedJob.id}.${randomUUID()}.tmp`);
    await writeFile(tempFile, JSON.stringify(updatedJob, null, 2), "utf8");
    await rename(tempFile, getRenderJobFilePath(updatedJob.id));
    return updatedJob;
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

export async function getLatestRenderJobForProject(projectId: string): Promise<RenderJob | null> {
  const jobs = await listRenderJobs(projectId);
  return jobs.at(-1) ?? null;
}

export async function deleteRenderJob(jobId: string): Promise<void> {
  await ensureRenderingDirectory();

  await withRenderWriteLock(async () => {
    const job = await getRenderJob(jobId);
    const cleanupPaths = new Set<string>();

    if (job) {
      if (job.outputFilePath) {
        cleanupPaths.add(path.join(process.cwd(), job.outputFilePath));
      }

      cleanupPaths.add(path.join(RENDERING_DIR, `${job.projectId}.srt`));
      cleanupPaths.add(path.join(RENDERING_DIR, `${job.projectId}-audio.mp3`));
      cleanupPaths.add(path.join(RENDERING_DIR, `${job.projectId}-images.txt`));
      cleanupPaths.add(path.join(RENDERING_DIR, `${job.projectId}-audio.txt`));
    }

    for (const filePath of cleanupPaths) {
      try {
        await unlink(filePath);
      } catch (error) {
        if (isErrnoException(error) && error.code === "ENOENT") {
          continue;
        }

        throw error;
      }
    }

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
