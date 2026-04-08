import { randomUUID } from "node:crypto";
import { getOpenAIClient } from "@/lib/ai";
import {
  getAssetCandidate,
  getAssetCandidatesForProject,
  getAssetCandidatesForScene,
  saveAssetCandidate,
  saveAssetImageFile,
  deleteAssetCandidate,
} from "@/modules/assets/repository";
import type { AssetCandidate, GenerateSceneImagesOptions } from "@/modules/assets/types";
import { deleteRenderJob } from "@/modules/rendering/repository";
import {
  getProjectById,
  replaceAssetCandidateIdsForProject,
  setProjectStatus,
} from "@/modules/projects/repository";
import { getScene, getScenesForProject } from "@/modules/scenes/repository";
import { deleteTimelineDraft } from "@/modules/timeline/repository";
import type { ProjectRecord, ProjectStatus } from "@/types/project";
import type { Scene } from "@/types/scene";

const DEFAULT_CANDIDATE_COUNT = 2;
const MAX_CANDIDATE_COUNT = 2;
const SCENE_PLAN_APPROVED_STATUSES = new Set<ProjectStatus>([
  "scene_ready",
  "narration_pending",
  "images_ready",
  "voice_ready",
  "timeline_ready",
  "rendered",
]);

function getProjectOrThrow(projectId: string, project: ProjectRecord | null): ProjectRecord {
  if (!project) {
    throw new Error(`Project not found: ${projectId}`);
  }

  return project;
}

function getSceneOrThrow(sceneId: string, scene: Scene | null): Scene {
  if (!scene) {
    throw new Error(`Scene not found: ${sceneId}`);
  }

  return scene;
}

function clampCandidateCount(numCandidates: number | undefined): number {
  if (!Number.isFinite(numCandidates)) {
    return DEFAULT_CANDIDATE_COUNT;
  }

  return Math.min(MAX_CANDIDATE_COUNT, Math.max(1, Math.floor(Number(numCandidates))));
}

function sortAssetCandidates(candidates: AssetCandidate[]): AssetCandidate[] {
  return [...candidates].sort(
    (a, b) => a.sceneNumber - b.sceneNumber || a.candidateIndex - b.candidateIndex || a.createdAt.localeCompare(b.createdAt),
  );
}

function hasApprovedScenePlan(project: ProjectRecord, scenes: Scene[]): boolean {
  return (
    SCENE_PLAN_APPROVED_STATUSES.has(project.status) &&
    project.workflow.sceneIds.length > 0 &&
    scenes.length === project.workflow.sceneIds.length &&
    scenes.every((scene) => scene.approvalStatus === "approved")
  );
}

function getSelectedCandidate(candidates: AssetCandidate[]): AssetCandidate | null {
  return candidates.find((candidate) => candidate.selected) ?? null;
}

function getFallbackProjectStatus(project: ProjectRecord): ProjectStatus {
  if (project.status === "voice_ready" || project.status === "narration_pending") {
    return project.status;
  }

  if (
    (project.status === "images_ready" || project.status === "timeline_ready" || project.status === "rendered") &&
    project.workflow.narrationTrackIds.length > 0
  ) {
    return "voice_ready";
  }

  return "scene_ready";
}

async function invalidateDownstreamArtifacts(project: ProjectRecord, nextStatus: ProjectStatus): Promise<void> {
  await deleteTimelineDraft(project.id);
  await Promise.all(project.workflow.renderJobIds.map((renderJobId) => deleteRenderJob(renderJobId)));
  await setProjectStatus(project.id, nextStatus, {
    clearRenderJobIds: true,
    imagePlanApprovedAt: null,
  });
}

async function getApprovedSceneContext(projectId: string, sceneId: string): Promise<{
  project: ProjectRecord;
  scene: Scene;
  scenes: Scene[];
}> {
  const project = getProjectOrThrow(projectId, await getProjectById(projectId));
  const scene = getSceneOrThrow(sceneId, await getScene(sceneId));

  if (scene.projectId !== project.id) {
    throw new Error("Scene does not belong to this project.");
  }

  if (scene.approvalStatus !== "approved") {
    throw new Error("Image generation is only available for approved scenes.");
  }

  const scenes = await getScenesForProject(project.id);

  if (!hasApprovedScenePlan(project, scenes)) {
    throw new Error("Image generation requires an approved scene plan.");
  }

  if (!project.workflow.sceneIds.includes(sceneId)) {
    throw new Error(`Scene is not part of this project's approved scene plan: ${sceneId}`);
  }

  return { project, scene, scenes };
}

function buildAssetGenerationPrompt(scene: Scene): string {
  return `Cinematic still image, no text, no faces visible: ${scene.imagePrompt}`.trim();
}

