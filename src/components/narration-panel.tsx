"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  approveNarrationTrackAction,
  generateNarrationTrackAction,
  regenerateNarrationTrackAction,
  rejectNarrationTrackAction,
} from "@/modules/narration/actions";
import type { GenerateNarrationTrackOptions, NarrationTrack, NarrationVoiceName } from "@/types/narration";
import type { ProjectStatus } from "@/types/project";
import type { Scene } from "@/types/scene";

const VOICE_OPTIONS: Array<{ value: NarrationVoiceName; label: string }> = [
  { value: "alloy", label: "Alloy (neutral)" },
  { value: "echo", label: "Echo (smooth)" },
  { value: "onyx", label: "Onyx (deep)" },
  { value: "nova", label: "Nova (bright)" },
  { value: "shimmer", label: "Shimmer (warm)" },
];

type NarrationPanelProps = {
  projectId: string;
  projectStatus: ProjectStatus;
  isScenePlanApproved: boolean;
  sceneCount: number;
  scenes: Scene[];
  initialNarrationTrack: NarrationTrack | null;
};

function formatRuntime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.round(totalSeconds % 60);
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function serializeOverrides(overrides: Record<string, string>): string {
  return Object.entries(overrides)
    .map(([word, pronunciation]) => `${word}: ${pronunciation}`)
    .join("\n");
}

function parseOverrides(raw: string): Record<string, string> {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((overrides, line) => {
      const separatorIndex = line.indexOf(":");
      if (separatorIndex === -1) {
        return overrides;
      }

      const key = line.slice(0, separatorIndex).trim();
      const value = line.slice(separatorIndex + 1).trim();
      if (key && value) {
        overrides[key] = value;
      }

      return overrides;
    }, {});
}

function getStatusLabel(status: NarrationTrack["approvalStatus"]): string {
  if (status === "approved") {
    return "Approved";
  }

  if (status === "rejected") {
    return "Rejected";
  }

  return "Pending";
}

