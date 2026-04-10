import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { getProjectById } from "@/modules/projects/repository";
import { RENDERING_DIR } from "@/modules/rendering/paths";
import { getLatestRenderJobForProject, getRenderJob, updateRenderJob } from "@/modules/rendering/repository";
import { createRenderJob, renderProject } from "@/modules/rendering/service";
import type { RenderJob } from "@/modules/rendering/types";
import { getTimelineDraftForProject } from "@/modules/timeline/service";

type RenderQueueEntry = {
  jobId: string;
  projectId: string;
  status: RenderJob["status"];
  createdAt: string;
  updatedAt: string;
};

type RenderQueueState = {
  jobs: RenderQueueEntry[];
};

const QUEUE_FILE_PATH = path.join(RENDERING_DIR, "queue.json");
const FORTY_EIGHT_HOURS_MS = 48 * 60 * 60 * 1000;

let queueWriteLock: Promise<unknown> = Promise.resolve();

function isErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

function withQueueWriteLock<T>(operation: () => Promise<T>): Promise<T> {
  const queuedOperation = queueWriteLock.then(operation, operation);
  queueWriteLock = queuedOperation.then(
    () => undefined,
    () => undefined,
  );
  return queuedOperation;
}

async function ensureQueueDirectory(): Promise<void> {
  await mkdir(RENDERING_DIR, { recursive: true });
}

async function readQueueState(): Promise<RenderQueueState> {
  await ensureQueueDirectory();

  try {
    const raw = await readFile(QUEUE_FILE_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<RenderQueueState>;
    return {
      jobs: Array.isArray(parsed.jobs) ? parsed.jobs : [],
    };
  } catch (error) {
    if (isErrnoException(error) && error.code === "ENOENT") {
      return { jobs: [] };
    }

    throw error;
  }
}

async function writeQueueState(state: RenderQueueState): Promise<void> {
  await ensureQueueDirectory();
  const tempFilePath = path.join(RENDERING_DIR, `queue.${randomUUID()}.tmp`);
  await writeFile(tempFilePath, JSON.stringify(state, null, 2), "utf8");
  await rename(tempFilePath, QUEUE_FILE_PATH);
}

async function updateQueueEntry(jobId: string, status: RenderJob["status"]): Promise<void> {
  await withQueueWriteLock(async () => {
    const state = await readQueueState();
    const nextJobs = state.jobs.map((job) =>
      job.jobId === jobId
        ? {
            ...job,
            status,
            updatedAt: new Date().toISOString(),
          }
        : job,
    );
    await writeQueueState({ jobs: nextJobs });
  });
}

export async function getJobStatus(jobId: string): Promise<RenderJob | null> {
  const state = await readQueueState();
  const queueEntry = state.jobs.find((job) => job.jobId === jobId);
  if (!queueEntry) {
    return null;
  }

  return getRenderJob(jobId);
}

export async function getLatestJobForProject(projectId: string): Promise<RenderJob | null> {
  const state = await readQueueState();
  const latestEntry = state.jobs
    .filter((job) => job.projectId === projectId)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
    .at(-1);

  if (!latestEntry) {
    return getLatestRenderJobForProject(projectId);
  }

  return getRenderJob(latestEntry.jobId);
}

export async function enqueueRender(projectId: string): Promise<string> {
  const project = await getProjectById(projectId);
  if (!project) {
    throw new Error(`Project not found: ${projectId}`);
  }

  const timelineDraft = await getTimelineDraftForProject(projectId);
  if (!timelineDraft) {
    throw new Error("Timeline draft not found for this project. Build the timeline before rendering.");
  }

  return withQueueWriteLock(async () => {
    const state = await readQueueState();
    const existingActiveJob = state.jobs
      .filter((job) => job.projectId === projectId && (job.status === "queued" || job.status === "rendering"))
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
      .at(0);

    if (existingActiveJob) {
      return existingActiveJob.jobId;
    }

    const job = await createRenderJob(projectId, timelineDraft.id, "queued", "Queued for render processing.");
    await writeQueueState({
      jobs: [
        ...state.jobs,
        {
          jobId: job.id,
          projectId,
          status: job.status,
          createdAt: job.createdAt,
          updatedAt: job.updatedAt,
        },
      ],
    });

    return job.id;
  });
}

export async function processNextJob(): Promise<RenderQueueEntry | null> {
  const state = await readQueueState();
  const nextEntry =
    state.jobs
      .filter((job) => job.status === "rendering")
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
      .at(0) ??
    state.jobs
      .filter((job) => job.status === "queued")
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
      .at(0);

  if (!nextEntry) {
    return null;
  }

  await updateQueueEntry(nextEntry.jobId, "rendering");
  console.info(`[render-worker] starting job ${nextEntry.jobId} for project ${nextEntry.projectId}`);

  try {
    await renderProject(nextEntry.projectId, nextEntry.jobId);
    await updateQueueEntry(nextEntry.jobId, "complete");
    return { ...nextEntry, status: "complete", updatedAt: new Date().toISOString() };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Render failed.";

    await updateRenderJob(nextEntry.jobId, (job) => ({
      ...job,
      status: "error",
      errorMessage: message,
      progressMessage: "Render failed.",
      updatedAt: new Date().toISOString(),
    }));
    await updateQueueEntry(nextEntry.jobId, "error");
    return { ...nextEntry, status: "error", updatedAt: new Date().toISOString() };
  }
}

export async function cleanOldJobs(): Promise<void> {
  await withQueueWriteLock(async () => {
    const cutoff = Date.now() - FORTY_EIGHT_HOURS_MS;
    const state = await readQueueState();
    const nextJobs = state.jobs.filter((job) => {
      if (job.status !== "complete" && job.status !== "error") {
        return true;
      }

      return new Date(job.updatedAt).getTime() >= cutoff;
    });

    await writeQueueState({ jobs: nextJobs });
  });
}