async function downloadImageBuffer(imageUrl: string): Promise<Buffer> {
  const response = await fetch(imageUrl);

  if (!response.ok) {
    throw new Error(`OpenAI image download failed with status ${response.status}.`);
  }

  const imageArrayBuffer = await response.arrayBuffer();
  return Buffer.from(imageArrayBuffer);
}

async function extractImageBuffer(
  response: {
    data?: Array<{ b64_json?: string | null; url?: string | null }>;
  },
  index: number,
): Promise<Buffer> {
  const image = response.data?.[0];

  if (!image) {
    throw new Error("OpenAI did not return any image candidates.");
  }

  if (typeof image.b64_json === "string" && image.b64_json.trim() !== "") {
    return Buffer.from(image.b64_json, "base64");
  }

  if (typeof image.url === "string" && image.url.trim() !== "") {
    return downloadImageBuffer(image.url);
  }

  throw new Error(`OpenAI returned image candidate ${index + 1} without downloadable image data.`);
}

async function generateImageBuffers(
  scene: Scene,
  candidateCount: number,
): Promise<Buffer[]> {
  const openai = getOpenAIClient();
  const prompt = buildAssetGenerationPrompt(scene);

  return Promise.all(
    Array.from({ length: candidateCount }, async (_, index) => {
      const response = await openai.images.generate({
        model: "dall-e-3",
        prompt,
        n: 1,
        size: "1792x1024",
        quality: "standard",
      });

      return extractImageBuffer(response, index);
    }),
  );
}

async function persistGeneratedCandidates(
  scene: Scene,
  imageBuffers: Buffer[],
): Promise<AssetCandidate[]> {
  const createdAt = new Date().toISOString();
  const candidates: AssetCandidate[] = [];

  for (const [index, imageBuffer] of imageBuffers.entries()) {
    const candidateId = randomUUID();
    const imageFilePath = await saveAssetImageFile(candidateId, imageBuffer);
    const candidate: AssetCandidate = {
      id: candidateId,
      projectId: scene.projectId,
      sceneId: scene.id,
      sceneNumber: scene.sceneNumber,
      candidateIndex: index + 1,
      imagePrompt: scene.imagePrompt,
      promptVersion: scene.promptVersion,
      provider: "openai",
      imageFilePath,
      selected: false,
      approvalStatus: "pending",
      createdAt,
      updatedAt: createdAt,
    };

    await saveAssetCandidate(candidate);
    candidates.push(candidate);
  }

  return candidates;
}

async function saveCandidates(candidates: AssetCandidate[]): Promise<void> {
  await Promise.all(candidates.map((candidate) => saveAssetCandidate(candidate)));
}

async function getSceneCandidatesWithProject(sceneId: string): Promise<{
  scene: Scene;
  project: ProjectRecord;
  candidates: AssetCandidate[];
}> {
  const scene = getSceneOrThrow(sceneId, await getScene(sceneId));
  const project = getProjectOrThrow(scene.projectId, await getProjectById(scene.projectId));
  const scenes = await getScenesForProject(project.id);

  if (!hasApprovedScenePlan(project, scenes) || !project.workflow.sceneIds.includes(scene.id)) {
    throw new Error("Asset review requires the scene to remain in the approved scene plan.");
  }

  const candidates = await getAssetCandidatesForScene(project.id, scene.id);

  if (candidates.length === 0) {
    throw new Error("Generate image candidates for this scene before selecting or approving one.");
  }

  return {
    scene,
    project,
    candidates: sortAssetCandidates(candidates),
  };
}

function resolveCandidateByReference(
  candidates: AssetCandidate[],
  candidateReference: string | number,
): AssetCandidate {
  const matchedCandidate =
    typeof candidateReference === "number"
      ? candidates.find((candidate) => candidate.candidateIndex === candidateReference)
      : candidates.find((candidate) => candidate.id === candidateReference);

  if (!matchedCandidate) {
    throw new Error("Selected image candidate could not be found for this scene.");
  }

  return matchedCandidate;
}

function sceneHasApprovedSelectedImage(scene: Scene, assets: AssetCandidate[]): boolean {
  return assets.some(
    (candidate) =>
      candidate.sceneId === scene.id &&
      candidate.selected &&
      candidate.approvalStatus === "approved",
  );
}

function getStatusAfterImagePlanApproval(project: ProjectRecord): ProjectStatus {
  switch (project.status) {
    case "narration_pending":
    case "images_ready":
    case "voice_ready":
    case "timeline_ready":
    case "rendered":
      return project.status;
    default:
      return "images_ready";
  }
}

