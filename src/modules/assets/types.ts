export type AssetApprovalStatus = "pending" | "approved" | "rejected";
export type AssetProvider = "openai";

export interface AssetCandidate {
  id: string;
  projectId: string;
  sceneId: string;
  sceneNumber: number;
  candidateIndex: number;
  imagePrompt: string;
  promptVersion: number;
  provider: AssetProvider;
  imageFilePath: string;
  selected: boolean;
  approvalStatus: AssetApprovalStatus;
  createdAt: string;
  updatedAt: string;
}

export interface GenerateSceneImagesOptions {
  numCandidates?: number;
}
