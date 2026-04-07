import { randomUUID } from "node:crypto";
import { getProjectById } from "@/modules/projects/repository";
import { saveRenderJob } from "@/modules/rendering/repository";
import type { RenderJob } from "@/modules/rendering/types";

export async function createRenderJob(projectId: string, timelineDraftId: string): Promise<RenderJob> {
  const project = await getProjectById(projectId);
  if (!project) {
    throw new Error(`Project not found: ${projectId}`);
  }

  const now = new Date().toISOString();
  const job: RenderJob = {
    id: randomUUID(),
    projectId,
    timelineDraftId,
    status: "pending",
    outputFilePath: null,
    createdAt: now,
    updatedAt: now,
  };

  await saveRenderJob(job);
  return job;
}
