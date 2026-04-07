import { randomUUID } from "node:crypto";
import { getOpenAIClient } from "@/lib/ai";
import {
  IMAGE_PROMPT_REFINEMENT_PROMPT,
  REGENERATE_SCENE_PROMPT,
  SCENE_PLAN_PROMPT,
  getPromptMeta,
} from "@/lib/prompts";
import { ensureAssetCandidatesForScene } from "@/modules/assets/service";
import {
  approveScenePlanForProject,
  clearScenePlanForProject,
  getProjectById,
  saveScenePlanForProject,
} from "@/modules/projects/repository";
import { getScene, getScenesForProject, saveScene } from "@/modules/scenes/repository";
import type { ProjectRecord, ProjectStatus, StoryDraftRecord } from "@/types/project";
import type { CreateSceneInput, Scene, SceneUpdateInput } from "@/types/scene";

type GeneratedScenePlanItem = {
  sceneNumber: number;
  heading: string;
  scriptExcerpt: string;
  sceneSummary: string;
  durationTargetSeconds: number;
  visualIntent: string;
  imagePrompt: string;
};

type RegeneratedSceneOutput = Omit<GeneratedScenePlanItem, "sceneNumber" | "scriptExcerpt">;

function extractJson(raw: string): unknown {
  const stripped = raw.replace(/^```(?:json)?\n?/m, "").replace(/\n?```$/m, "").trim();
  return JSON.parse(stripped);
}

function parseJsonValue<T>(content: string, errorMessage: string): T {
  try {
    return extractJson(content) as T;
  } catch {
    throw new Error(errorMessage);
  }
}

function logSceneFieldWarning(sceneIndex: number, field: string, fallbackValue: string | number): void {
  console.warn(
    `Scene plan generation returned scene ${sceneIndex} without a valid ${field}. Using fallback: ${JSON.stringify(fallbackValue)}.`,
  );
}

function getProjectOrThrow(projectId: string, project: ProjectRecord | null): ProjectRecord {
  if (!project) {
    throw new Error(`Project not found: ${projectId}`);
  }

  return project;
}

function getApprovedDraft(project: ProjectRecord): StoryDraftRecord {
  if (!project.approvedScriptDraftId) {
    throw new Error("Cannot generate scenes without an approved script.");
  }

  const approvedDraft = project.scriptDrafts.find((draft) => draft.id === project.approvedScriptDraftId);
  if (!approvedDraft) {
    throw new Error("Approved script draft could not be found.");
  }

  return approvedDraft;
}

function normalizeScenePlanItemWithFallback(entry: unknown, sceneIndex: number): GeneratedScenePlanItem {
  const sceneEntry = entry && typeof entry === "object" ? (entry as Partial<GeneratedScenePlanItem>) : {};
  const sceneNumber =
    Number.isInteger(sceneEntry.sceneNumber) && Number(sceneEntry.sceneNumber) > 0
      ? Number(sceneEntry.sceneNumber)
      : (logSceneFieldWarning(sceneIndex, "sceneNumber", sceneIndex), sceneIndex);

  const heading =
    typeof sceneEntry.heading === "string"
      ? sceneEntry.heading.trim()
      : (logSceneFieldWarning(sceneNumber, "heading", ""), "");
  const scriptExcerpt =
    typeof sceneEntry.scriptExcerpt === "string"
      ? sceneEntry.scriptExcerpt.trim()
      : (logSceneFieldWarning(sceneNumber, "scriptExcerpt", ""), "");
  const sceneSummary =
    typeof sceneEntry.sceneSummary === "string"
      ? sceneEntry.sceneSummary.trim()
      : (logSceneFieldWarning(sceneNumber, "sceneSummary", ""), "");
  const durationTargetSeconds =
    Number.isFinite(sceneEntry.durationTargetSeconds) && Number(sceneEntry.durationTargetSeconds) > 0
      ? Math.max(1, Math.round(Number(sceneEntry.durationTargetSeconds)))
      : (logSceneFieldWarning(sceneNumber, "durationTargetSeconds", 20), 20);
  const visualIntent =
    typeof sceneEntry.visualIntent === "string"
      ? sceneEntry.visualIntent.trim()
      : (logSceneFieldWarning(sceneNumber, "visualIntent", ""), "");
  const imagePrompt =
    typeof sceneEntry.imagePrompt === "string"
      ? sceneEntry.imagePrompt.trim()
      : (logSceneFieldWarning(sceneNumber, "imagePrompt", ""), "");

  return {
    sceneNumber,
    heading,
    scriptExcerpt,
    sceneSummary,
    durationTargetSeconds,
    visualIntent,
    imagePrompt,
  };
}

