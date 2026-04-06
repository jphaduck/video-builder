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
  plotNotes?: string;
  targetRuntimeMin?: number;
}

export interface StorySceneOutlineItem {
  sceneNumber: number;
  heading: string;
  summary: string;
}

export type ScriptDraftApprovalStatus = "pending" | "approved";

export interface StoryDraftRecord {
  id: string;
  createdAt: string;
  versionLabel: string;
  titleOptions: string[];
  hook: string;
  fullNarrationDraft: string;
  notes?: string;
  approvalStatus: ScriptDraftApprovalStatus;
  sceneOutline: StorySceneOutlineItem[];
}

export interface ProjectRecord {
  id: string;
  name: string;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
  storyInput: StoryInput;
  scriptDrafts: StoryDraftRecord[];
  activeScriptDraftId?: string;
  approvedScriptDraftId?: string;
  latestScriptDraftId?: string;
  storyDraft?: StoryDraftRecord;
  workflow: ProjectWorkflowRefs;
}

export interface CreateProjectInput {
  name: string;
  premise: string;
}
