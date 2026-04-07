import { beforeEach, describe, expect, it, vi } from "vitest";
import { getOpenAIClient } from "@/lib/ai";
import {
  approveScenePlanForProject,
  clearScenePlanForProject,
  getProjectById,
  saveScenePlanForProject,
} from "@/modules/projects/repository";
import { deleteScene, getScenesForProject, saveScene } from "@/modules/scenes/repository";
import { approveScenePlan, clearScenePlan, generateScenePlan, regenerateScenePlan } from "@/modules/scenes/service";
import type { ProjectRecord, StoryDraftRecord } from "@/types/project";
import type { Scene } from "@/types/scene";

vi.mock("@/lib/ai", () => ({
  getOpenAIClient: vi.fn(),
}));

vi.mock("@/modules/projects/repository", () => ({
  approveScenePlanForProject: vi.fn(),
  clearScenePlanForProject: vi.fn(),
  getProjectById: vi.fn(),
  saveScenePlanForProject: vi.fn(),
}));

vi.mock("@/modules/scenes/repository", () => ({
  deleteScene: vi.fn(),
  getScene: vi.fn(),
  getScenesForProject: vi.fn(),
  saveScene: vi.fn(),
}));

const mockedGetOpenAIClient = vi.mocked(getOpenAIClient);
const mockedApproveScenePlanForProject = vi.mocked(approveScenePlanForProject);
const mockedClearScenePlanForProject = vi.mocked(clearScenePlanForProject);
const mockedGetProjectById = vi.mocked(getProjectById);
const mockedSaveScenePlanForProject = vi.mocked(saveScenePlanForProject);
const mockedDeleteScene = vi.mocked(deleteScene);
const mockedGetScenesForProject = vi.mocked(getScenesForProject);
const mockedSaveScene = vi.mocked(saveScene);

function createDraft(overrides: Partial<StoryDraftRecord> = {}): StoryDraftRecord {
  return {
    id: "draft-1",
    createdAt: "2026-04-06T00:00:00.000Z",
    versionLabel: "v1",
    titleOptions: ["Title 1", "Title 2", "Title 3"],
    hook: "You hear the door click shut behind you.",
    fullNarrationDraft: "You step into a silent hallway and feel the air change around you.",
    approvalStatus: "approved",
    source: "generated",
    sceneOutline: [],
    ...overrides,
  };
}

function createProject(overrides: Partial<ProjectRecord> = {}): ProjectRecord {
  const approvedDraft = createDraft();

  return {
    id: "project-1",
    name: "Project One",
    status: "script_ready",
    createdAt: "2026-04-06T00:00:00.000Z",
    updatedAt: "2026-04-06T00:00:00.000Z",
    storyInput: {
      premise: "A quiet town hides something wrong.",
      targetRuntimeMin: 10,
    },
    scriptDrafts: [approvedDraft],
    activeScriptDraftId: approvedDraft.id,
    approvedScriptDraftId: approvedDraft.id,
    latestScriptDraftId: approvedDraft.id,
    storyDraft: approvedDraft,
    workflow: {
      scriptDraftIds: [approvedDraft.id],
      sceneIds: [],
      assetIds: [],
      narrationTrackIds: [],
      captionTrackIds: [],
      renderJobIds: [],
    },
    ...overrides,
  };
}

function createScene(overrides: Partial<Scene> = {}): Scene {
  return {
    id: "scene-1",
    projectId: "project-1",
    approvedScriptDraftId: "draft-1",
    sceneNumber: 1,
    heading: "Scene Heading",
    scriptExcerpt: "You pause at the threshold.",
    sceneSummary: "The narrator establishes a tense threshold moment.",
    durationTargetSeconds: 18,
    visualIntent: "Suspenseful framing with a sense of looming discovery.",
    imagePrompt:
      "A cinematic hallway at dusk, shallow depth of field, cool practical lighting, suspenseful mood, polished storytelling still.",
    promptVersion: 1,
    approvalStatus: "approved",
    source: "generated",
    createdAt: "2026-04-06T00:00:00.000Z",
    updatedAt: "2026-04-06T00:00:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();

  mockedGetOpenAIClient.mockReturnValue({
    chat: {
      completions: {
        create: vi.fn(),
      },
    },
  } as never);
  mockedDeleteScene.mockResolvedValue();
  mockedClearScenePlanForProject.mockResolvedValue(createProject({ workflow: { scriptDraftIds: ["draft-1"], sceneIds: [], assetIds: [], narrationTrackIds: [], captionTrackIds: [], renderJobIds: [] } }));
});

