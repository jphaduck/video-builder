import "server-only";

import { cleanOldJobs, processNextJob } from "@/modules/rendering/queue";

const RENDER_WORKER_INTERVAL_MS = 5000;
const workerState = globalThis as typeof globalThis & {
  __storyVideoStudioRenderWorkerStarted?: boolean;
  __storyVideoStudioRenderWorkerProcessing?: boolean;
  __storyVideoStudioRenderWorkerInterval?: ReturnType<typeof setInterval>;
};

async function tick(): Promise<void> {
  if (workerState.__storyVideoStudioRenderWorkerProcessing) {
    return;
  }

  workerState.__storyVideoStudioRenderWorkerProcessing = true;
  try {
    await cleanOldJobs();
    const processedJob = await processNextJob();
    if (!processedJob) {
      return;
    }

    console.info(`[render-worker] processed job ${processedJob.jobId} for project ${processedJob.projectId}: ${processedJob.status}`);
  } catch (error) {
    console.error("[render-worker] queue processing failed", error);
  } finally {
    workerState.__storyVideoStudioRenderWorkerProcessing = false;
  }
}

export function startRenderWorker(): void {
  if (process.env.NODE_ENV === "test" || workerState.__storyVideoStudioRenderWorkerStarted) {
    return;
  }

  workerState.__storyVideoStudioRenderWorkerStarted = true;
  console.info("[render-worker] started");
  workerState.__storyVideoStudioRenderWorkerInterval = setInterval(() => {
    void tick();
  }, RENDER_WORKER_INTERVAL_MS);
  void tick();
}
