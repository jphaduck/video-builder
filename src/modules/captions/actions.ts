"use server";

import { revalidatePath } from "next/cache";
import type { CaptionTrack } from "@/types/caption";
import {
  generateCaptionTrack,
  updateCaptionSegment,
  updateCaptionSegmentTiming,
} from "@/modules/captions/service";

export type CaptionActionResult<T> = { success: true; data: T } | { success: false; error: string };

function buildSuccessResult<T>(data: T): CaptionActionResult<T> {
  return { success: true, data };
}

function buildErrorResult(error: unknown): CaptionActionResult<never> {
  return {
    success: false,
    error: error instanceof Error ? error.message : "Something went wrong while processing the caption action.",
  };
}

function revalidateProjectPath(projectId: string): void {
  revalidatePath(`/projects/${projectId}`);
}

export async function generateCaptionTrackAction(
  projectId: string,
  narrationTrackId: string,
): Promise<CaptionActionResult<CaptionTrack>> {
  try {
    const track = await generateCaptionTrack(projectId, narrationTrackId);
    revalidateProjectPath(projectId);
    return buildSuccessResult(track);
  } catch (error) {
    return buildErrorResult(error);
  }
}

export async function updateCaptionSegmentAction(
  trackId: string,
  segmentId: string,
  text: string,
): Promise<CaptionActionResult<CaptionTrack>> {
  try {
    const track = await updateCaptionSegment(trackId, segmentId, text);
    revalidateProjectPath(track.projectId);
    return buildSuccessResult(track);
  } catch (error) {
    return buildErrorResult(error);
  }
}

export async function updateCaptionSegmentTimingAction(
  trackId: string,
  segmentId: string,
  startMs: number,
  endMs: number,
): Promise<CaptionActionResult<CaptionTrack>> {
  try {
    const track = await updateCaptionSegmentTiming(trackId, segmentId, startMs, endMs);
    revalidateProjectPath(track.projectId);
    return buildSuccessResult(track);
  } catch (error) {
    return buildErrorResult(error);
  }
}
