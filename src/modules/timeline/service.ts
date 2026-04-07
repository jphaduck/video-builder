import { randomUUID } from "node:crypto";
import { getAssetCandidatesForProject } from "@/modules/assets/repository";
import { getCaptionTrack } from "@/modules/captions/repository";
import { getNarrationTrack } from "@/modules/narration/repository";
import { getProjectById } from "@/modules/projects/repository";
import { getScenesForProject } from "@/modules/scenes/repository";
import { getTimelineDraft as getStoredTimelineDraft, saveTimelineDraft } from "@/modules/timeline/repository";
import type { TimelineDraft } from "@/modules/timeline/types";

export async function buildTimelineDraft(projectId: string): Promise<TimelineDraft> {
  const project = await getProjectById(projectId);
  if (!project) {
    throw new Error(`Project not found: ${projectId}`);
  }

  const narrationTrackId = project.workflow.narrationTrackIds.at(-1);
  const captionTrackId = project.workflow.captionTrackIds.at(-1);
  if (!narrationTrackId || !captionTrackId) {
    throw new Error("Timeline draft requires narration and captions.");
  }

  const [scenes, assets, narrationTrack, captionTrack] = await Promise.all([
    getScenesForProject(project.id),
    getAssetCandidatesForProject(project.id),
    getNarrationTrack(narrationTrackId),
    getCaptionTrack(captionTrackId),
  ]);

  if (!narrationTrack || !captionTrack) {
    throw new Error("Timeline draft requires current narration and caption tracks.");
  }

  const now = new Date().toISOString();
  const draft: TimelineDraft = {
    id: randomUUID(),
    projectId: project.id,
    scenes,
    assets,
    narrationTrack,
    captionTrack,
    createdAt: now,
    updatedAt: now,
  };

  await saveTimelineDraft(draft);
  return draft;
}

export async function getTimelineDraftForProject(projectId: string): Promise<TimelineDraft | null> {
  return getStoredTimelineDraft(projectId);
}
