import { randomUUID } from "node:crypto";
import type { ProjectRecord } from "@/types/project";
import type { NarrationSceneAudio, NarrationTrack, GenerateNarrationTrackOptions, NarrationVoiceName } from "@/types/narration";
import type { Scene } from "@/types/scene";
import { getOpenAIClient } from "@/lib/ai";
import {
  approveNarrationTrackForProject,
  getProjectById,
  replaceNarrationTrackForProject,
  saveNarrationTrackForProject,
} from "@/modules/projects/repository";
import { getScenesForProject } from "@/modules/scenes/repository";
import { getCaptionTrack, saveCaptionTrack } from "@/modules/captions/repository";
import {
  deleteNarrationTrack,
  getNarrationTrack,
  saveNarrationTrack,
  saveSceneAudioFile,
} from "@/modules/narration/repository";

const ALLOWED_TTS_VOICES = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"] as const;

function getProjectOrThrow(projectId: string, project: ProjectRecord | null): ProjectRecord {
  if (!project) {
    throw new Error(`Project not found: ${projectId}`);
  }

  return project;
}

function clampSpeed(speed: number): number {
  if (!Number.isFinite(speed)) {
    return 1;
  }

  return Math.min(2, Math.max(0.5, Number(speed)));
}

function ensureVoiceName(voiceName: string): NarrationVoiceName {
  if (!ALLOWED_TTS_VOICES.includes(voiceName as (typeof ALLOWED_TTS_VOICES)[number]) || voiceName === "fable") {
    throw new Error("Unsupported narration voice.");
  }

  return voiceName as NarrationVoiceName;
}

function applyPronunciationOverrides(input: string, overrides: Record<string, string>): string {
  let updatedInput = input;

  for (const [key, value] of Object.entries(overrides)) {
    if (!key.trim() || !value.trim()) {
      continue;
    }

    updatedInput = updatedInput.replaceAll(key, value);
  }

  return updatedInput;
}

function getApprovedScenePlanId(project: ProjectRecord): string {
  return project.workflow.sceneIds.join(",");
}

function ensureNarrationReadyProject(project: ProjectRecord): void {
  if (!project.approvedScriptDraftId) {
    throw new Error("Narration requires an approved script draft.");
  }

  if (project.status !== "scene_ready" || project.workflow.sceneIds.length === 0) {
    throw new Error("Narration requires an approved scene plan.");
  }
}

async function getApprovedScenesForNarration(project: ProjectRecord): Promise<Scene[]> {
  const scenes = await getScenesForProject(project.id);

  if (scenes.length === 0) {
    throw new Error("Narration requires an approved scene plan.");
  }

  if (scenes.some((scene) => scene.approvalStatus !== "approved")) {
    throw new Error("All scenes must be approved before narration can be generated.");
  }

  return scenes.sort((a, b) => a.sceneNumber - b.sceneNumber || a.createdAt.localeCompare(b.createdAt));
}

async function buildNarrationSceneAudios(
  trackId: string,
  scenes: Scene[],
  options: GenerateNarrationTrackOptions,
): Promise<NarrationSceneAudio[]> {
  const openai = getOpenAIClient();
  const voiceName = ensureVoiceName(options.voiceName);
  const speed = clampSpeed(options.speed);
  const narrationSceneAudios: NarrationSceneAudio[] = [];

  for (const scene of scenes) {
    const processedExcerpt = applyPronunciationOverrides(scene.scriptExcerpt, options.pronunciationOverrides);
    const response = await openai.audio.speech.create({
      model: "tts-1-hd",
      voice: voiceName,
      input: processedExcerpt,
      speed,
      response_format: "mp3",
    });
    const buffer = Buffer.from(await response.arrayBuffer());
    const audioFilePath = await saveSceneAudioFile(trackId, scene.sceneNumber, buffer);
    const wordCount = scene.scriptExcerpt.split(/\s+/).filter(Boolean).length;

    narrationSceneAudios.push({
      sceneId: scene.id,
      sceneNumber: scene.sceneNumber,
      audioFilePath,
      durationSeconds: Number((wordCount / (speed * 2.5)).toFixed(2)),
      generatedAt: new Date().toISOString(),
    });
  }

  return narrationSceneAudios;
}

