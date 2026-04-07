import { randomUUID } from "node:crypto";
import { getOpenAIClient } from "@/lib/ai";
import { approveScenePlanForProject, getProjectById, saveScenePlanForProject } from "@/modules/projects/repository";
import { getScene, getScenesForProject, saveScene } from "@/modules/scenes/repository";
import type { ProjectRecord, StoryDraftRecord } from "@/types/project";
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

const DURATION_RULES = `
- Hooks, reveals, and tension spikes: 8-18 seconds
- Transitions and connective tissue: 10-20 seconds
- Exposition and world-building: 20-45 seconds
- Emotional beats and major narration moments: 25-60 seconds
- Total scene durations should roughly match the project's target runtime in seconds
- Err toward more scenes over fewer; aim for roughly 1 scene per 20-35 seconds of runtime
`.trim();

const IMAGE_PROMPT_RULES = `
- Cinematic, suspenseful, polished YouTube storytelling tone
- No text or captions in the image
- Describe lighting, mood, framing, and setting
- Match the dramatic weight of the moment instead of illustrating sentences literally
- Write the prompt as a single descriptive paragraph, not a list
`.trim();

const SCENE_PLAN_SYSTEM_PROMPT = `
You are a senior scene planner for long-form YouTube story videos.
Convert an approved narration script into a scene plan for a slideshow-style video with still images.

Return strictly valid JSON only as an array. Do not wrap the array in an object. Do not include markdown.
Each array element must have this exact shape:
{
  "sceneNumber": number,
  "heading": string,
  "scriptExcerpt": string,
  "sceneSummary": string,
  "durationTargetSeconds": number,
  "visualIntent": string,
  "imagePrompt": string
}

Duration targeting rules:
${DURATION_RULES}

Image prompt rules:
${IMAGE_PROMPT_RULES}
`.trim();

const REGENERATE_SCENE_SYSTEM_PROMPT = `
You are regenerating one scene within an approved YouTube story scene plan.

Return strictly valid JSON only with this exact shape:
{
  "heading": string,
  "sceneSummary": string,
  "durationTargetSeconds": number,
  "visualIntent": string,
  "imagePrompt": string
}

Duration targeting rules:
${DURATION_RULES}

Image prompt rules:
${IMAGE_PROMPT_RULES}
`.trim();

const IMAGE_PROMPT_SYSTEM_PROMPT = `
You are refining one image prompt for a YouTube story scene.
Return only the new image prompt as a single descriptive paragraph.
Do not return JSON, labels, bullets, quotation marks, or markdown.

Image prompt rules:
${IMAGE_PROMPT_RULES}
`.trim();

function extractJsonPayload(content: string): string {
  const trimmed = content.trim();
  if (!trimmed.startsWith("```")) {
    return trimmed;
  }

  const withoutFencePrefix = trimmed.replace(/^```(?:json)?\s*/i, "");
  return withoutFencePrefix.replace(/\s*```$/, "").trim();
}

function parseJsonValue<T>(content: string, errorMessage: string): T {
  try {
    return JSON.parse(extractJsonPayload(content)) as T;
  } catch {
    throw new Error(errorMessage);
  }
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

function normalizeScenePlanItem(entry: GeneratedScenePlanItem): GeneratedScenePlanItem {
  if (!Number.isInteger(entry.sceneNumber) || entry.sceneNumber < 1) {
    throw new Error("Scene plan response included an invalid sceneNumber.");
  }
  if (typeof entry.heading !== "string" || !entry.heading.trim()) {
    throw new Error("Scene plan response included an invalid heading.");
  }
  if (typeof entry.scriptExcerpt !== "string" || !entry.scriptExcerpt.trim()) {
    throw new Error("Scene plan response included an invalid scriptExcerpt.");
  }
  if (typeof entry.sceneSummary !== "string" || !entry.sceneSummary.trim()) {
    throw new Error("Scene plan response included an invalid sceneSummary.");
  }
  if (!Number.isFinite(entry.durationTargetSeconds) || entry.durationTargetSeconds <= 0) {
    throw new Error("Scene plan response included an invalid durationTargetSeconds.");
  }
  if (typeof entry.visualIntent !== "string" || !entry.visualIntent.trim()) {
    throw new Error("Scene plan response included an invalid visualIntent.");
  }
  if (typeof entry.imagePrompt !== "string" || !entry.imagePrompt.trim()) {
    throw new Error("Scene plan response included an invalid imagePrompt.");
  }

  return {
    sceneNumber: entry.sceneNumber,
    heading: entry.heading.trim(),
    scriptExcerpt: entry.scriptExcerpt.trim(),
    sceneSummary: entry.sceneSummary.trim(),
    durationTargetSeconds: Math.max(1, Math.round(entry.durationTargetSeconds)),
    visualIntent: entry.visualIntent.trim(),
    imagePrompt: entry.imagePrompt.trim(),
  };
}

function parseScenePlanOutput(content: string): GeneratedScenePlanItem[] {
  const parsed = parseJsonValue<unknown>(content, "OpenAI response was not valid JSON for the scene plan.");
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("OpenAI response did not include a valid scene array.");
  }

  return parsed.map((entry) => {
    if (!entry || typeof entry !== "object") {
      throw new Error("Scene plan response included a non-object scene entry.");
    }

    return normalizeScenePlanItem(entry as GeneratedScenePlanItem);
  });
}

function parseRegeneratedSceneOutput(content: string): RegeneratedSceneOutput {
  const parsed = parseJsonValue<unknown>(content, "OpenAI response was not valid JSON for the regenerated scene.");
  if (!parsed || typeof parsed !== "object") {
    throw new Error("OpenAI response did not include a valid regenerated scene object.");
  }

  const normalized = normalizeScenePlanItem({
    sceneNumber: 1,
    scriptExcerpt: "placeholder",
    ...(parsed as RegeneratedSceneOutput),
  });

  return {
    heading: normalized.heading,
    sceneSummary: normalized.sceneSummary,
    durationTargetSeconds: normalized.durationTargetSeconds,
    visualIntent: normalized.visualIntent,
    imagePrompt: normalized.imagePrompt,
  };
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

  if (project.workflow.sceneIds.length > 0) {
    throw new Error("A scene plan already exists for this project.");
  }

  const openai = getOpenAIClient();
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    temperature: 0.4,
    messages: [
      { role: "system", content: SCENE_PLAN_SYSTEM_PROMPT },
      { role: "user", content: buildScenePlanUserPrompt(project, approvedDraft) },
    ],
  });

  const content = response.choices[0]?.message?.content?.trim();
  if (!content) {
    throw new Error("OpenAI returned an empty response.");
  }

  const scenePlanItems = parseScenePlanOutput(content).sort((a, b) => a.sceneNumber - b.sceneNumber);
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
    model: "gpt-4o",
    temperature: 0.5,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: REGENERATE_SCENE_SYSTEM_PROMPT },
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
  };

  await saveScene(updatedScene);
  return updatedScene;
}

export async function regenerateImagePrompt(sceneId: string): Promise<Scene> {
  const existingScene = getSceneOrThrow(sceneId, await getScene(sceneId));
  const openai = getOpenAIClient();

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    temperature: 0.6,
    messages: [
      { role: "system", content: IMAGE_PROMPT_SYSTEM_PROMPT },
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

  const content = response.choices[0]?.message?.content;
  const updatedScene: Scene = {
    ...existingScene,
    imagePrompt: normalizePromptText(content ?? ""),
    promptVersion: existingScene.promptVersion + 1,
    approvalStatus: "pending",
    source: "manual_edit",
    updatedAt: new Date().toISOString(),
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
