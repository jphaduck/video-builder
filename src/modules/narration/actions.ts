"use server";

import { revalidatePath } from "next/cache";
import type { NarrationTrack, GenerateNarrationTrackOptions } from "@/types/narration";
import {
  approveNarrationTrack,
  generateNarrationTrack,
  regenerateNarrationTrack,
  rejectNarrationTrack,
} from "@/modules/narration/service";

export type NarrationActionResult<T> = { success: true; data: T } | { success: false; error: string };

function buildSuccessResult<T>(data: T): NarrationActionResult<T> {
  return { success: true, data };
}

function buildErrorResult(error: unknown): NarrationActionResult<never> {
  return {
    success: false,
    error: error instanceof Error ? error.message : "Something went wrong while processing the narration action.",
  };
}

function revalidateProjectPath(projectId: string): void {
  revalidatePath(`/projects/${projectId}`);
}

export async function generateNarrationTrackAction(
  projectId: string,
  options: GenerateNarrationTrackOptions,
): Promise<NarrationActionResult<NarrationTrack>> {
  try {
    const track = await generateNarrationTrack(projectId, options);
    revalidateProjectPath(projectId);
    return buildSuccessResult(track);
  } catch (error) {
    return buildErrorResult(error);
  }
}

export async function approveNarrationTrackAction(
  trackId: string,
  projectId: string,
): Promise<NarrationActionResult<NarrationTrack>> {
  try {
    const track = await approveNarrationTrack(trackId, projectId);
    revalidateProjectPath(projectId);
    return buildSuccessResult(track);
  } catch (error) {
    return buildErrorResult(error);
  }
}

export async function rejectNarrationTrackAction(trackId: string): Promise<NarrationActionResult<NarrationTrack>> {
  try {
    const track = await rejectNarrationTrack(trackId);
    revalidateProjectPath(track.projectId);
    return buildSuccessResult(track);
  } catch (error) {
    return buildErrorResult(error);
  }
}

export async function regenerateNarrationTrackAction(
  trackId: string,
  projectId: string,
  options: GenerateNarrationTrackOptions,
): Promise<NarrationActionResult<NarrationTrack>> {
  try {
    const track = await regenerateNarrationTrack(trackId, projectId, options);
    revalidateProjectPath(projectId);
    return buildSuccessResult(track);
  } catch (error) {
    return buildErrorResult(error);
  }
}
