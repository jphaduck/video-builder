"use server";

import { revalidatePath } from "next/cache";
import { setProjectStatus } from "@/modules/projects/repository";
import { buildTimelineDraft } from "@/modules/timeline/service";
import type { TimelineDraft } from "@/modules/timeline/types";

export type TimelineActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

function buildSuccessResult<T>(data: T): TimelineActionResult<T> {
  return { ok: true, data };
}

function buildErrorResult(error: unknown): TimelineActionResult<never> {
  return {
    ok: false,
    error: error instanceof Error ? error.message : "Something went wrong while processing the timeline action.",
  };
}

function revalidateProjectPath(projectId: string): void {
  revalidatePath(`/projects/${projectId}`);
}

export async function buildTimelineForProjectAction(projectId: string): Promise<TimelineActionResult<TimelineDraft>> {
  try {
    const draft = await buildTimelineDraft(projectId);
    await setProjectStatus(projectId, "timeline_ready", { clearRenderJobIds: true });
    revalidateProjectPath(projectId);
    return buildSuccessResult(draft);
  } catch (error) {
    return buildErrorResult(error);
  }
}
