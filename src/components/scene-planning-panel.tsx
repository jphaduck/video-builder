"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  approveSceneAction,
  approveScenePlanAction,
  generateScenePlanAction,
  regenerateImagePromptAction,
  regenerateScenePlanAction,
  regenerateSceneAction,
  rejectSceneAction,
  updateSceneAction,
} from "@/modules/scenes/actions";
import type { ProjectStatus } from "@/types/project";
import type { Scene, SceneEditableFields, SceneUpdateInput } from "@/types/scene";

type ScenePlanningPanelProps = {
  projectId: string;
  projectStatus: ProjectStatus;
  hasApprovedScript: boolean;
  initialScenes: Scene[];
};

function buildEditableFields(scenes: Scene[]): Record<string, SceneEditableFields> {
  return Object.fromEntries(
    scenes.map((scene) => [
      scene.id,
      {
        heading: scene.heading,
        scriptExcerpt: scene.scriptExcerpt,
        sceneSummary: scene.sceneSummary,
        durationTargetSeconds: scene.durationTargetSeconds,
        visualIntent: scene.visualIntent,
        imagePrompt: scene.imagePrompt,
      },
    ]),
  );
}

function replaceSceneInList(existingScenes: Scene[], updatedScene: Scene): Scene[] {
  return existingScenes
    .map((scene) => (scene.id === updatedScene.id ? updatedScene : scene))
    .sort((a, b) => a.sceneNumber - b.sceneNumber || a.createdAt.localeCompare(b.createdAt));
}

function formatRuntime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function getSceneStatusLabel(status: Scene["approvalStatus"]): string {
  if (status === "approved") {
    return "Approved";
  }

  if (status === "rejected") {
    return "Rejected";
  }

  return "Pending";
}

function getDirtyFields(scene: Scene, values: SceneEditableFields): SceneUpdateInput {
  const trimmedHeading = values.heading.trim();
  const trimmedScriptExcerpt = values.scriptExcerpt.trim();
  const trimmedSceneSummary = values.sceneSummary.trim();
  const trimmedVisualIntent = values.visualIntent.trim();
  const trimmedImagePrompt = values.imagePrompt.trim();
  const updates: SceneUpdateInput = {};

  if (trimmedHeading !== scene.heading) {
    updates.heading = trimmedHeading;
  }
  if (trimmedScriptExcerpt !== scene.scriptExcerpt) {
    updates.scriptExcerpt = trimmedScriptExcerpt;
  }
  if (trimmedSceneSummary !== scene.sceneSummary) {
    updates.sceneSummary = trimmedSceneSummary;
  }
  if (values.durationTargetSeconds !== scene.durationTargetSeconds) {
    updates.durationTargetSeconds = values.durationTargetSeconds;
  }
  if (trimmedVisualIntent !== scene.visualIntent) {
    updates.visualIntent = trimmedVisualIntent;
  }
  if (trimmedImagePrompt !== scene.imagePrompt) {
    updates.imagePrompt = trimmedImagePrompt;
  }

  return updates;
}

