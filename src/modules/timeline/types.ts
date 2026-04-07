import type { CaptionTrack } from "@/types/caption";
import type { NarrationTrack } from "@/types/narration";
import type { Scene } from "@/types/scene";
import type { AssetCandidate } from "@/modules/assets/types";

export interface TimelineDraft {
  id: string;
  projectId: string;
  scenes: Scene[];
  assets: AssetCandidate[];
  narrationTrack: NarrationTrack;
  captionTrack: CaptionTrack;
  createdAt: string;
  updatedAt: string;
}