describe("generateScenePlan", () => {
  it("throws if no approvedScriptDraftId exists", async () => {
    mockedGetProjectById.mockResolvedValue(createProject({ approvedScriptDraftId: undefined }));

    await expect(generateScenePlan("project-1")).rejects.toThrow("Cannot generate scenes without an approved script.");
  });

  it("saves scenes and returns them sorted by sceneNumber", async () => {
    const createCompletion = vi.fn().mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify([
              {
                sceneNumber: 2,
                heading: "Reveal",
                scriptExcerpt: "You finally see the figure move.",
                sceneSummary: "The threat becomes visible.",
                durationTargetSeconds: 16,
                visualIntent: "A sharp reveal framed through the doorway.",
                imagePrompt:
                  "A suspenseful cinematic reveal through a doorway, moody side lighting, narrow framing, polished YouTube storytelling still.",
              },
              {
                sceneNumber: 1,
                heading: "Opening Beat",
                scriptExcerpt: "You step into the hallway and the house seems to listen.",
                sceneSummary: "The opening beat establishes tension and location.",
                durationTargetSeconds: 22,
                visualIntent: "Slow creeping tension in an empty interior.",
                imagePrompt:
                  "A dim hallway interior, suspenseful atmosphere, cinematic framing, soft practical light, polished storytelling still with no text.",
              },
            ]),
          },
        },
      ],
    });

    mockedGetProjectById.mockResolvedValue(createProject());
    mockedGetOpenAIClient.mockReturnValue({
      chat: {
        completions: {
          create: createCompletion,
        },
      },
    } as never);

    const scenes = await generateScenePlan("project-1");

    expect(scenes.map((scene) => scene.sceneNumber)).toEqual([1, 2]);
    expect(mockedSaveScene).toHaveBeenCalledTimes(2);
    expect(mockedSaveScene.mock.calls.map(([scene]) => scene.sceneNumber)).toEqual([1, 2]);
    expect(mockedSaveScenePlanForProject).toHaveBeenCalledWith(
      "project-1",
      expect.arrayContaining([expect.any(String), expect.any(String)]),
    );
  });

  it("throws when the scene plan response is malformed JSON", async () => {
    const createCompletion = vi.fn().mockResolvedValue({
      choices: [{ message: { content: "not-json" } }],
    });

    mockedGetProjectById.mockResolvedValue(createProject());
    mockedGetOpenAIClient.mockReturnValue({
      chat: {
        completions: {
          create: createCompletion,
        },
      },
    } as never);

    await expect(generateScenePlan("project-1")).rejects.toThrow("OpenAI response was not valid JSON for the scene plan.");
  });

  it("parses scene plans wrapped in markdown fences", async () => {
    const createCompletion = vi.fn().mockResolvedValue({
      choices: [
        {
          message: {
            content: `\`\`\`json\n${JSON.stringify([
              {
                sceneNumber: 1,
                heading: "Opening Beat",
                scriptExcerpt: "You step into the hallway and the house seems to listen.",
                sceneSummary: "The opening beat establishes tension and location.",
                durationTargetSeconds: 22,
                visualIntent: "Introduces uncertainty and the feeling that the space is aware of the narrator.",
                imagePrompt:
                  "A narrow hallway lit by a single practical lamp, peeling wallpaper, tense negative space, wide shot that emphasizes the listener-like silence of the room.",
              },
            ])}\n\`\`\``,
          },
        },
      ],
    });

    mockedGetProjectById.mockResolvedValue(createProject());
    mockedGetOpenAIClient.mockReturnValue({
      chat: {
        completions: {
          create: createCompletion,
        },
      },
    } as never);

    const scenes = await generateScenePlan("project-1");
    expect(scenes).toHaveLength(1);
    expect(scenes[0]?.sceneNumber).toBe(1);
  });

  it("fills safe defaults when scene objects are missing fields", async () => {
    const warningSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const createCompletion = vi.fn().mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify([
              {
                sceneNumber: 1,
              },
            ]),
          },
        },
      ],
    });

    mockedGetProjectById.mockResolvedValue(createProject());
    mockedGetOpenAIClient.mockReturnValue({
      chat: {
        completions: {
          create: createCompletion,
        },
      },
    } as never);

    const scenes = await generateScenePlan("project-1");

    expect(scenes[0]).toMatchObject({
      sceneNumber: 1,
      heading: "",
      scriptExcerpt: "",
      sceneSummary: "",
      durationTargetSeconds: 20,
      visualIntent: "",
      imagePrompt: "",
    });
    expect(warningSpy).toHaveBeenCalled();
    warningSpy.mockRestore();
  });
});

