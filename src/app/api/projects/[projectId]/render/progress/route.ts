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
  const trimmedProjectId = projectId.trim();

  if (!trimmedProjectId) {
    return new Response("Project ID is required.", { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      let intervalId: ReturnType<typeof setInterval> | null = null;

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

      const sendPayload = async (): Promise<void> => {
        try {
          const job = await getLatestRenderJobForProject(trimmedProjectId);
          const payload =
            !job
              ? getProgressPayload("idle", "No render job found.", null)
              : job.status === "complete"
                ? getProgressPayload("complete", job.progressMessage ?? "Render complete.", job)
                : job.status === "error"
                  ? getProgressPayload("error", job.errorMessage ?? job.progressMessage ?? "Render failed.", job)
                  : getProgressPayload("rendering", job.progressMessage ?? "Rendering in progress...", job);

          controller.enqueue(encoder.encode(serializeSseEvent(payload)));

          if (payload.status === "idle" || payload.status === "complete" || payload.status === "error") {
            cleanup();
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : "Failed to read render progress.";
          controller.enqueue(encoder.encode(serializeSseEvent(getProgressPayload("error", message, null))));
          cleanup();
        }
      };

      request.signal.addEventListener("abort", cleanup);
      void sendPayload();
      intervalId = setInterval(() => {
        void sendPayload();
      }, 1000);
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
}
