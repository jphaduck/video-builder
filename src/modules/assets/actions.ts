"use server";

import { revalidatePath } from "next/cache";
import {
  approveImagePlan,
  approveSelectedSceneImage,
  generateSceneImages,
  rejectSelectedSceneImage,
  selectSceneImage,
} from "@/modules/assets/service";
import type { AssetCandidate, GenerateSceneImagesOptions } from "@/modules/assets/types";

export type AssetActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

function buildSuccessResult<T>(data: T): AssetActionResult<T> {
  return { ok: true, data };
}

function buildErrorResult(error: unknown): AssetActionResult<never> {
  return {
    ok: false,
    error: error instanceof Error ? error.message : "Something went wrong while processing the asset action.",
  };
}

function revalidateProjectPath(projectId: string): void {
  revalidatePath(`/projects/${projectId}`);
}

export async function generateSceneImagesAction(
  projectId: string,
  sceneId: string,
  options: GenerateSceneImagesOptions = {},
): Promise<AssetActionResult<AssetCandidate[]>> {
  try {
    const candidates = await generateSceneImages(projectId, sceneId, options);
    revalidateProjectPath(projectId);
    return buildSuccessResult(candidates);
  } catch (error) {
    return buildErrorResult(error);
  }
}

export async function selectSceneImageAction(
  projectId: string,
  sceneId: string,
  candidateReference: string | number,
): Promise<AssetActionResult<AssetCandidate[]>> {
  try {
    const candidates = await selectSceneImage(sceneId, candidateReference);
    revalidateProjectPath(projectId);
    return buildSuccessResult(candidates);
  } catch (error) {
    return buildErrorResult(error);
  }
}

export async function approveSelectedSceneImageAction(
  projectId: string,
  sceneId: string,
): Promise<AssetActionResult<AssetCandidate[]>> {
  try {
    const candidates = await approveSelectedSceneImage(sceneId);
    revalidateProjectPath(projectId);
    return buildSuccessResult(candidates);
  } catch (error) {
    return buildErrorResult(error);
  }
}

export async function rejectSelectedSceneImageAction(
  projectId: string,
  sceneId: string,
): Promise<AssetActionResult<AssetCandidate[]>> {
  try {
    const candidates = await rejectSelectedSceneImage(sceneId);
    revalidateProjectPath(projectId);
    return buildSuccessResult(candidates);
  } catch (error) {
    return buildErrorResult(error);
  }
}

export async function approveImagePlanAction(projectId: string): Promise<AssetActionResult<null>> {
  try {
    await approveImagePlan(projectId);
    revalidateProjectPath(projectId);
    return buildSuccessResult(null);
  } catch (error) {
    return buildErrorResult(error);
  }
}
