export type AssetCandidateStatus = "pending" | "approved" | "rejected";
export type AssetCandidateSource = "scene_approval";

export interface AssetCandidate {
  id: string;
  projectId: string;
  sceneId: string;
  sceneNumber: number;
  candidateIndex: number;
  prompt: string;
  source: AssetCandidateSource;
  status: AssetCandidateStatus;
  createdAt: string;
  updatedAt: string;
}