export function NarrationPanel({
  projectId,
  projectStatus,
  isScenePlanApproved,
  sceneCount,
  scenes,
  initialNarrationTrack,
}: NarrationPanelProps) {
  const router = useRouter();
  const [track, setTrack] = useState(initialNarrationTrack);
  const [voiceName, setVoiceName] = useState<NarrationVoiceName>((initialNarrationTrack?.voiceName as NarrationVoiceName) ?? "onyx");
  const [speed, setSpeed] = useState(initialNarrationTrack?.speed ?? 1);
  const [overridesText, setOverridesText] = useState(serializeOverrides(initialNarrationTrack?.pronunciationOverrides ?? {}));
  const [showRegenerateForm, setShowRegenerateForm] = useState(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    setTrack(initialNarrationTrack);
    setVoiceName((initialNarrationTrack?.voiceName as NarrationVoiceName) ?? "onyx");
    setSpeed(initialNarrationTrack?.speed ?? 1);
    setOverridesText(serializeOverrides(initialNarrationTrack?.pronunciationOverrides ?? {}));
    setShowRegenerateForm(false);
  }, [initialNarrationTrack]);

  const sceneMap = useMemo(() => new Map(scenes.map((scene) => [scene.id, scene])), [scenes]);
  const narrationExists = Boolean(track);
  const isApproved = track?.approvalStatus === "approved";
  const currentStatusLabel = track ? getStatusLabel(track.approvalStatus) : null;
  const canShowForm = !narrationExists || showRegenerateForm;

  function buildOptions(): GenerateNarrationTrackOptions {
    return {
      voiceName,
      speed,
      style: track?.style ?? null,
      pronunciationOverrides: parseOverrides(overridesText),
    };
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

  async function handleGenerateNarration(): Promise<void> {
    const options = buildOptions();
    const isRegeneration = Boolean(track);
    const currentTrackId = track?.id;

    if (isRegeneration && !window.confirm("Regenerate narration for every scene with these settings?")) {
      return;
    }

    await runAction(isRegeneration ? "regenerate" : "generate", async () => {
      const result = isRegeneration
        ? await regenerateNarrationTrackAction(currentTrackId ?? "", projectId, options)
        : await generateNarrationTrackAction(projectId, options);

      if (!result.success) {
        setErrorMessage(result.error);
        return;
      }

      setTrack(result.data);
      setVoiceName(result.data.voiceName as NarrationVoiceName);
      setSpeed(result.data.speed);
      setOverridesText(serializeOverrides(result.data.pronunciationOverrides));
      setShowRegenerateForm(false);
      setSuccessMessage(
        isRegeneration
          ? `Regenerated narration for ${result.data.scenes.length} scenes.`
          : `Generated narration for ${result.data.scenes.length} scenes.`,
      );
      router.refresh();
    });
  }

  async function handleApproveNarration(): Promise<void> {
    if (!track) {
      return;
    }

    await runAction("approve", async () => {
      const result = await approveNarrationTrackAction(track.id, projectId);
      if (!result.success) {
        setErrorMessage(result.error);
        return;
      }

      setTrack(result.data);
      setSuccessMessage("Narration approved.");
      router.refresh();
    });
  }

  async function handleRejectNarration(): Promise<void> {
    if (!track) {
      return;
    }

    await runAction("reject", async () => {
      const result = await rejectNarrationTrackAction(track.id);
      if (!result.success) {
        setErrorMessage(result.error);
        return;
      }

      setTrack(result.data);
      setSuccessMessage("Narration rejected. Adjust settings and regenerate when ready.");
      router.refresh();
    });
  }

  return (
    <section className="card" style={{ marginBottom: 16 }}>
      <h2 style={{ marginTop: 0 }}>Voice</h2>

      {!isScenePlanApproved ? (
        <p className="subtitle">Narration is unavailable until the scene plan is approved.</p>
      ) : (
        <>
          <p className="subtitle" style={{ marginTop: 0 }}>
            Status: {projectStatus}
            {track ? ` · Track ${currentStatusLabel?.toLowerCase()}` : ""}
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

          {!track ? (
            <p className="subtitle" style={{ marginTop: 0 }}>
              No narration track yet. Generate narration from the approved scenes to review voice, pacing, and audio quality.
            </p>
          ) : null}

          {canShowForm ? (
            <div className="grid" style={{ marginBottom: narrationExists ? 16 : 0 }}>
              <label>
                <strong>Voice</strong>
                <select
                  value={voiceName}
                  onChange={(event) => setVoiceName(event.target.value as NarrationVoiceName)}
                  disabled={pendingAction !== null}
                  style={{ width: "100%", marginTop: 8 }}
                >
                  {VOICE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <strong>Narration Speed</strong>
                <input
                  type="range"
                  min={0.75}
                  max={1.25}
                  step={0.05}
                  value={speed}
                  onChange={(event) => setSpeed(Number(event.target.value))}
                  disabled={pendingAction !== null}
                  style={{ width: "100%", marginTop: 8 }}
                />
                <span className="subtitle" style={{ display: "block", marginTop: 4 }}>
                  {speed.toFixed(2)}x
                </span>
              </label>

              <label>
                <strong>Pronunciation overrides</strong>
                <textarea
                  value={overridesText}
                  onChange={(event) => setOverridesText(event.target.value)}
                  rows={4}
                  disabled={pendingAction !== null}
                  placeholder={"Khorvath: Kor-vath\nMire Vale: Meer Vayl"}
                  style={{ width: "100%", marginTop: 8 }}
                />
              </label>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="card"
                  onClick={() => void handleGenerateNarration()}
                  disabled={pendingAction !== null}
                  style={{ cursor: pendingAction ? "wait" : "pointer" }}
                >
                  {pendingAction === "generate"
                    ? `Generating narration for ${sceneCount} scenes...`
                    : pendingAction === "regenerate"
                      ? `Generating narration for ${sceneCount} scenes...`
                      : narrationExists
                        ? "Regenerate Narration"
                        : "Generate Narration"}
                </button>

                {narrationExists ? (
                  <button
                    type="button"
                    className="card"
                    onClick={() => setShowRegenerateForm(false)}
                    disabled={pendingAction !== null}
                    style={{ cursor: pendingAction ? "wait" : "pointer" }}
                  >
                    Cancel
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}

          {track ? (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                <p className="subtitle" style={{ marginBottom: 0 }}>
                  Voice: {track.voiceName} · Speed: {track.speed.toFixed(2)}x · Estimated duration:{" "}
                  {formatRuntime(track.totalDurationSeconds)}
                </p>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {isApproved ? (
                    <span className="subtitle" style={{ color: "#166534" }}>
                      Narration approved
                    </span>
                  ) : null}
                  {!showRegenerateForm ? (
                    <button
                      type="button"
                      className="card"
                      onClick={() => setShowRegenerateForm(true)}
                      disabled={pendingAction !== null}
                      style={{ cursor: pendingAction ? "wait" : "pointer" }}
                    >
                      Regenerate Narration
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="grid" style={{ marginTop: 16 }}>
                {[...track.scenes]
                  .sort((a, b) => a.sceneNumber - b.sceneNumber)
                  .map((sceneAudio) => {
                    const scene = sceneMap.get(sceneAudio.sceneId);

                    return (
                      <article key={sceneAudio.sceneId} className="card">
                        <h3 style={{ marginTop: 0, marginBottom: 8 }}>
                          Scene {sceneAudio.sceneNumber}: {scene?.heading ?? "Narration Audio"}
                        </h3>
                        <p className="subtitle" style={{ marginTop: 0 }}>
                          Generated: {new Date(sceneAudio.generatedAt).toLocaleString()} · Estimated duration:{" "}
                          {formatRuntime(sceneAudio.durationSeconds)}
                        </p>
                        <audio controls preload="none" style={{ width: "100%" }}>
                          <source src={`/api/narration/${track.id}/${sceneAudio.sceneNumber}`} type="audio/mpeg" />
                          Your browser does not support audio playback.
                        </audio>
                      </article>
                    );
                  })}
              </div>

              {track.approvalStatus === "pending" || track.approvalStatus === "rejected" ? (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 16 }}>
                  <button
                    type="button"
                    className="card"
                  onClick={() => void handleApproveNarration()}
                  disabled={pendingAction !== null}
                  style={{ cursor: pendingAction ? "wait" : "pointer" }}
                >
                    {pendingAction === "approve" ? "Approving Narration..." : "Approve Narration"}
                  </button>
                  <button
                    type="button"
                    className="card"
                    onClick={() => void handleRejectNarration()}
                    disabled={pendingAction !== null}
                    style={{ cursor: pendingAction ? "wait" : "pointer" }}
                  >
                    {pendingAction === "reject" ? "Rejecting Narration..." : "Reject Narration"}
                  </button>
                </div>
              ) : null}
            </>
          ) : null}
        </>
      )}
    </section>
  );
}
