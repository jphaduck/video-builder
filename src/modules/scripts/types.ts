export interface StoryGenerationInput {
  projectName: string;
  premise: string;
  theme?: string;
  tone?: string;
  plotNotes?: string;
  targetRuntimeMin: number;
}

export interface GeneratedSceneOutlineItem {
  sceneNumber: number;
  heading: string;
  summary: string;
}

export interface GeneratedStoryDraft {
  titleOptions: string[];
  hook: string;
  narrationDraft: string;
  notes?: string;
  sceneOutline: GeneratedSceneOutlineItem[];
}
