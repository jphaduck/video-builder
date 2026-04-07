import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AssetPanel } from "@/components/asset-panel";
import type { AssetCandidate } from "@/modules/assets/types";
import type { Scene } from "@/types/scene";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn(),
  }),
}));

vi.mock("next/image", () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => <img {...props} alt={props.alt ?? ""} />,
}));

vi.mock("@/modules/assets/actions", () => ({
  approveImagePlanAction: vi.fn(),
  approveSelectedSceneImageAction: vi.fn(),
  generateSceneImagesAction: vi.fn(),
  rejectSelectedSceneImageAction: vi.fn(),
  selectSceneImageAction: vi.fn(),
}));

function createScene(overrides: Partial<Scene> = {}): Scene {
  return {
    id: "scene-1",
    projectId: "project-1",
    approvedScriptDraftId: "draft-1",
    sceneNumber: 1,
    heading: "Threshold",
    scriptExcerpt: "You pause at the threshold.",
    sceneSummary: "The narrator establishes a tense threshold moment.",
    durationTargetSeconds: 18,
    visualIntent: "Make the viewer feel watched and boxed in by the doorway.",
    imagePrompt: "An empty hallway lit by a weak lamp spilling from the next room.",
    promptVersion: 2,
    approvalStatus: "approved",
    source: "generated",
    createdAt: "2026-04-07T00:00:00.000Z",
    updatedAt: "2026-04-07T00:00:00.000Z",
    ...overrides,
  };
}

function createAssetCandidate(overrides: Partial<AssetCandidate> = {}): AssetCandidate {
  return {
    id: "asset-1",
    projectId: "project-1",
    sceneId: "scene-1",
    sceneNumber: 1,
    candidateIndex: 1,
    imagePrompt: "An empty hallway lit by a weak lamp spilling from the next room.",
    promptVersion: 2,
    provider: "openai",
    imageFilePath: "data/assets/asset-1.png",
    selected: true,
    approvalStatus: "approved",
    createdAt: "2026-04-07T00:00:00.000Z",
    updatedAt: "2026-04-07T00:00:00.000Z",
    ...overrides,
  };
}

describe("AssetPanel", () => {
  it("keeps the image plan in a ready-to-approve state until the project-level approval happens", () => {
    render(
      <AssetPanel
        projectId="project-1"
        projectStatus="scene_ready"
        isScenePlanApproved
        isImagePlanApproved={false}
        scenes={[createScene()]}
        initialAssets={[createAssetCandidate()]}
      />,
    );

    expect(screen.queryByText(/Image plan approved\./i)).not.toBeInTheDocument();
    expect(
      screen.getByText(/Generate still-image candidates from each approved scene prompt/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Approve Image Plan" })).toBeEnabled();
  });
});
