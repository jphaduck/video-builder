export type NarrationApprovalStatus = "pending" | "approved" | "rejected";
export type NarrationSource = "generated" | "regenerated";
export type NarrationVoiceName = "alloy" | "echo" | "onyx" | "nova" | "shimmer";

export interface NarrationSceneAudio {
  sceneId: string;
  sceneNumber: number;
  audioFilePath: string;
  durationSeconds: number;
  generatedAt: string;
}

export interface NarrationTrack {
  id: string;
  projectId: string;
  approvedScriptDraftId: string;
  approvedScenePlanId: string;
  voiceName: string;
  provider: "openai";
  speed: number;
  style: string | null;
  pronunciationOverrides: Record<string, string>;
  scenes: NarrationSceneAudio[];
  totalDurationSeconds: number;
  approvalStatus: NarrationApprovalStatus;
  source: NarrationSource;
  createdAt: string;
  updatedAt: string;
}

export interface GenerateNarrationTrackOptions {
  voiceName: NarrationVoiceName;
  speed: number;
  style: string | null;
  pronunciationOverrides: Record<string, string>;
}
