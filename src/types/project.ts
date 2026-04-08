export type ProjectStatus =
  | "draft"
  | "script_ready"
  | "scene_planning"
  | "scene_ready"
  | "narration_pending"
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
  imagePlanApprovedAt?: string;
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

export interface LlmMeta {
  promptId: string;
  promptVersion: number;
  model: string;
  temperature: number;
}

export type ScriptDraftApprovalStatus = "pending" | "approved" | "rejected";
export type StoryDraftSource = "generated" | "manual_edit";

export interface StoryDraftRecord {
  id: string;
  createdAt: string;
  versionLabel: string;
  titleOptions: string[];
  hook: string;
  fullNarrationDraft: string;
  notes?: string;
  approvalStatus: ScriptDraftApprovalStatus;
  source: StoryDraftSource;
  derivedFromDraftId?: string;
  sceneOutline: StorySceneOutlineItem[];
  llmMeta?: LlmMeta;
}

export interface Project {
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

export type ProjectRecord = Project;

export interface CreateProjectInput {
  name: string;
  premise: string;
}
