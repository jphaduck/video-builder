export type ProjectStatus =
  | "draft"
  | "script_ready"
  | "scene_ready"
  | "images_ready"
  | "voice_ready"
  | "timeline_ready"
  | "rendered";

export interface ProjectWorkflowRefs {
  scriptDraftIds: string[];
  sceneIds: string[];
  assetIds: string[];
  narrationTrackIds: string[];
  captionTrackIds: string[];
  renderJobIds: string[];
}

export interface StoryInput {
  premise: string;
  theme?: string;
  tone?: string;
  targetRuntimeMin?: number;
}

export interface ProjectRecord {
  id: string;
  name: string;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
  storyInput: StoryInput;
  workflow: ProjectWorkflowRefs;
}

export interface CreateProjectInput {
  name: string;
  premise: string;
}
