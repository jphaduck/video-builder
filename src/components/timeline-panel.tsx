"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { buildTimelineForProjectAction } from "@/modules/timeline/actions";
import type { TimelineDraft } from "@/modules/timeline/types";
import type { ProjectRecord } from "@/modules/projects/types";
import type { AssetCandidate } from "@/modules/assets/types";
import type { CaptionSegment } from "@/types/caption";

type TimelinePanelProps = {
  project: ProjectRecord;
  initialTimelineDraft: TimelineDraft | null;
  canBuildTimeline: boolean;
};

type TimelineRow = {
  sceneId: string;
  sceneNumber: number;
  heading: string;
  narrationDurationSeconds: number;
  captionPreview: string;
  startOffsetSeconds: number;
  thumbnailAssetId: string | null;
};

function formatOffset(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatSeconds(totalSeconds: number): string {
  return `${totalSeconds.toFixed(1)}s`;
}

function buildCaptionPreview(segments: CaptionSegment[]): string {
  if (segments.length === 0) {
    return "No caption segment available for this scene yet.";
  }

  const preview = segments
    .map((segment) => segment.text.trim())
    .filter(Boolean)
    .join(" ")
    .slice(0, 60)
    .trim();

  return preview.length === 60 ? `${preview}…` : preview;
}

function getSceneThumbnailAsset(sceneId: string, assets: AssetCandidate[]): AssetCandidate | null {
  const selectedApproved = assets.find((asset) => asset.sceneId === sceneId && asset.selected && asset.approvalStatus === "approved");
  if (selectedApproved) {
    return selectedApproved;
  }

  const selectedPending = assets.find((asset) => asset.sceneId === sceneId && asset.selected);
  return selectedPending ?? null;
}

function buildTimelineRows(draft: TimelineDraft | null): TimelineRow[] {
  if (!draft) {
    return [];
  }

  const orderedNarrationScenes = [...draft.narrationTrack.scenes].sort((a, b) => a.sceneNumber - b.sceneNumber);
  const narrationBySceneId = new Map(orderedNarrationScenes.map((sceneAudio) => [sceneAudio.sceneId, sceneAudio]));
  const captionSegmentsBySceneId = draft.captionTrack.segments.reduce<Map<string, CaptionSegment[]>>((segmentsBySceneId, segment) => {
    if (!segment.sceneId) {
      return segmentsBySceneId;
    }

    const existingSegments = segmentsBySceneId.get(segment.sceneId) ?? [];
    segmentsBySceneId.set(segment.sceneId, [...existingSegments, segment]);
    return segmentsBySceneId;
  }, new Map());

  let runningOffsetSeconds = 0;

  return [...draft.scenes]
    .sort((a, b) => a.sceneNumber - b.sceneNumber)
    .map((scene) => {
      const narrationScene = narrationBySceneId.get(scene.id);
      const narrationDurationSeconds = narrationScene?.measuredDurationSeconds ?? narrationScene?.durationSeconds ?? 0;
      const captionPreview = buildCaptionPreview(captionSegmentsBySceneId.get(scene.id) ?? []);
      const thumbnailAsset = getSceneThumbnailAsset(scene.id, draft.assets);
      const row: TimelineRow = {
        sceneId: scene.id,
        sceneNumber: scene.sceneNumber,
        heading: scene.heading,
        narrationDurationSeconds,
        captionPreview,
        startOffsetSeconds: runningOffsetSeconds,
        thumbnailAssetId: thumbnailAsset?.id ?? null,
      };

      runningOffsetSeconds += narrationDurationSeconds;
      return row;
    });
}

export function TimelinePanel({ project, initialTimelineDraft, canBuildTimeline }: TimelinePanelProps) {
  const router = useRouter();
  const [timelineDraft, setTimelineDraft] = useState(initialTimelineDraft);
  const [pendingAction, setPendingAction] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    setTimelineDraft(initialTimelineDraft);
  }, [initialTimelineDraft]);

  const timelineRows = useMemo(() => buildTimelineRows(timelineDraft), [timelineDraft]);
  const hasTimelineDraft = Boolean(timelineDraft);

  async function handleBuildTimeline(): Promise<void> {
    setPendingAction(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const result = await buildTimelineForProjectAction(project.id);
      if (!result.ok) {
        setErrorMessage(result.error);
        return;
      }

      setTimelineDraft(result.data);
      setSuccessMessage("Timeline ready — proceed to render.");
      router.refresh();
    } finally {
      setPendingAction(false);
    }
  }

  return (
    <section className="card" style={{ marginBottom: 16 }}>
      <h2 style={{ marginTop: 0 }}>Timeline</h2>
      <p className="subtitle" style={{ marginTop: 0 }}>
        Build a read-only timeline draft from the current scenes, stills, narration, and captions before final rendering.
      </p>

      {errorMessage ? (
        <p className="subtitle" style={{ color: "#9f1239" }}>
          {errorMessage}
        </p>
      ) : null}
      {successMessage ? (
        <p className="subtitle" style={{ color: "#166534" }}>
          {successMessage}
        </p>
      ) : null}

      {!canBuildTimeline ? (
        <p className="subtitle">Timeline building unlocks once the approved narration has a current, non-stale caption track.</p>
      ) : (
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: hasTimelineDraft ? 16 : 0 }}>
          <button
            type="button"
            className="card"
            onClick={() => void handleBuildTimeline()}
            disabled={pendingAction}
            style={{ cursor: pendingAction ? "wait" : "pointer" }}
          >
            {pendingAction ? "Building Timeline..." : hasTimelineDraft ? "Rebuild Timeline" : "Build Timeline"}
          </button>
          {hasTimelineDraft ? (
            <p className="subtitle" style={{ margin: 0, color: "#166534" }}>
              Timeline ready — proceed to render.
            </p>
          ) : null}
        </div>
      )}

      {hasTimelineDraft ? (
        <ol style={{ display: "grid", gap: 12, paddingLeft: 20, margin: 0 }}>
          {timelineRows.map((row) => (
            <li key={row.sceneId}>
              <article
                className="card"
                style={{
                  display: "grid",
                  gap: 12,
                  gridTemplateColumns: "minmax(120px, 160px) minmax(0, 1fr)",
                  alignItems: "start",
                }}
              >
                {row.thumbnailAssetId ? (
                  <Image
                    src={`/api/assets/${row.thumbnailAssetId}`}
                    alt={`Scene ${row.sceneNumber} thumbnail`}
                    width={160}
                    height={90}
                    style={{ width: "100%", height: "auto", borderRadius: 12, objectFit: "cover" }}
                  />
                ) : (
                  <div
                    className="card"
                    style={{
                      aspectRatio: "16 / 9",
                      display: "grid",
                      placeItems: "center",
                      color: "#6b7280",
                      textAlign: "center",
                    }}
                  >
                    No still selected
                  </div>
                )}

                <div>
                  <h3 style={{ marginTop: 0, marginBottom: 8 }}>
                    Scene {row.sceneNumber}: {row.heading}
                  </h3>
                  <p className="subtitle" style={{ marginTop: 0, marginBottom: 6 }}>
                    Start offset: {formatOffset(row.startOffsetSeconds)} · Narration: {formatSeconds(row.narrationDurationSeconds)}
                  </p>
                  <p className="subtitle" style={{ margin: 0 }}>
                    Caption preview: {row.captionPreview}
                  </p>
                </div>
              </article>
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}
