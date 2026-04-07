"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  generateCaptionTrackAction,
  updateCaptionSegmentAction,
  updateCaptionSegmentTimingAction,
} from "@/modules/captions/actions";
import type { CaptionSegment, CaptionTrack } from "@/types/caption";
import type { NarrationTrack } from "@/types/narration";

type CaptionPanelProps = {
  projectId: string;
  initialNarrationTrack: NarrationTrack | null;
  initialCaptionTrack: CaptionTrack | null;
};

type CaptionDraftFields = {
  text: string;
  startMs: number;
  endMs: number;
};

function buildDraftFields(track: CaptionTrack | null): Record<string, CaptionDraftFields> {
  if (!track) {
    return {};
  }

  return Object.fromEntries(
    track.segments.map((segment) => [
      segment.id,
      {
        text: segment.text,
        startMs: segment.startMs,
        endMs: segment.endMs,
      },
    ]),
  );
}

function formatTimestamp(milliseconds: number): string {
  const totalSeconds = Math.max(0, milliseconds) / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toFixed(3).padStart(6, "0")}`;
}

export function CaptionPanel({ projectId, initialNarrationTrack, initialCaptionTrack }: CaptionPanelProps) {
  const router = useRouter();
  const [captionTrack, setCaptionTrack] = useState(initialCaptionTrack);
  const [draftFields, setDraftFields] = useState<Record<string, CaptionDraftFields>>(() => buildDraftFields(initialCaptionTrack));
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    setCaptionTrack(initialCaptionTrack);
    setDraftFields(buildDraftFields(initialCaptionTrack));
  }, [initialCaptionTrack]);

  const narrationApproved = initialNarrationTrack?.approvalStatus === "approved";
  const orderedSegments = useMemo(
    () => [...(captionTrack?.segments ?? [])].sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs),
    [captionTrack],
  );

  function updateDraftField(segmentId: string, field: keyof CaptionDraftFields, value: string | number): void {
    setDraftFields((currentFields) => ({
      ...currentFields,
      [segmentId]: {
        ...currentFields[segmentId],
        [field]: value,
      },
    }));
  }

  async function runAction(actionKey: string, action: () => Promise<void>): Promise<void> {
    setPendingAction(actionKey);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await action();
    } finally {
      setPendingAction(null);
    }
  }

  async function handleGenerateCaptions(): Promise<void> {
    if (!initialNarrationTrack) {
      return;
    }

    await runAction("generate-captions", async () => {
      const result = await generateCaptionTrackAction(projectId, initialNarrationTrack.id);
      if (!result.success) {
        setErrorMessage(result.error);
        return;
      }

      setCaptionTrack(result.data);
      setDraftFields(buildDraftFields(result.data));
      setSuccessMessage(
        initialCaptionTrack ? "Regenerated captions from the current narration track." : "Generated captions from the approved narration track.",
      );
      router.refresh();
    });
  }

  async function handleSaveText(segment: CaptionSegment): Promise<void> {
    if (!captionTrack) {
      return;
    }

    const nextText = draftFields[segment.id]?.text.trim() ?? segment.text;
    if (nextText === segment.text) {
      return;
    }

    await runAction(`segment-text-${segment.id}`, async () => {
      const result = await updateCaptionSegmentAction(captionTrack.id, segment.id, nextText);
      if (!result.success) {
        setErrorMessage(result.error);
        return;
      }

      const updatedTrack = result.data;
      setCaptionTrack(updatedTrack);
      setDraftFields(buildDraftFields(updatedTrack));
      setSuccessMessage("Saved caption text changes.");
      router.refresh();
    });
  }

  async function handleSaveTiming(segment: CaptionSegment): Promise<void> {
    if (!captionTrack) {
      return;
    }

    const nextStartMs = Number(draftFields[segment.id]?.startMs ?? segment.startMs);
    const nextEndMs = Number(draftFields[segment.id]?.endMs ?? segment.endMs);
    if (nextStartMs === segment.startMs && nextEndMs === segment.endMs) {
      return;
    }

    await runAction(`segment-timing-${segment.id}`, async () => {
      const result = await updateCaptionSegmentTimingAction(captionTrack.id, segment.id, nextStartMs, nextEndMs);
      if (!result.success) {
        setErrorMessage(result.error);
        return;
      }

      setCaptionTrack(result.data);
      setDraftFields(buildDraftFields(result.data));
      setSuccessMessage("Saved caption timing changes.");
      router.refresh();
    });
  }

  return (
    <section className="card" style={{ marginBottom: 16 }}>
      <h2 style={{ marginTop: 0 }}>Captions</h2>

      {!narrationApproved ? (
        <p className="subtitle">Captions are unavailable until narration is approved.</p>
      ) : (
        <>
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

          {!captionTrack ? (
            <button
              type="button"
              className="card"
              onClick={() => void handleGenerateCaptions()}
              disabled={pendingAction !== null}
              style={{ cursor: pendingAction ? "wait" : "pointer" }}
            >
              {pendingAction === "generate-captions" ? "Generating Captions..." : "Generate Captions"}
            </button>
          ) : (
            <>
              {captionTrack.isStale ? (
                <p className="subtitle" style={{ color: "#9a3412" }}>
                  These captions were generated from a previous narration track and may not match the current audio.
                  Regenerate captions to sync them.
                </p>
              ) : null}

              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                <p className="subtitle" style={{ marginTop: 0, marginBottom: 0 }}>
                  {orderedSegments.length} caption segments · Source: {captionTrack.source}
                </p>
                <button
                  type="button"
                  className="card"
                  onClick={() => void handleGenerateCaptions()}
                  disabled={pendingAction !== null}
                  style={{ cursor: pendingAction ? "wait" : "pointer" }}
                >
                  {pendingAction === "generate-captions" ? "Generating Captions..." : "Regenerate Captions"}
                </button>
              </div>

              <div className="grid" style={{ marginTop: 16 }}>
                {orderedSegments.map((segment) => {
                  const segmentDraft = draftFields[segment.id] ?? {
                    text: segment.text,
                    startMs: segment.startMs,
                    endMs: segment.endMs,
                  };

                  return (
                    <article key={segment.id} className="card">
                      <p className="subtitle" style={{ marginTop: 0, marginBottom: 12 }}>
                        Scene {segment.sceneNumber ?? "?"} · {formatTimestamp(segment.startMs)} {"\u2192"}{" "}
                        {formatTimestamp(segment.endMs)} {segment.edited ? "· edited" : ""}
                      </p>

                      <textarea
                        value={segmentDraft.text}
                        onChange={(event) => updateDraftField(segment.id, "text", event.target.value)}
                        onBlur={() => void handleSaveText(segment)}
                        rows={3}
                        disabled={pendingAction !== null}
                        style={{ width: "100%" }}
                      />

                      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", marginTop: 12 }}>
                        <label>
                          <strong>Start (ms)</strong>
                          <input
                            type="number"
                            min={0}
                            value={segmentDraft.startMs}
                            onChange={(event) => updateDraftField(segment.id, "startMs", Number(event.target.value) || 0)}
                            onBlur={() => void handleSaveTiming(segment)}
                            disabled={pendingAction !== null}
                            style={{ width: "100%", marginTop: 8 }}
                          />
                        </label>
                        <label>
                          <strong>End (ms)</strong>
                          <input
                            type="number"
                            min={0}
                            value={segmentDraft.endMs}
                            onChange={(event) => updateDraftField(segment.id, "endMs", Number(event.target.value) || 0)}
                            onBlur={() => void handleSaveTiming(segment)}
                            disabled={pendingAction !== null}
                            style={{ width: "100%", marginTop: 8 }}
                          />
                        </label>
                      </div>
                    </article>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}
