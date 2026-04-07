"use server";

import { revalidatePath } from "next/cache";
import {
  approveScene,
  approveScenePlan,
  generateScenePlan,
  regenerateScenePlan,
  regenerateImagePrompt,
  regenerateScene,
  rejectScene,
  updateScene,
} from "@/modules/scenes/service";
import type { Scene, SceneUpdateInput } from "@/types/scene";

export type SceneActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

function buildSuccessResult<T>(data: T): SceneActionResult<T> {
  return { ok: true, data };
}

function buildErrorResult(error: unknown): SceneActionResult<never> {
  return {
    ok: false,
    error: error instanceof Error ? error.message : "Something went wrong while processing the scene action.",
  };
}

function revalidateProjectPath(projectId: string): void {
  revalidatePath(`/projects/${projectId}`);
}

export async function generateScenePlanAction(projectId: string): Promise<SceneActionResult<Scene[]>> {
  try {
    const scenes = await generateScenePlan(projectId);
    revalidateProjectPath(projectId);
    return buildSuccessResult(scenes);
  } catch (error) {
    return buildErrorResult(error);
  }
}

export async function regenerateScenePlanAction(projectId: string): Promise<SceneActionResult<Scene[]>> {
  try {
    const scenes = await regenerateScenePlan(projectId);
    revalidateProjectPath(projectId);
    return buildSuccessResult(scenes);
  } catch (error) {
    return buildErrorResult(error);
  }
}

export async function updateSceneAction(
  sceneId: string,
  updates: SceneUpdateInput,
): Promise<SceneActionResult<Scene>> {
  try {
    const scene = await updateScene(sceneId, updates);
    revalidateProjectPath(scene.projectId);
    return buildSuccessResult(scene);
  } catch (error) {
    return buildErrorResult(error);
  }
}

export async function regenerateSceneAction(sceneId: string): Promise<SceneActionResult<Scene>> {
  try {
    const scene = await regenerateScene(sceneId);
    revalidateProjectPath(scene.projectId);
    return buildSuccessResult(scene);
  } catch (error) {
    return buildErrorResult(error);
  }
}

export async function regenerateImagePromptAction(sceneId: string): Promise<SceneActionResult<Scene>> {
  try {
    const scene = await regenerateImagePrompt(sceneId);
    revalidateProjectPath(scene.projectId);
    return buildSuccessResult(scene);
  } catch (error) {
    return buildErrorResult(error);
  }
}

export async function approveSceneAction(sceneId: string): Promise<SceneActionResult<Scene>> {
  try {
    const scene = await approveScene(sceneId);
    revalidateProjectPath(scene.projectId);
    return buildSuccessResult(scene);
  } catch (error) {
    return buildErrorResult(error);
  }
}

export async function rejectSceneAction(sceneId: string): Promise<SceneActionResult<Scene>> {
  try {
    const scene = await rejectScene(sceneId);
    revalidateProjectPath(scene.projectId);
    return buildSuccessResult(scene);
  } catch (error) {
    return buildErrorResult(error);
  }
}

export async function approveScenePlanAction(projectId: string): Promise<SceneActionResult<null>> {
  try {
    await approveScenePlan(projectId);
    revalidateProjectPath(projectId);
    return buildSuccessResult(null);
  } catch (error) {
    return buildErrorResult(error);
  }
}
