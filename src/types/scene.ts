export type SceneApprovalStatus = "pending" | "approved" | "rejected";
export type SceneSource = "generated" | "manual_edit";

export interface Scene {
  id: string;
  projectId: string;
  approvedScriptDraftId: string;
  sceneNumber: number;
  heading: string;
  scriptExcerpt: string;
  sceneSummary: string;
  durationTargetSeconds: number;
  visualIntent: string;
  imagePrompt: string;
  promptVersion: number;
  approvalStatus: SceneApprovalStatus;
  source: SceneSource;
  createdAt: string;
  updatedAt: string;
}

export type SceneEditableFields = Pick<
  Scene,
  "heading" | "scriptExcerpt" | "sceneSummary" | "durationTargetSeconds" | "visualIntent" | "imagePrompt"
>;

export type SceneUpdateInput = Partial<SceneEditableFields>;

export type CreateSceneInput = Omit<
  Scene,
  "id" | "promptVersion" | "approvalStatus" | "source" | "createdAt" | "updatedAt"
>;
