import { randomUUID } from "node:crypto";
import { addAssetCandidateIdsToProject, getProjectById } from "@/modules/projects/repository";
import {
  getAssetCandidatesForProject,
  saveAssetCandidate,
} from "@/modules/assets/repository";
import type { Scene } from "@/types/scene";
import type { AssetCandidate } from "@/modules/assets/types";

const DEFAULT_CANDIDATE_COUNT = 3;

function buildAssetCandidate(scene: Scene, candidateIndex: number): AssetCandidate {
  const now = new Date().toISOString();

  return {
    id: randomUUID(),
    projectId: scene.projectId,
    sceneId: scene.id,
    sceneNumber: scene.sceneNumber,
    candidateIndex,
    prompt: scene.imagePrompt,
    source: "scene_approval",
    status: "pending",
    createdAt: now,
    updatedAt: now,
  };
}

export async function ensureAssetCandidatesForScene(scene: Scene): Promise<AssetCandidate[]> {
  const project = await getProjectById(scene.projectId);
  if (!project) {
    throw new Error(`Project not found: ${scene.projectId}`);
  }

  const existingCandidates = (await getAssetCandidatesForProject(scene.projectId)).filter(
    (candidate) => candidate.sceneId === scene.id,
  );
  if (existingCandidates.length > 0) {
    return existingCandidates;
  }

  const nextCandidates = Array.from({ length: DEFAULT_CANDIDATE_COUNT }, (_, index) =>
    buildAssetCandidate(scene, index + 1),
  );

  await Promise.all(nextCandidates.map((candidate) => saveAssetCandidate(candidate)));
  await addAssetCandidateIdsToProject(
    scene.projectId,
    nextCandidates.map((candidate) => candidate.id),
  );

  return nextCandidates;
}