export async function generateSceneImages(
  projectId: string,
  sceneId: string,
  options: GenerateSceneImagesOptions = {},
): Promise<AssetCandidate[]> {
  const { project, scene } = await getApprovedSceneContext(projectId, sceneId);
  const existingCandidates = await getAssetCandidatesForScene(project.id, scene.id);
  const candidateCount = clampCandidateCount(options.numCandidates);
  const imageBuffers = await generateImageBuffers(scene, candidateCount);
  const nextCandidates = await persistGeneratedCandidates(scene, imageBuffers);
  const nextProjectStatus = existingCandidates.length > 0 ? getFallbackProjectStatus(project) : project.status;

  await invalidateDownstreamArtifacts(project, nextProjectStatus);

  await replaceAssetCandidateIdsForProject(
    project.id,
    existingCandidates.map((candidate) => candidate.id),
    nextCandidates.map((candidate) => candidate.id),
    nextProjectStatus,
  );

  await Promise.all(existingCandidates.map((candidate) => deleteAssetCandidate(candidate.id)));

  return sortAssetCandidates(nextCandidates);
}

export async function selectSceneImage(
  sceneId: string,
  candidateReference: string | number,
): Promise<AssetCandidate[]> {
  const { project, candidates } = await getSceneCandidatesWithProject(sceneId);
  const targetCandidate = resolveCandidateByReference(candidates, candidateReference);

  if (targetCandidate.selected) {
    return sortAssetCandidates(candidates);
  }

  const updatedAt = new Date().toISOString();

  const updatedCandidates: AssetCandidate[] = candidates.map((candidate) => {
    const isTargetCandidate = candidate.id === targetCandidate.id;

    return {
      ...candidate,
      selected: isTargetCandidate,
      approvalStatus:
        isTargetCandidate
          ? "pending"
          : candidate.approvalStatus === "approved"
            ? "pending"
            : candidate.approvalStatus,
      updatedAt,
    };
  });

  await saveCandidates(updatedCandidates);
  await invalidateDownstreamArtifacts(project, getFallbackProjectStatus(project));

  return sortAssetCandidates(updatedCandidates);
}

export async function approveSelectedSceneImage(sceneId: string): Promise<AssetCandidate[]> {
  const { candidates } = await getSceneCandidatesWithProject(sceneId);
  const selectedCandidate = getSelectedCandidate(candidates);

  if (!selectedCandidate) {
    throw new Error("Select an image candidate before approving it.");
  }

  const updatedAt = new Date().toISOString();
  const updatedCandidates: AssetCandidate[] = candidates.map((candidate) => ({
    ...candidate,
    approvalStatus:
      candidate.id === selectedCandidate.id
        ? "approved"
        : candidate.approvalStatus === "approved"
          ? "pending"
          : candidate.approvalStatus,
    updatedAt: candidate.id === selectedCandidate.id ? updatedAt : candidate.updatedAt,
  }));

  await saveCandidates(updatedCandidates);
  return sortAssetCandidates(updatedCandidates);
}

export async function rejectSelectedSceneImage(sceneId: string): Promise<AssetCandidate[]> {
  const { project, candidates } = await getSceneCandidatesWithProject(sceneId);
  const selectedCandidate = getSelectedCandidate(candidates);

  if (!selectedCandidate) {
    throw new Error("Select an image candidate before rejecting it.");
  }

  const updatedAt = new Date().toISOString();
  const updatedCandidates: AssetCandidate[] = candidates.map((candidate) => ({
    ...candidate,
    approvalStatus: candidate.id === selectedCandidate.id ? "rejected" : candidate.approvalStatus,
    updatedAt: candidate.id === selectedCandidate.id ? updatedAt : candidate.updatedAt,
  }));

  await saveCandidates(updatedCandidates);
  await invalidateDownstreamArtifacts(project, getFallbackProjectStatus(project));

  return sortAssetCandidates(updatedCandidates);
}

export async function approveImagePlan(projectId: string): Promise<void> {
  const project = getProjectOrThrow(projectId, await getProjectById(projectId));
  const scenes = await getScenesForProject(project.id);

  if (!hasApprovedScenePlan(project, scenes)) {
    throw new Error("Image approval requires an approved scene plan.");
  }

  const assetCandidates = await getAssetCandidatesForProject(project.id);

  const missingApprovedSelections = scenes.filter((scene) => !sceneHasApprovedSelectedImage(scene, assetCandidates));
  if (missingApprovedSelections.length > 0) {
    throw new Error("Every approved scene must have one selected and approved image before the image plan can be approved.");
  }

  await setProjectStatus(project.id, getStatusAfterImagePlanApproval(project), {
    imagePlanApprovedAt: new Date().toISOString(),
  });
}

export async function getAssetCandidateById(assetId: string): Promise<AssetCandidate | null> {
  return getAssetCandidate(assetId);
}
