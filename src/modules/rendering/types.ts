export type RenderJobStatus = "pending" | "rendering" | "complete" | "error";

export interface RenderJob {
  id: string;
  projectId: string;
  timelineDraftId: string;
  status: RenderJobStatus;
  outputFilePath: string | null;
  errorMessage: string | null;
  progressMessage: string | null;
  createdAt: string;
  updatedAt: string;
}
