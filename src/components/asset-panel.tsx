"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  approveImagePlanAction,
  approveSelectedSceneImageAction,
  generateSceneImagesAction,
  rejectSelectedSceneImageAction,
  selectSceneImageAction,
} from "@/modules/assets/actions";
import type { AssetCandidate } from "@/modules/assets/types";
import type { ProjectStatus } from "@/types/project";
import type { Scene } from "@/types/scene";

type AssetPanelProps = {
  projectId: string;
  projectStatus: ProjectStatus;
  isScenePlanApproved: boolean;
  isImagePlanApproved: boolean;
  scenes: Scene[];
  initialAssets: AssetCandidate[];
};

function groupAssetsByScene(assets: AssetCandidate[]): Record<string, AssetCandidate[]> {
  return assets.reduce<Record<string, AssetCandidate[]>>((groupedAssets, asset) => {
    const nextSceneAssets = [...(groupedAssets[asset.sceneId] ?? []), asset].sort(
      (a, b) => a.candidateIndex - b.candidateIndex || a.createdAt.localeCompare(b.createdAt),
    );

    groupedAssets[asset.sceneId] = nextSceneAssets;
    return groupedAssets;
  }, {});
}

function replaceSceneAssets(
  currentAssets: Record<string, AssetCandidate[]>,
  sceneId: string,
  nextSceneAssets: AssetCandidate[],
): Record<string, AssetCandidate[]> {
  return {
    ...currentAssets,
    [sceneId]: [...nextSceneAssets].sort(
      (a, b) => a.candidateIndex - b.candidateIndex || a.createdAt.localeCompare(b.createdAt),
    ),
  };
}

function formatRuntime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function getAssetStatusLabel(status: AssetCandidate["approvalStatus"]): string {
  if (status === "approved") {
    return "Approved";
  }

  if (status === "rejected") {
    return "Rejected";
  }

  return "Pending";
}

function sceneHasApprovedSelection(sceneId: string, assetsByScene: Record<string, AssetCandidate[]>): boolean {
  return (assetsByScene[sceneId] ?? []).some((asset) => asset.selected && asset.approvalStatus === "approved");
}