function parseScenePlanOutput(content: string): GeneratedScenePlanItem[] {
  const parsed = parseJsonValue<unknown>(content, "OpenAI response was not valid JSON for the scene plan.");
  if (!Array.isArray(parsed)) {
    throw new Error("Scene plan generation returned unexpected format. Expected an array of scenes.");
  }
  if (parsed.length === 0) {
    throw new Error("Scene plan generation returned an empty array of scenes.");
  }

  return parsed.map((entry, index) => normalizeScenePlanItemWithFallback(entry, index + 1));
}

function parseRegeneratedSceneOutput(content: string): RegeneratedSceneOutput {
  const parsed = parseJsonValue<unknown>(content, "OpenAI response was not valid JSON for the regenerated scene.");
  if (!parsed || typeof parsed !== "object") {
    throw new Error("OpenAI response did not include a valid regenerated scene object.");
  }

  const normalized = normalizeScenePlanItemWithFallback({
    sceneNumber: 1,
    scriptExcerpt: "placeholder",
    ...(parsed as RegeneratedSceneOutput),
  }, 1);

  return {
    heading: normalized.heading,
    sceneSummary: normalized.sceneSummary,
    durationTargetSeconds: normalized.durationTargetSeconds,
    visualIntent: normalized.visualIntent,
    imagePrompt: normalized.imagePrompt,
  };
}

function parseImagePromptOutput(content: string): string {
  const parsed = parseJsonValue<unknown>(
    content,
    "OpenAI response was not valid JSON for the regenerated image prompt.",
  );

  if (typeof parsed === "string") {
    return normalizePromptText(parsed);
  }

  if (parsed && typeof parsed === "object" && typeof (parsed as { imagePrompt?: unknown }).imagePrompt === "string") {
    return normalizePromptText((parsed as { imagePrompt: string }).imagePrompt);
  }

  throw new Error(
    "Image prompt regeneration returned unexpected format. Expected a string or an object with an imagePrompt string field.",
  );
}

function buildSceneRecord(input: CreateSceneInput): Scene {
  const timestamp = new Date().toISOString();

  return {
    id: randomUUID(),
    projectId: input.projectId,
    approvedScriptDraftId: input.approvedScriptDraftId,
    sceneNumber: input.sceneNumber,
    heading: input.heading,
    scriptExcerpt: input.scriptExcerpt,
    sceneSummary: input.sceneSummary,
    durationTargetSeconds: input.durationTargetSeconds,
    visualIntent: input.visualIntent,
    imagePrompt: input.imagePrompt,
    promptVersion: 1,
    approvalStatus: "pending",
    source: "generated",
    createdAt: timestamp,
    updatedAt: timestamp,
    llmMeta: input.llmMeta,
  };
}

function getSceneOrThrow(sceneId: string, scene: Scene | null): Scene {
  if (!scene) {
    throw new Error(`Scene not found: ${sceneId}`);
  }

  return scene;
}

function buildScenePlanUserPrompt(project: ProjectRecord, approvedDraft: StoryDraftRecord): string {
  const targetRuntimeMin = project.storyInput.targetRuntimeMin ?? 10;

  return `
Project name: ${project.name}
Theme: ${project.storyInput.theme ?? "Not provided"}
Premise: ${project.storyInput.premise}
Tone: ${project.storyInput.tone ?? "Not provided"}
Plot notes: ${project.storyInput.plotNotes ?? "Not provided"}
Target runtime minutes: ${targetRuntimeMin}
Target runtime seconds: ${targetRuntimeMin * 60}

Approved narration script:
${approvedDraft.fullNarrationDraft}
`.trim();
}

function warnIfScenePlanLooksOff(scenes: GeneratedScenePlanItem[], runtimeMinutes: number): void {
  const expectedSeconds = runtimeMinutes * 60;
  const expectedMin = Math.floor(expectedSeconds / 45);
  const expectedMax = Math.ceil(expectedSeconds / 18);
  const count = scenes.length;

  if (count < expectedMin || count > expectedMax) {
    console.warn(
      `Scene plan generated ${count} scenes for a ${runtimeMinutes}-minute video. Expected between ${expectedMin} and ${expectedMax}. Proceeding anyway.`,
    );
  }

  const actualTotalSeconds = scenes.reduce((sum, scene) => sum + scene.durationTargetSeconds, 0);
  const allowedVariance = expectedSeconds * 0.25;
  if (Math.abs(actualTotalSeconds - expectedSeconds) > allowedVariance) {
    console.warn(
      `Scene plan duration totals ${actualTotalSeconds} seconds for a ${runtimeMinutes}-minute video. Expected about ${expectedSeconds} seconds. Proceeding anyway.`,
    );
  }
}

