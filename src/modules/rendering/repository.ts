import "server-only";

import { mkdir, unlink } from "node:fs/promises";
import path from "node:path";
import { db, runMigration } from "@/lib/db";
import { RENDERING_DIR, resolveRenderOutputPath } from "@/modules/rendering/paths";
import type { RenderJob } from "@/modules/rendering/types";

type RenderDataRow = {
  data: string;
};

function isErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

function parseRenderJob(raw: string, context: string): RenderJob {
  try {
    return JSON.parse(raw) as RenderJob;
  } catch (error) {
    throw new Error(`Failed to parse ${context}: ${error instanceof Error ? error.message : "unknown error"}`);
  }
}

async function ensureRenderingStoreReady(): Promise<void> {
  await runMigration();
}

async function ensureRenderingDirectory(): Promise<void> {
  await mkdir(RENDERING_DIR, { recursive: true });
}

export async function saveRenderJob(job: RenderJob): Promise<void> {
  await ensureRenderingStoreReady();

  db.prepare(
    `
      INSERT INTO render_jobs (id, project_id, data, updated_at)
      VALUES (@id, @project_id, @data, @updated_at)
      ON CONFLICT(id) DO UPDATE SET
        project_id = excluded.project_id,
        data = excluded.data,
        updated_at = excluded.updated_at
    `,
  ).run({
    id: job.id,
    project_id: job.projectId,
    data: JSON.stringify(job, null, 2),
    updated_at: job.updatedAt,
  });
}

export async function updateRenderJob(
  jobId: string,
  updater: (job: RenderJob) => Promise<RenderJob> | RenderJob,
): Promise<RenderJob> {
  await ensureRenderingStoreReady();

  const currentJob = await getRenderJob(jobId);
  if (!currentJob) {
    throw new Error(`Render job not found: ${jobId}`);
  }

  const updatedJob = await updater(currentJob);
  await saveRenderJob(updatedJob);
  return updatedJob;
}

export async function getRenderJob(jobId: string): Promise<RenderJob | null> {
  await ensureRenderingStoreReady();

  const row = db.prepare("SELECT data FROM render_jobs WHERE id = ?").get(jobId) as RenderDataRow | undefined;
  return row ? parseRenderJob(row.data, `render_jobs row ${jobId}`) : null;
}

export async function listRenderJobs(projectId: string): Promise<RenderJob[]> {
  await ensureRenderingStoreReady();

  const rows = db.prepare("SELECT data FROM render_jobs WHERE project_id = ?").all(projectId) as RenderDataRow[];
  return rows
    .map((row) => parseRenderJob(row.data, `render_jobs row for project ${projectId}`))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function getLatestRenderJobForProject(projectId: string): Promise<RenderJob | null> {
  const jobs = await listRenderJobs(projectId);
  return jobs.at(-1) ?? null;
}

export async function deleteRenderJob(jobId: string): Promise<void> {
  await ensureRenderingStoreReady();
  await ensureRenderingDirectory();

  const job = await getRenderJob(jobId);
  const cleanupPaths = new Set<string>();

  if (job) {
    if (job.outputFilePath) {
      const absoluteOutputPath = resolveRenderOutputPath(job.outputFilePath);
      if (absoluteOutputPath) {
        cleanupPaths.add(absoluteOutputPath);
      }
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

  db.prepare("DELETE FROM render_jobs WHERE id = ?").run(jobId);
}