describe("approveScenePlan", () => {
  it("throws if any scene is not approved", async () => {
    mockedGetProjectById.mockResolvedValue(createProject());
    mockedGetScenesForProject.mockResolvedValue([
      createScene({ id: "scene-1", approvalStatus: "approved" }),
      createScene({ id: "scene-2", sceneNumber: 2, approvalStatus: "pending" }),
    ]);

    await expect(approveScenePlan("project-1")).rejects.toThrow(
      "All scenes must be individually approved before the plan can be approved.",
    );
    expect(mockedApproveScenePlanForProject).not.toHaveBeenCalled();
  });

  it("succeeds when all scenes are approved", async () => {
    mockedGetProjectById.mockResolvedValue(createProject());
    mockedGetScenesForProject.mockResolvedValue([
      createScene({ id: "scene-1", approvalStatus: "approved" }),
      createScene({ id: "scene-2", sceneNumber: 2, approvalStatus: "approved" }),
    ]);

    await expect(approveScenePlan("project-1")).resolves.toBeUndefined();
    expect(mockedApproveScenePlanForProject).toHaveBeenCalledWith("project-1");
  });
});

describe("clearScenePlan", () => {
  it("removes scene files and empties workflow.sceneIds", async () => {
    const project = createProject({
      workflow: {
        scriptDraftIds: ["draft-1"],
        sceneIds: ["scene-1", "scene-2"],
        assetIds: [],
        narrationTrackIds: [],
        captionTrackIds: [],
        renderJobIds: [],
      },
    });

    mockedGetProjectById.mockResolvedValue(project);
    mockedClearScenePlanForProject.mockResolvedValue({
      ...project,
      workflow: {
        ...project.workflow,
        sceneIds: [],
      },
    });

    const updatedProject = await clearScenePlan("project-1");

    expect(mockedClearScenePlanForProject).toHaveBeenCalledWith("project-1", "script_ready");
    expect(updatedProject.workflow.sceneIds).toEqual([]);
  });
});

describe("regenerateScenePlan", () => {
  it("clears current scenes before generating a fresh plan", async () => {
    const warningSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const projectWithScenes = createProject({
      workflow: {
        scriptDraftIds: ["draft-1"],
        sceneIds: ["scene-1"],
        assetIds: [],
        narrationTrackIds: [],
        captionTrackIds: [],
        renderJobIds: [],
      },
    });
    const clearedProject = createProject();
    const createCompletion = vi.fn().mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify([
              {
                sceneNumber: 1,
                heading: "Fresh Scene",
                scriptExcerpt: "You hear the floorboards groan beneath you.",
                sceneSummary: "The plan restarts with a new opening tension beat.",
                durationTargetSeconds: 20,
                visualIntent: "Re-establishes suspense after the reset.",
                imagePrompt:
                  "A weathered interior hallway at night, light leaking from a side room, high-detail painterly realism, wide shot with heavy shadow textures.",
              },
            ]),
          },
        },
      ],
    });

    mockedGetProjectById.mockResolvedValue(clearedProject);
    mockedGetProjectById.mockResolvedValueOnce(projectWithScenes);
    mockedClearScenePlanForProject.mockResolvedValue(clearedProject);
    mockedGetOpenAIClient.mockReturnValue({
      chat: {
        completions: {
          create: createCompletion,
        },
      },
    } as never);

    const scenes = await regenerateScenePlan("project-1");

    expect(mockedClearScenePlanForProject).toHaveBeenCalledWith("project-1", "script_ready");
    expect(scenes).toHaveLength(1);
    warningSpy.mockRestore();
  });
});
