export type WorkflowModule =
  | "projects"
  | "scripts"
  | "scenes"
  | "assets"
  | "narration"
  | "captions"
  | "rendering"
  | "settings";

export interface WorkflowSection {
  module: WorkflowModule;
  title: string;
  description: string;
}
