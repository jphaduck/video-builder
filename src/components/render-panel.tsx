"use client";

import { useEffect, useMemo, useState } from "react";
import type { RenderJob } from "@/modules/rendering/types";

type RenderPanelProps = {
  projectId: string;
  initialRenderJob: RenderJob | null;
};

type RenderStatus = "idle" | "rendering" | "complete" | "error";

type RenderJobResponse = { data: RenderJob } | { error: string };

function normalizeRenderStatus(job: RenderJob | null): RenderStatus {
  if (!job) {
    return "idle";
  }

  if (job.status === "complete") {
    return "complete";
  }

  if (job.status === "error") {
    return "error";
  }

  return "rendering";
}

function formatUpdatedAt(job: RenderJob | null): string | null {
  if (!job) {
    return null;
  }

  return new Date(job.updatedAt).toLocaleString();
}

function isRenderJobPayload(payload: unknown): payload is { data: RenderJob } {
  return typeof payload === "object" && payload !== null && "data" in payload;
}

function getErrorMessage(payload: unknown, fallbackMessage: string): string {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "error" in payload &&
    typeof payload.error === "string" &&
    payload.error.trim()
  ) {
    return payload.error;
  }

  return fallbackMessage;
}

export function RenderPanel({ projectId, initialRenderJob }: RenderPanelProps) {
  const [renderJob, setRenderJob] = useState<RenderJob | null>(initialRenderJob);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const renderStatus = useMemo(() => normalizeRenderStatus(renderJob), [renderJob]);
  const videoUrl = `/api/projects/${projectId}/render/stream`;
  const progressMessage = renderJob?.progressMessage ?? null;

  useEffect(() => {
    setRenderJob(initialRenderJob);
    setErrorMessage(null);
  }, [initialRenderJob]);

  useEffect(() => {
    if (renderStatus !== "rendering") {
      return;
    }

    const source = new EventSource(`/api/projects/${projectId}/render/progress`);

    source.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as { status: RenderStatus; message: string; job: RenderJob | null };

        setRenderJob(payload.job);
        setErrorMessage(payload.status === "error" ? payload.job?.errorMessage ?? payload.message : null);

        if (payload.status === "complete" || payload.status === "error") {
          source.close();
        }
      } catch {
        setErrorMessage("Failed to parse render progress update.");
        source.close();
      }
    };

    source.onerror = () => {
      setErrorMessage("Lost live render progress updates. Refresh the page to check the current render status.");
      source.close();
    };

    return () => source.close();
  }, [projectId, renderStatus]);

  async function handleRenderVideo(): Promise<void> {
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/projects/${projectId}/render`, { method: "POST" });
      const payload = (await response.json()) as RenderJobResponse;

      if (!response.ok) {
        setErrorMessage(getErrorMessage(payload, "Failed to start the render job."));
        return;
      }

      if (!isRenderJobPayload(payload)) {
        setErrorMessage("Failed to start the render job.");
        return;
      }

      setRenderJob(payload.data);
    } catch {
      setErrorMessage("Failed to start the render job.");
    }
  }

  return (
    <section className="card" style={{ marginBottom: 16 }}>
      <h2 style={{ marginTop: 0 }}>Render</h2>
      <p className="subtitle" style={{ marginTop: 0 }}>
        Create the final slideshow MP4 from the saved timeline draft, narration audio, stills, and captions.
      </p>

      <p className="subtitle" style={{ marginBottom: 12 }}>
        Status: {renderStatus}
        {renderJob ? ` · Updated ${formatUpdatedAt(renderJob)}` : ""}
      </p>

      {progressMessage ? <p className="subtitle" style={{ marginTop: 0 }}>{progressMessage}</p> : null}

      {errorMessage ? (
        <p className="subtitle" style={{ color: "#9f1239" }}>
          {errorMessage}
        </p>
      ) : null}

      {renderJob?.status === "error" && renderJob.errorMessage ? (
        <p className="subtitle" style={{ color: "#9f1239" }}>
          {renderJob.errorMessage}
        </p>
      ) : null}

      {!renderJob ? (
        <p className="subtitle" style={{ marginTop: 0 }}>
          No rendered video yet. Start a render to create the final MP4 from the current timeline.
        </p>
      ) : null}

      <button
        type="button"
        className="card"
        onClick={() => void handleRenderVideo()}
        disabled={renderStatus === "rendering"}
        style={{ cursor: renderStatus === "rendering" ? "wait" : "pointer", marginBottom: 16 }}
      >
        {renderStatus === "rendering" ? "Rendering Video..." : renderStatus === "complete" ? "Render Again" : "Render Video"}
      </button>

      {renderStatus === "complete" ? (
        <div className="grid" style={{ gap: 12 }}>
          <video controls src={videoUrl} style={{ width: "100%", borderRadius: 16 }} />
          <a href={videoUrl} download={`${projectId}.mp4`}>
            Download MP4
          </a>
        </div>
      ) : null}
    </section>
  );
}