function buildRegenerateSceneUserPrompt(project: ProjectRecord, approvedDraft: StoryDraftRecord, scene: Scene, allScenes: Scene[]): string {
  const sortedScenes = [...allScenes].sort((a, b) => a.sceneNumber - b.sceneNumber || a.createdAt.localeCompare(b.createdAt));
  const sceneIndex = sortedScenes.findIndex((entry) => entry.id === scene.id);
  const previousScene = sceneIndex > 0 ? sortedScenes[sceneIndex - 1] : null;
  const nextScene = sceneIndex >= 0 && sceneIndex < sortedScenes.length - 1 ? sortedScenes[sceneIndex + 1] : null;
  const targetRuntimeMin = project.storyInput.targetRuntimeMin ?? 10;

  return `
Project name: ${project.name}
Target runtime minutes: ${targetRuntimeMin}
Target runtime seconds: ${targetRuntimeMin * 60}
Approved script draft ID: ${approvedDraft.id}

Current scene number: ${scene.sceneNumber}
Current heading: ${scene.heading}
Original script excerpt:
${scene.scriptExcerpt}

Current scene summary:
${scene.sceneSummary}

Current visual intent:
${scene.visualIntent}

Previous scene context:
${previousScene ? `${previousScene.heading}\n${previousScene.sceneSummary}` : "None"}

Next scene context:
${nextScene ? `${nextScene.heading}\n${nextScene.sceneSummary}` : "None"}

Approved narration script:
${approvedDraft.fullNarrationDraft}
`.trim();
}

function normalizePromptText(content: string): string {
  const trimmed = content.trim();
  if (!trimmed) {
    throw new Error("OpenAI returned an empty image prompt.");
  }

  if (trimmed.startsWith("\"") && trimmed.endsWith("\"")) {
    return trimmed.slice(1, -1).trim();
  }

  return trimmed;
}

export async function generateScenePlan(projectId: string): Promise<Scene[]> {
  const project = getProjectOrThrow(projectId, await getProjectById(projectId));
  const approvedDraft = getApprovedDraft(project);
  const runtimeMinutes = project.storyInput.targetRuntimeMin ?? 10;

  if (project.workflow.sceneIds.length > 0) {
    throw new Error("A scene plan already exists for this project.");
  }

  const openai = getOpenAIClient();
  const response = await openai.chat.completions.create({
    model: SCENE_PLAN_PROMPT.model,
    temperature: SCENE_PLAN_PROMPT.temperature,
    messages: [
      { role: "system", content: SCENE_PLAN_PROMPT.systemPrompt },
      { role: "user", content: buildScenePlanUserPrompt(project, approvedDraft) },
    ],
  });

  const content = response.choices[0]?.message?.content?.trim();
  if (!content) {
    throw new Error("OpenAI returned an empty response.");
  }

  const scenePlanItems = parseScenePlanOutput(content).sort((a, b) => a.sceneNumber - b.sceneNumber);
  warnIfScenePlanLooksOff(scenePlanItems, runtimeMinutes);
  const scenes = scenePlanItems.map((scenePlanItem) =>
    buildSceneRecord({
      projectId: project.id,
      approvedScriptDraftId: approvedDraft.id,
      sceneNumber: scenePlanItem.sceneNumber,
      heading: scenePlanItem.heading,
      scriptExcerpt: scenePlanItem.scriptExcerpt,
      sceneSummary: scenePlanItem.sceneSummary,
      durationTargetSeconds: scenePlanItem.durationTargetSeconds,
      visualIntent: scenePlanItem.visualIntent,
      imagePrompt: scenePlanItem.imagePrompt,
      llmMeta: getPromptMeta(SCENE_PLAN_PROMPT),
    }),
  );

  await Promise.all(scenes.map((scene) => saveScene(scene)));
  await saveScenePlanForProject(project.id, scenes.map((scene) => scene.id));

  return scenes.sort((a, b) => a.sceneNumber - b.sceneNumber || a.createdAt.localeCompare(b.createdAt));
}

export async function updateScene(sceneId: string, updates: SceneUpdateInput): Promise<Scene> {
  const existingScene = getSceneOrThrow(sceneId, await getScene(sceneId));
  const updatedScene: Scene = {
    ...existingScene,
    ...updates,
    approvalStatus: "pending",
    source: "manual_edit",
    updatedAt: new Date().toISOString(),
  };

  await saveScene(updatedScene);
  return updatedScene;
}