async function persistNarrationTrack(
  project: ProjectRecord,
  scenes: Scene[],
  options: GenerateNarrationTrackOptions,
  previousTrackId?: string,
): Promise<NarrationTrack> {
  const trackId = randomUUID();
  const now = new Date().toISOString();
  const speed = clampSpeed(options.speed);
  const voiceName = ensureVoiceName(options.voiceName);
  const sceneAudios = await buildNarrationSceneAudios(trackId, scenes, {
    ...options,
    voiceName,
    speed,
  });

  const track: NarrationTrack = {
    id: trackId,
    projectId: project.id,
    approvedScriptDraftId: project.approvedScriptDraftId ?? "",
    approvedScenePlanId: getApprovedScenePlanId(project),
    voiceName,
    provider: "openai",
    speed,
    style: options.style?.trim() ? options.style.trim() : null,
    pronunciationOverrides: options.pronunciationOverrides,
    scenes: sceneAudios,
    totalDurationSeconds: Number(sceneAudios.reduce((sum, scene) => sum + scene.durationSeconds, 0).toFixed(2)),
    approvalStatus: "pending",
    source: previousTrackId ? "regenerated" : "generated",
    createdAt: now,
    updatedAt: now,
  };

  await saveNarrationTrack(track);

  if (previousTrackId) {
    await replaceNarrationTrackForProject(project.id, previousTrackId, track.id);
  } else {
    await saveNarrationTrackForProject(project.id, track.id);
  }

  return track;
}

export async function generateNarrationTrack(
  projectId: string,
  options: GenerateNarrationTrackOptions,
): Promise<NarrationTrack> {
  const project = getProjectOrThrow(projectId, await getProjectById(projectId));
  ensureNarrationReadyProject(project);

  if (project.workflow.narrationTrackIds.length > 0) {
    throw new Error("A narration track already exists for this project.");
  }

  const scenes = await getApprovedScenesForNarration(project);
  return persistNarrationTrack(project, scenes, options);
}

export async function approveNarrationTrack(trackId: string, projectId: string): Promise<NarrationTrack> {
  const track = await getNarrationTrack(trackId);
  if (!track) {
    throw new Error(`Narration track not found: ${trackId}`);
  }
  if (track.projectId !== projectId) {
    throw new Error("Narration track does not belong to this project.");
  }

  const updatedTrack: NarrationTrack = {
    ...track,
    approvalStatus: "approved",
    updatedAt: new Date().toISOString(),
  };

  await saveNarrationTrack(updatedTrack);
  await approveNarrationTrackForProject(projectId);
  return updatedTrack;
}

export async function rejectNarrationTrack(trackId: string): Promise<NarrationTrack> {
  const track = await getNarrationTrack(trackId);
  if (!track) {
    throw new Error(`Narration track not found: ${trackId}`);
  }

  const updatedTrack: NarrationTrack = {
    ...track,
    approvalStatus: "rejected",
    updatedAt: new Date().toISOString(),
  };

  await saveNarrationTrack(updatedTrack);
  return updatedTrack;
}

export async function regenerateNarrationTrack(
  trackId: string,
  projectId: string,
  options: GenerateNarrationTrackOptions,
): Promise<NarrationTrack> {
  const track = await getNarrationTrack(trackId);
  if (!track) {
    throw new Error(`Narration track not found: ${trackId}`);
  }

  const project = getProjectOrThrow(projectId, await getProjectById(projectId));
  ensureNarrationReadyProject(project);

  const latestCaptionTrackId = project.workflow.captionTrackIds.at(-1);
  if (latestCaptionTrackId) {
    const existingCaptionTrack = await getCaptionTrack(latestCaptionTrackId);
    if (existingCaptionTrack) {
      await saveCaptionTrack({
        ...existingCaptionTrack,
        isStale: true,
        updatedAt: new Date().toISOString(),
      });
    }
  }

  await deleteNarrationTrack(trackId);
  const scenes = await getApprovedScenesForNarration(project);
  return persistNarrationTrack(project, scenes, options, trackId);
}
