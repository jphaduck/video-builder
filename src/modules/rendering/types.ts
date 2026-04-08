export type RenderJobStatus = "pending" | "ready";

export interface RenderJob {
  id: string;
  projectId: string;
  timelineDraftId: string;
  status: RenderJobStatus;
  outputFilePath: string | null;
  createdAt: string;
  updatedAt: string;
}