export async function regenerateScene(sceneId: string): Promise<Scene> {
  const existingScene = getSceneOrThrow(sceneId, await getScene(sceneId));
  const project = getProjectOrThrow(existingScene.projectId, await getProjectById(existingScene.projectId));
  const approvedDraft = getApprovedDraft(project);
  const projectScenes = await getScenesForProject(existingScene.projectId);
  const openai = getOpenAIClient();

  const response = await openai.chat.completions.create({
    model: REGENERATE_SCENE_PROMPT.model,
    temperature: REGENERATE_SCENE_PROMPT.temperature,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: REGENERATE_SCENE_PROMPT.systemPrompt },
      { role: "user", content: buildRegenerateSceneUserPrompt(project, approvedDraft, existingScene, projectScenes) },
    ],
  });

  const content = response.choices[0]?.message?.content?.trim();
  if (!content) {
    throw new Error("OpenAI returned an empty regenerated scene response.");
  }

  const regeneratedScene = parseRegeneratedSceneOutput(content);
  const updatedScene: Scene = {
    ...existingScene,
    heading: regeneratedScene.heading,
    sceneSummary: regeneratedScene.sceneSummary,
    durationTargetSeconds: regeneratedScene.durationTargetSeconds,
    visualIntent: regeneratedScene.visualIntent,
    imagePrompt: regeneratedScene.imagePrompt,
    promptVersion: existingScene.promptVersion + 1,
    approvalStatus: "pending",
    source: "generated",
    updatedAt: new Date().toISOString(),
    llmMeta: getPromptMeta(REGENERATE_SCENE_PROMPT),
  };

  await saveScene(updatedScene);
  return updatedScene;
}

export async function regenerateImagePrompt(sceneId: string): Promise<Scene> {
  const existingScene = getSceneOrThrow(sceneId, await getScene(sceneId));
  const openai = getOpenAIClient();

  const response = await openai.chat.completions.create({
    model: IMAGE_PROMPT_REFINEMENT_PROMPT.model,
    temperature: IMAGE_PROMPT_REFINEMENT_PROMPT.temperature,
    messages: [
      { role: "system", content: IMAGE_PROMPT_REFINEMENT_PROMPT.systemPrompt },
      {
        role: "user",
        content: `
Scene heading: ${existingScene.heading}
Scene summary: ${existingScene.sceneSummary}
Visual intent: ${existingScene.visualIntent}
Current image prompt: ${existingScene.imagePrompt}
        `.trim(),
      },
    ],
  });

  const content = response.choices[0]?.message?.content ?? "";
  const updatedScene: Scene = {
    ...existingScene,
    imagePrompt: parseImagePromptOutput(content),
    promptVersion: existingScene.promptVersion + 1,
    approvalStatus: "pending",
    source: "manual_edit",
    updatedAt: new Date().toISOString(),
    llmMeta: getPromptMeta(IMAGE_PROMPT_REFINEMENT_PROMPT),
  };

  await saveScene(updatedScene);
  return updatedScene;
}

export async function approveScene(sceneId: string): Promise<Scene> {
  const existingScene = getSceneOrThrow(sceneId, await getScene(sceneId));
  const updatedScene: Scene = {
    ...existingScene,
    approvalStatus: "approved",
    updatedAt: new Date().toISOString(),
  };

  await saveScene(updatedScene);
  await ensureAssetCandidatesForScene(updatedScene);
  return updatedScene;
}

export async function rejectScene(sceneId: string): Promise<Scene> {
  const existingScene = getSceneOrThrow(sceneId, await getScene(sceneId));
  const updatedScene: Scene = {
    ...existingScene,
    approvalStatus: "rejected",
    updatedAt: new Date().toISOString(),
  };

  await saveScene(updatedScene);
  return updatedScene;
}

export async function approveScenePlan(projectId: string): Promise<void> {
  const project = getProjectOrThrow(projectId, await getProjectById(projectId));
  const scenes = await getScenesForProject(project.id);

  if (scenes.length === 0) {
    throw new Error("Scene plan not found for this project.");
  }

  if (scenes.some((scene) => scene.approvalStatus !== "approved")) {
    throw new Error("All scenes must be individually approved before the plan can be approved.");
  }

  await approveScenePlanForProject(project.id);
}

export async function clearScenePlan(
  projectId: string,
  nextStatus: ProjectStatus = "script_ready",
): Promise<ProjectRecord> {
  const project = getProjectOrThrow(projectId, await getProjectById(projectId));
  return clearScenePlanForProject(project.id, nextStatus);
}

export async function regenerateScenePlan(projectId: string): Promise<Scene[]> {
  const project = getProjectOrThrow(projectId, await getProjectById(projectId));

  if (project.workflow.sceneIds.length > 0) {
    await clearScenePlan(project.id, "script_ready");
  }

  return generateScenePlan(projectId);
}
