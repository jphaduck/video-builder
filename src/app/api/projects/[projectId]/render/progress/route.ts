import {
  INTERNAL_SERVER_ERROR_MESSAGE,
  PROJECT_NOT_FOUND_ERROR,
  getRequiredUuidParam,
  jsonError,
} from "@/app/api/_utils";
import { getProjectById } from "@/modules/projects/repository";
import { getLatestRenderJobForProject } from "@/modules/rendering/repository";
import type { RenderJob } from "@/modules/rendering/types";

type ProjectRenderProgressRouteContext = {
  params: Promise<{ projectId: string }>;
};

type RenderProgressPayload = {
  status: "idle" | "rendering" | "complete" | "error";
  message: string;
  job: RenderJob | null;
};

export const dynamic = "force-dynamic";

function serializeSseEvent(payload: RenderProgressPayload): string {
  return `data: ${JSON.stringify(payload)}\n\n`;
}

function getProgressPayload(
  status: RenderProgressPayload["status"],
  message: string,
  job: RenderJob | null,
): RenderProgressPayload {
  return { status, message, job };
}

export async function GET(request: Request, { params }: ProjectRenderProgressRouteContext): Promise<Response> {
  const { projectId } = await params;
  const { value: trimmedProjectId, response } = getRequiredUuidParam(
    projectId,
    "Project ID",
    "Invalid project ID.",
  );
  if (response || !trimmedProjectId) {
    return response ?? jsonError("Invalid project ID.", 400);
  }

  try {
    const project = await getProjectById(trimmedProjectId);
    if (!project) {
      return jsonError(PROJECT_NOT_FOUND_ERROR, 404);
    }

    const initialJob = await getLatestRenderJobForProject(trimmedProjectId);
    const encoder = new TextEncoder();

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        let closed = false;
        let intervalId: ReturnType<typeof setInterval> | null = null;
        let cachedJob = initialJob;

        const cleanup = (): void => {
          if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
          }

          if (!closed) {
            closed = true;
            controller.close();
          }
        };

        const buildPayload = (job: RenderJob | null): RenderProgressPayload =>
          !job
            ? getProgressPayload("idle", "No render job found.", null)
            : job.status === "complete"
              ? getProgressPayload("complete", job.progressMessage ?? "Render complete.", job)
              : job.status === "error"
                ? getProgressPayload("error", job.errorMessage ?? job.progressMessage ?? "Render failed.", job)
                : getProgressPayload("rendering", job.progressMessage ?? "Rendering in progress...", job);

        const sendPayload = async (): Promise<void> => {
          try {
            const payload = buildPayload(cachedJob);
            controller.enqueue(encoder.encode(serializeSseEvent(payload)));

            if (payload.status === "idle" || payload.status === "complete" || payload.status === "error") {
              cleanup();
              return;
            }

            cachedJob = await getLatestRenderJobForProject(trimmedProjectId);
          } catch {
            controller.enqueue(
              encoder.encode(serializeSseEvent(getProgressPayload("error", "Failed to read render progress.", null))),
            );
            cleanup();
          }
        };

        request.signal.addEventListener("abort", cleanup);
        intervalId = setInterval(() => {
          void sendPayload();
        }, 1000);
        void sendPayload();
      },
      cancel() {},
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch {
    return jsonError(INTERNAL_SERVER_ERROR_MESSAGE, 500);
  }
}