export function AssetPanel({
  projectId,
  projectStatus,
  isScenePlanApproved,
  isImagePlanApproved,
  scenes,
  initialAssets,
}: AssetPanelProps) {
  const router = useRouter();
  const [assetsByScene, setAssetsByScene] = useState<Record<string, AssetCandidate[]>>(() =>
    groupAssetsByScene(initialAssets),
  );
  const [expandedSceneIds, setExpandedSceneIds] = useState<string[]>([]);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    setAssetsByScene(groupAssetsByScene(initialAssets));
  }, [initialAssets]);

  useEffect(() => {
    setExpandedSceneIds((currentIds) => {
      const validSceneIds = currentIds.filter((sceneId) => scenes.some((scene) => scene.id === sceneId));
      if (validSceneIds.length > 0) {
        return validSceneIds;
      }

      const firstSceneWithAssets = scenes.find((scene) => (assetsByScene[scene.id] ?? []).length > 0);
      return firstSceneWithAssets ? [firstSceneWithAssets.id] : [];
    });
  }, [assetsByScene, scenes]);

  const approvedScenes = useMemo(
    () => scenes.filter((scene) => scene.approvalStatus === "approved"),
    [scenes],
  );
  const totalImageRuntimeSeconds = useMemo(
    () => approvedScenes.reduce((sum, scene) => sum + scene.durationTargetSeconds, 0),
    [approvedScenes],
  );
  const approvedImageCount = useMemo(
    () => approvedScenes.filter((scene) => sceneHasApprovedSelection(scene.id, assetsByScene)).length,
    [approvedScenes, assetsByScene],
  );
  const canApproveImagePlan = approvedScenes.length > 0 && approvedImageCount === approvedScenes.length;

  function toggleScene(sceneId: string): void {
    setExpandedSceneIds((currentIds) =>
      currentIds.includes(sceneId) ? currentIds.filter((id) => id !== sceneId) : [...currentIds, sceneId],
    );
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

  async function handleGenerateImages(scene: Scene): Promise<void> {
    const existingAssets = assetsByScene[scene.id] ?? [];
    if (
      existingAssets.length > 0 &&
      !window.confirm("Regenerate the image candidates for this scene? The current selection and approvals will reset.")
    ) {
      return;
    }

    await runAction(`generate-${scene.id}`, async () => {
      const result = await generateSceneImagesAction(projectId, scene.id, { numCandidates: 3 });
      if (!result.ok) {
        setErrorMessage(result.error);
        return;
      }

      setAssetsByScene((currentAssets) => replaceSceneAssets(currentAssets, scene.id, result.data));
      setExpandedSceneIds((currentIds) => (currentIds.includes(scene.id) ? currentIds : [...currentIds, scene.id]));
      setSuccessMessage(`Generated ${result.data.length} image candidates for scene ${scene.sceneNumber}.`);
      router.refresh();
    });
  }

  async function handleGenerateAllScenes(): Promise<void> {
    if (approvedScenes.length === 0) {
      return;
    }

    const scenesWithExistingAssets = approvedScenes.filter((scene) => (assetsByScene[scene.id] ?? []).length > 0);
    if (
      scenesWithExistingAssets.length > 0 &&
      !window.confirm("Generate fresh image candidates for every approved scene? Existing scene image selections will reset.")
    ) {
      return;
    }

    await runAction("generate-all-scenes", async () => {
      let nextAssetsByScene = assetsByScene;

      for (const scene of approvedScenes) {
        const result = await generateSceneImagesAction(projectId, scene.id, { numCandidates: 3 });
        if (!result.ok) {
          setAssetsByScene(nextAssetsByScene);
          setErrorMessage(`Scene ${scene.sceneNumber}: ${result.error}`);
          return;
        }

        nextAssetsByScene = replaceSceneAssets(nextAssetsByScene, scene.id, result.data);
        setAssetsByScene(nextAssetsByScene);
      }

      setSuccessMessage(`Generated image candidates for ${approvedScenes.length} scenes.`);
      router.refresh();
    });
  }

  async function handleSelectCandidate(scene: Scene, candidateId: string): Promise<void> {
    await runAction(`select-${candidateId}`, async () => {
      const result = await selectSceneImageAction(projectId, scene.id, candidateId);
      if (!result.ok) {
        setErrorMessage(result.error);
        return;
      }

      setAssetsByScene((currentAssets) => replaceSceneAssets(currentAssets, scene.id, result.data));
      setSuccessMessage(`Selected image candidate for scene ${scene.sceneNumber}.`);
      router.refresh();
    });
  }

  async function handleApproveSelected(scene: Scene): Promise<void> {
    await runAction(`approve-${scene.id}`, async () => {
      const result = await approveSelectedSceneImageAction(projectId, scene.id);
      if (!result.ok) {
        setErrorMessage(result.error);
        return;
      }

      setAssetsByScene((currentAssets) => replaceSceneAssets(currentAssets, scene.id, result.data));
      setSuccessMessage(`Approved the selected image for scene ${scene.sceneNumber}.`);
      router.refresh();
    });
  }

  async function handleRejectSelected(scene: Scene): Promise<void> {
    await runAction(`reject-${scene.id}`, async () => {
      const result = await rejectSelectedSceneImageAction(projectId, scene.id);
      if (!result.ok) {
        setErrorMessage(result.error);
        return;
      }

      setAssetsByScene((currentAssets) => replaceSceneAssets(currentAssets, scene.id, result.data));
      setSuccessMessage(`Rejected the selected image for scene ${scene.sceneNumber}.`);
      router.refresh();
    });
  }

  async function handleApproveImagePlan(): Promise<void> {
    await runAction("approve-image-plan", async () => {
      const result = await approveImagePlanAction(projectId);
      if (!result.ok) {
        setErrorMessage(result.error);
        return;
      }

      setSuccessMessage("Image plan approved. Timeline assembly will be available once implemented.");
      router.refresh();
    });
  }

  return (
    <section className="card" style={{ marginBottom: 16 }}>
      <h2 style={{ marginTop: 0 }}>Still Images</h2>

      {!isScenePlanApproved ? (
        <p className="subtitle">Image generation is unavailable until the scene plan is approved.</p>
      ) : (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <p className="subtitle" style={{ marginTop: 0, marginBottom: 0 }}>
              Status: {projectStatus} · Approved scenes: {approvedScenes.length} · Runtime coverage:{" "}
              {formatRuntime(totalImageRuntimeSeconds)}
            </p>
            {approvedScenes.length > 0 ? (
              <button
                type="button"
                className="card"
                onClick={() => void handleGenerateAllScenes()}
                disabled={pendingAction !== null || isImagePlanApproved}
                style={{ cursor: pendingAction ? "wait" : "pointer" }}
              >
                {pendingAction === "generate-all-scenes" ? "Generating All Images..." : "Generate All Approved Scenes"}
              </button>
            ) : null}
          </div>

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

          {isImagePlanApproved ? (
            <p className="subtitle" style={{ marginTop: 12 }}>
              <strong>Image plan approved.</strong> Timeline assembly will be available here once implemented.
            </p>
          ) : (
            <p className="subtitle" style={{ marginTop: 12 }}>
              Generate still-image candidates from each approved scene prompt, pick one image per scene, and approve every
              selected image before the project can reach <code>images_ready</code>.
            </p>
          )}

          <div className="grid" style={{ marginTop: 12 }}>
            {approvedScenes.map((scene) => {
              const sceneAssets = assetsByScene[scene.id] ?? [];
              const selectedAsset = sceneAssets.find((asset) => asset.selected) ?? null;
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
                        {sceneAssets.length} candidate{sceneAssets.length === 1 ? "" : "s"} ·{" "}
                        {selectedAsset ? `${getAssetStatusLabel(selectedAsset.approvalStatus)} selection` : "No selection"} · Prompt v
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
                      <p className="subtitle" style={{ margin: 0 }}>
                        <strong>Visual intent:</strong> {scene.visualIntent}
                      </p>
                      <p className="subtitle" style={{ margin: 0 }}>
                        <strong>Prompt:</strong> {scene.imagePrompt}
                      </p>

                      {sceneAssets.length === 0 ? (
                        <button
                          type="button"
                          className="card"
                          onClick={() => void handleGenerateImages(scene)}
                          disabled={isBusy || isImagePlanApproved}
                          style={{ cursor: isBusy ? "wait" : "pointer", width: 220 }}
                        >
                          {pendingAction === `generate-${scene.id}` ? "Generating Images..." : "Generate 3 Images"}
                        </button>
                      ) : (
                        <>
                          <div
                            style={{
                              display: "grid",
                              gap: 12,
                              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                            }}
                          >
                            {sceneAssets.map((asset) => (
                              <article
                                key={asset.id}
                                className="card"
                                style={{
                                  border: asset.selected ? "2px solid #0f766e" : undefined,
                                  background: asset.selected ? "rgba(15, 118, 110, 0.06)" : undefined,
                                }}
                              >
                                <Image
                                  src={`/api/assets/${asset.id}`}
                                  alt={`Scene ${scene.sceneNumber} candidate ${asset.candidateIndex}`}
                                  width={512}
                                  height={512}
                                  unoptimized
                                  style={{ width: "100%", borderRadius: 12, aspectRatio: "1 / 1", objectFit: "cover" }}
                                />
                                <p className="subtitle" style={{ margin: "10px 0 6px" }}>
                                  Candidate {asset.candidateIndex}
                                  {asset.selected ? " · Selected" : ""} · {getAssetStatusLabel(asset.approvalStatus)}
                                </p>
                                <button
                                  type="button"
                                  className="card"
                                  onClick={() => void handleSelectCandidate(scene, asset.id)}
                                  disabled={isBusy || isImagePlanApproved || asset.selected}
                                  style={{ cursor: isBusy ? "wait" : "pointer", width: "100%" }}
                                >
                                  {asset.selected ? "Selected" : "Select Image"}
                                </button>
                              </article>
                            ))}
                          </div>

                          {!isImagePlanApproved ? (
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                              <button
                                type="button"
                                className="card"
                                onClick={() => void handleGenerateImages(scene)}
                                disabled={isBusy}
                                style={{ cursor: isBusy ? "wait" : "pointer" }}
                              >
                                {pendingAction === `generate-${scene.id}` ? "Regenerating Images..." : "Regenerate Images"}
                              </button>
                              <button
                                type="button"
                                className="card"
                                onClick={() => void handleApproveSelected(scene)}
                                disabled={isBusy || !selectedAsset}
                                style={{ cursor: isBusy ? "wait" : "pointer" }}
                              >
                                Approve Selected
                              </button>
                              <button
                                type="button"
                                className="card"
                                onClick={() => void handleRejectSelected(scene)}
                                disabled={isBusy || !selectedAsset}
                                style={{ cursor: isBusy ? "wait" : "pointer" }}
                              >
                                Reject Selected
                              </button>
                            </div>
                          ) : null}
                        </>
                      )}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>

          {approvedScenes.length > 0 ? (
            <div className="card" style={{ marginTop: 16 }}>
              <p className="subtitle" style={{ marginTop: 0 }}>
                Selected + approved images: {approvedImageCount} of {approvedScenes.length}
              </p>
              <button
                type="button"
                className="card"
                onClick={() => void handleApproveImagePlan()}
                disabled={pendingAction !== null || isImagePlanApproved || !canApproveImagePlan}
                style={{ cursor: pendingAction ? "wait" : "pointer" }}
              >
                {pendingAction === "approve-image-plan" ? "Approving Image Plan..." : "Approve Image Plan"}
              </button>
            </div>
          ) : (
            <p className="subtitle" style={{ marginTop: 16 }}>
              No approved scenes are available for image generation yet.
            </p>
          )}
        </>
      )}
    </section>
  );
}
