export interface CaptionSegment {
  id: string;
  startMs: number;
  endMs: number;
  text: string;
  sceneId: string | null;
  sceneNumber: number | null;
  edited: boolean;
}

export interface CaptionTrack {
  id: string;
  projectId: string;
  narrationTrackId: string;
  language: "en";
  source: "whisper" | "manual";
  isStale: boolean;
  segments: CaptionSegment[];
  createdAt: string;
  updatedAt: string;
}