export function ScenePlanningPanel({
  projectId,
  projectStatus,
  hasApprovedScript,
  initialScenes,
}: ScenePlanningPanelProps) {
  const router = useRouter();
  const [scenes, setScenes] = useState(initialScenes);
  const [editableFields, setEditableFields] = useState<Record<string, SceneEditableFields>>(() =>
    buildEditableFields(initialScenes),
  );
  const [expandedSceneIds, setExpandedSceneIds] = useState<string[]>(initialScenes[0] ? [initialScenes[0].id] : []);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    setScenes(initialScenes);
    setEditableFields(buildEditableFields(initialScenes));
    setExpandedSceneIds((previousIds) => {
      const validIds = previousIds.filter((sceneId) => initialScenes.some((scene) => scene.id === sceneId));
      if (validIds.length > 0) {
        return validIds;
      }

      return initialScenes[0] ? [initialScenes[0].id] : [];
    });
  }, [initialScenes]);

  const isScenePlanApproved = projectStatus === "scene_ready";
  const totalRuntimeSeconds = useMemo(
    () => scenes.reduce((sum, scene) => sum + scene.durationTargetSeconds, 0),
    [scenes],
  );
  const approvedCount = useMemo(
    () => scenes.filter((scene) => scene.approvalStatus === "approved").length,
    [scenes],
  );
  const canApproveScenePlan = scenes.length > 0 && approvedCount === scenes.length && !isScenePlanApproved;

  function updateEditableField(sceneId: string, field: keyof SceneEditableFields, value: string | number): void {
    setEditableFields((currentFields) => ({
      ...currentFields,
      [sceneId]: {
        ...currentFields[sceneId],
        [field]: value,
      },
    }));
  }

  function toggleScene(sceneId: string): void {
    setExpandedSceneIds((currentIds) =>
      currentIds.includes(sceneId) ? currentIds.filter((id) => id !== sceneId) : [...currentIds, sceneId],
    );
  }

  async function runSceneAction(actionLabel: string, action: () => Promise<void>): Promise<void> {
    setPendingAction(actionLabel);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await action();
    } finally {
      setPendingAction(null);
    }
  }

  async function handleGenerateScenePlan(): Promise<void> {
    await runSceneAction("generate-scene-plan", async () => {
      const result = await generateScenePlanAction(projectId);
      if (!result.ok) {
        setErrorMessage(result.error);
        return;
      }

      setScenes(result.data);
      setEditableFields(buildEditableFields(result.data));
      setExpandedSceneIds(result.data[0] ? [result.data[0].id] : []);
      setSuccessMessage(`Generated ${result.data.length} scenes for review.`);
      router.refresh();
    });
  }

  async function handleRegenerateScenePlan(): Promise<void> {
    if (!window.confirm("Regenerate the full scene plan? This will delete all current scenes and unsaved scene edits.")) {
      return;
    }

    await runSceneAction("regenerate-scene-plan", async () => {
      const result = await regenerateScenePlanAction(projectId);
      if (!result.ok) {
        setErrorMessage(result.error);
        return;
      }

      setScenes(result.data);
      setEditableFields(buildEditableFields(result.data));
      setExpandedSceneIds(result.data[0] ? [result.data[0].id] : []);
      setSuccessMessage(`Regenerated ${result.data.length} scenes from the approved script.`);
      router.refresh();
    });
  }

  async function handleSaveScene(scene: Scene): Promise<void> {
    const values = editableFields[scene.id];
    const updates = getDirtyFields(scene, values);
    if (Object.keys(updates).length === 0) {
      setErrorMessage("No changes to save for this scene.");
      setSuccessMessage(null);
      return;
    }

    await runSceneAction(`save-${scene.id}`, async () => {
      const result = await updateSceneAction(scene.id, updates);
      if (!result.ok) {
        setErrorMessage(result.error);
        return;
      }

      setScenes((currentScenes) => replaceSceneInList(currentScenes, result.data));
      setEditableFields((currentFields) => ({
        ...currentFields,
        [scene.id]: {
          heading: result.data.heading,
          scriptExcerpt: result.data.scriptExcerpt,
          sceneSummary: result.data.sceneSummary,
          durationTargetSeconds: result.data.durationTargetSeconds,
          visualIntent: result.data.visualIntent,
          imagePrompt: result.data.imagePrompt,
        },
      }));
      setSuccessMessage(`Saved changes for scene ${result.data.sceneNumber}.`);
    });
  }

  async function handleReplaceScene(scene: Scene): Promise<void> {
    await runSceneAction(`regenerate-${scene.id}`, async () => {
      const result = await regenerateSceneAction(scene.id);
      if (!result.ok) {
        setErrorMessage(result.error);
        return;
      }

      setScenes((currentScenes) => replaceSceneInList(currentScenes, result.data));
      setEditableFields((currentFields) => ({
        ...currentFields,
        [scene.id]: {
          heading: result.data.heading,
          scriptExcerpt: result.data.scriptExcerpt,
          sceneSummary: result.data.sceneSummary,
          durationTargetSeconds: result.data.durationTargetSeconds,
          visualIntent: result.data.visualIntent,
          imagePrompt: result.data.imagePrompt,
        },
      }));
      setSuccessMessage(`Regenerated scene ${result.data.sceneNumber}.`);
    });
  }

  async function handleRegenerateImagePrompt(scene: Scene): Promise<void> {
    await runSceneAction(`regenerate-prompt-${scene.id}`, async () => {
      const result = await regenerateImagePromptAction(scene.id);
      if (!result.ok) {
        setErrorMessage(result.error);
        return;
      }

      setScenes((currentScenes) => replaceSceneInList(currentScenes, result.data));
      setEditableFields((currentFields) => ({
        ...currentFields,
        [scene.id]: {
          heading: result.data.heading,
          scriptExcerpt: result.data.scriptExcerpt,
          sceneSummary: result.data.sceneSummary,
          durationTargetSeconds: result.data.durationTargetSeconds,
          visualIntent: result.data.visualIntent,
          imagePrompt: result.data.imagePrompt,
        },
      }));
      setSuccessMessage(`Regenerated the image prompt for scene ${result.data.sceneNumber}.`);
    });
  }

  async function handleApproveScene(scene: Scene): Promise<void> {
    await runSceneAction(`approve-${scene.id}`, async () => {
      const result = await approveSceneAction(scene.id);
      if (!result.ok) {
        setErrorMessage(result.error);
        return;
      }

      setScenes((currentScenes) => replaceSceneInList(currentScenes, result.data));
      setSuccessMessage(`Approved scene ${result.data.sceneNumber}.`);
    });
  }

  async function handleRejectScene(scene: Scene): Promise<void> {
    await runSceneAction(`reject-${scene.id}`, async () => {
      const result = await rejectSceneAction(scene.id);
      if (!result.ok) {
        setErrorMessage(result.error);
        return;
      }

      setScenes((currentScenes) => replaceSceneInList(currentScenes, result.data));
      setSuccessMessage(`Rejected scene ${result.data.sceneNumber}.`);
    });
  }

  async function handleApproveScenePlan(): Promise<void> {
    await runSceneAction("approve-scene-plan", async () => {
      const result = await approveScenePlanAction(projectId);
      if (!result.ok) {
        setErrorMessage(result.error);
        return;
      }

      setSuccessMessage("Scene plan approved. Image generation will be available here once implemented.");
      router.refresh();
    });
  }

  return (
    <section className="card" style={{ marginBottom: 16 }}>
      <h2 style={{ marginTop: 0 }}>Scene Planning</h2>

      {!hasApprovedScript ? (
        <p className="subtitle">Scene planning is unavailable until a script draft is approved.</p>
      ) : scenes.length === 0 ? (
        <>
          <p className="subtitle" style={{ marginTop: 0 }}>
            Generate a structured scene plan from the approved script to review pacing, visual intent, and image prompts.
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
          <button
            type="button"
            className="card"
            onClick={() => void handleGenerateScenePlan()}
            disabled={pendingAction !== null}
            style={{ cursor: pendingAction ? "wait" : "pointer", width: 240 }}
          >
            {pendingAction === "generate-scene-plan" ? "Generating Scene Plan..." : "Generate Scene Plan"}
          </button>
        </>
      ) : (
        <>
          {isScenePlanApproved ? (
            <>
              <p className="subtitle" style={{ marginTop: 0 }}>
                <strong>Scene plan approved</strong>
              </p>
              <p className="subtitle">Image generation will be available here once implemented.</p>
            </>
          ) : (
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <p className="subtitle" style={{ marginTop: 0, marginBottom: 0 }}>
                Review each generated scene, refine the editable fields, and approve every scene before moving on.
              </p>
              <button
                type="button"
                className="card"
                onClick={() => void handleRegenerateScenePlan()}
                disabled={pendingAction !== null}
                style={{ cursor: pendingAction ? "wait" : "pointer" }}
              >
                {pendingAction === "regenerate-scene-plan" ? "Regenerating Full Plan..." : "Regenerate Full Plan"}
              </button>
            </div>
          )}

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

          <div className="grid" style={{ marginTop: 12 }}>
            {scenes.map((scene) => {
              const sceneFields = editableFields[scene.id];
              const isExpanded = expandedSceneIds.includes(scene.id);
              const isBusy = pendingAction !== null;

              return (
                <article key={scene.id} className="card">
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                    <div>
                      <h3 style={{ margin: 0 }}>
                        Scene {scene.sceneNumber}: {scene.heading}
                      </h3>
                      <p className="subtitle" style={{ margin: "6px 0 0" }}>
                        {scene.durationTargetSeconds}s · {getSceneStatusLabel(scene.approvalStatus)} · Prompt v
                        {scene.promptVersion}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="card"
                      onClick={() => toggleScene(scene.id)}
                      style={{ cursor: "pointer" }}
                    >
                      {isExpanded ? "Collapse" : "Expand"}
                    </button>
                  </div>

                  {isExpanded ? (
                    <div className="grid" style={{ marginTop: 16 }}>
                      <label>
                        <strong>Heading</strong>
                        <input
                          value={sceneFields.heading}
                          onChange={(event) => updateEditableField(scene.id, "heading", event.target.value)}
                          disabled={isBusy || isScenePlanApproved}
                          style={{ width: "100%", marginTop: 8 }}
                        />
                      </label>

                      <label>
                        <strong>Script excerpt</strong>
                        <textarea
                          value={sceneFields.scriptExcerpt}
                          readOnly
                          rows={4}
                          style={{ width: "100%", marginTop: 8 }}
                        />
                      </label>

                      <label>
                        <strong>Scene summary</strong>
                        <textarea
                          value={sceneFields.sceneSummary}
                          onChange={(event) => updateEditableField(scene.id, "sceneSummary", event.target.value)}
                          disabled={isBusy || isScenePlanApproved}
                          rows={4}
                          style={{ width: "100%", marginTop: 8 }}
                        />
                      </label>

                      <label>
                        <strong>Duration target (seconds)</strong>
                        <input
                          type="number"
                          min={1}
                          value={sceneFields.durationTargetSeconds}
                          onChange={(event) =>
                            updateEditableField(scene.id, "durationTargetSeconds", Math.max(1, Number(event.target.value) || 1))
                          }
                          disabled={isBusy || isScenePlanApproved}
                          style={{ width: "100%", marginTop: 8 }}
                        />
                      </label>

                      <label>
                        <strong>Visual intent</strong>
                        <textarea
                          value={sceneFields.visualIntent}
                          onChange={(event) => updateEditableField(scene.id, "visualIntent", event.target.value)}
                          disabled={isBusy || isScenePlanApproved}
                          rows={4}
                          style={{ width: "100%", marginTop: 8 }}
                        />
                      </label>

                      <label>
                        <strong>Image prompt</strong>
                        <textarea
                          value={sceneFields.imagePrompt}
                          onChange={(event) => updateEditableField(scene.id, "imagePrompt", event.target.value)}
                          disabled={isBusy || isScenePlanApproved}
                          rows={5}
                          style={{ width: "100%", marginTop: 8 }}
                        />
                      </label>

                      {!isScenePlanApproved ? (
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <button
                            type="button"
                            className="card"
                            onClick={() => void handleSaveScene(scene)}
                            disabled={isBusy}
                            style={{ cursor: isBusy ? "wait" : "pointer" }}
                          >
                            Save Changes
                          </button>
                          <button
                            type="button"
                            className="card"
                            onClick={() => void handleReplaceScene(scene)}
                            disabled={isBusy}
                            style={{ cursor: isBusy ? "wait" : "pointer" }}
                          >
                            Regenerate Scene
                          </button>
                          <button
                            type="button"
                            className="card"
                            onClick={() => void handleRegenerateImagePrompt(scene)}
                            disabled={isBusy}
                            style={{ cursor: isBusy ? "wait" : "pointer" }}
                          >
                            Regenerate Image Prompt
                          </button>
                          <button
                            type="button"
                            className="card"
                            onClick={() => void handleApproveScene(scene)}
                            disabled={isBusy}
                            style={{ cursor: isBusy ? "wait" : "pointer" }}
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            className="card"
                            onClick={() => void handleRejectScene(scene)}
                            disabled={isBusy}
                            style={{ cursor: isBusy ? "wait" : "pointer" }}
                          >
                            Reject
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>

          <div className="card" style={{ marginTop: 16 }}>
            <p className="subtitle" style={{ margin: 0 }}>
              Total scene count: {scenes.length}
            </p>
            <p className="subtitle" style={{ margin: "6px 0 0" }}>
              Estimated total runtime: {formatRuntime(totalRuntimeSeconds)}
            </p>
            <p className="subtitle" style={{ margin: "6px 0 0" }}>
              Approval summary: {approvedCount} of {scenes.length} scenes approved
            </p>

            {!isScenePlanApproved ? (
              <>
                <button
                  type="button"
                  className="card"
                  onClick={() => void handleApproveScenePlan()}
                  disabled={!canApproveScenePlan || pendingAction !== null}
                  style={{ cursor: canApproveScenePlan && !pendingAction ? "pointer" : "not-allowed", marginTop: 12 }}
                >
                  Approve Scene Plan
                </button>
                {!canApproveScenePlan ? (
                  <p className="subtitle" style={{ margin: "8px 0 0" }}>
                    Approve every scene before approving the full scene plan.
                  </p>
                ) : null}
              </>
            ) : null}
          </div>
        </>
      )}
    </section>
  );
}
