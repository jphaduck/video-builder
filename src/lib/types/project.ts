export type ProjectStatus =
  | "draft"
  | "script_ready"
  | "scene_ready"
  | "images_ready"
  | "voice_ready"
  | "timeline_ready"
  | "rendered";

export interface Project {
  id: string;
  name: string;
  premise: string;
  createdAt: string;
  updatedAt: string;
  status: ProjectStatus;
}
