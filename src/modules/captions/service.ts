import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { getOpenAIClient } from "@/lib/ai";
import { getNarrationTrack } from "@/modules/narration/repository";
import { getProjectById, saveCaptionTrackForProject } from "@/modules/projects/repository";
import { getScenesForProject } from "@/modules/scenes/repository";
import { getCaptionTrack, saveCaptionExport, saveCaptionTrack } from "@/modules/captions/repository";
import type { CaptionSegment, CaptionTrack } from "@/types/caption";
import type { ProjectRecord } from "@/types/project";
import type { Scene } from "@/types/scene";

type WhisperWord = {
  word?: string;
  start?: number;
  end?: number;
};

type WhisperVerboseResponse = {
  words?: WhisperWord[];
};

function getProjectOrThrow(projectId: string, project: ProjectRecord | null): ProjectRecord {
  if (!project) {
    throw new Error(`Project not found: ${projectId}`);
  }

  return project;
}

function getCaptionTrackOrThrow(trackId: string, track: CaptionTrack | null): CaptionTrack {
  if (!track) {
    throw new Error(`Caption track not found: ${trackId}`);
  }

  return track;
}

function normalizeWord(word: WhisperWord): Required<Pick<WhisperWord, "word" | "start" | "end">> {
  return {
    word: typeof word.word === "string" ? word.word.trim() : "",
    start: Number.isFinite(word.start) ? Number(word.start) : 0,
    end: Number.isFinite(word.end) ? Number(word.end) : Number(word.start ?? 0),
  };
}

function shouldBreakSegment(word: string, currentCount: number): boolean {
  return currentCount >= 8 || /[.!?]["')\]]?$/.test(word);
}

function chunkWordsIntoSegments(words: WhisperWord[], scene: Scene, offsetMs: number): CaptionSegment[] {
  const segments: CaptionSegment[] = [];
  let pendingWords: ReturnType<typeof normalizeWord>[] = [];

  function flushPendingWords(): void {
    if (pendingWords.length === 0) {
      return;
    }

    const firstWord = pendingWords[0];
    const lastWord = pendingWords[pendingWords.length - 1];
    segments.push({
      id: randomUUID(),
      startMs: offsetMs + Math.round(firstWord.start * 1000),
      endMs: offsetMs + Math.round(lastWord.end * 1000),
      text: pendingWords.map((word) => word.word).join(" ").trim(),
      sceneId: scene.id,
      sceneNumber: scene.sceneNumber,
      edited: false,
    });
    pendingWords = [];
  }

  for (const rawWord of words) {
    const normalizedWord = normalizeWord(rawWord);
    if (!normalizedWord.word) {
      continue;
    }

    pendingWords.push(normalizedWord);
    if (shouldBreakSegment(normalizedWord.word, pendingWords.length)) {
      flushPendingWords();
    }
  }

  flushPendingWords();
  return segments;
}

function formatCaptionTimestamp(milliseconds: number, separator: "," | "."): string {
  const totalMilliseconds = Math.max(0, Math.round(milliseconds));
  const hours = Math.floor(totalMilliseconds / 3_600_000);
  const minutes = Math.floor((totalMilliseconds % 3_600_000) / 60_000);
  const seconds = Math.floor((totalMilliseconds % 60_000) / 1_000);
  const ms = totalMilliseconds % 1_000;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}${separator}${String(ms).padStart(3, "0")}`;
}

export function exportSrt(track: CaptionTrack): string {
  return track.segments
    .map(
      (segment, index) =>
        `${index + 1}\n${formatCaptionTimestamp(segment.startMs, ",")} --> ${formatCaptionTimestamp(segment.endMs, ",")}\n${segment.text}`,
    )
    .join("\n\n");
}

export function exportVtt(track: CaptionTrack): string {
  const body = track.segments
    .map(
      (segment) =>
        `${formatCaptionTimestamp(segment.startMs, ".")} --> ${formatCaptionTimestamp(segment.endMs, ".")}\n${segment.text}`,
    )
    .join("\n\n");

  return `WEBVTT\n\n${body}`;
}

async function persistCaptionTrackArtifacts(track: CaptionTrack): Promise<void> {
  await saveCaptionTrack(track);
  await saveCaptionExport(track.id, "srt", exportSrt(track));
  await saveCaptionExport(track.id, "vtt", exportVtt(track));
}

export async function generateCaptionTrack(projectId: string, narrationTrackId: string): Promise<CaptionTrack> {
  const narrationTrack = await getNarrationTrack(narrationTrackId);
  if (!narrationTrack) {
    throw new Error(`Narration track not found: ${narrationTrackId}`);
  }
  if (narrationTrack.approvalStatus !== "approved") {
    throw new Error("Captions can only be generated from an approved narration track.");
  }

  const project = getProjectOrThrow(projectId, await getProjectById(projectId));
  const scenes = await getScenesForProject(project.id);
  const sceneMap = new Map(scenes.map((scene) => [scene.id, scene]));
  const openai = getOpenAIClient();
  const segments: CaptionSegment[] = [];
  let currentOffsetMs = 0;

  for (const sceneAudio of [...narrationTrack.scenes].sort((a, b) => a.sceneNumber - b.sceneNumber)) {
    const scene = sceneMap.get(sceneAudio.sceneId);
    if (!scene) {
      currentOffsetMs += Math.round(sceneAudio.measuredDurationSeconds * 1000);
      continue;
    }

    const audioFilePath = path.join(process.cwd(), sceneAudio.audioFilePath);
    const transcription = (await openai.audio.transcriptions.create({
      file: fs.createReadStream(audioFilePath),
      model: "whisper-1",
      response_format: "verbose_json",
      timestamp_granularities: ["word"],
    })) as WhisperVerboseResponse;

    segments.push(...chunkWordsIntoSegments(transcription.words ?? [], scene, currentOffsetMs));
    currentOffsetMs += Math.round(sceneAudio.measuredDurationSeconds * 1000);
  }

  const now = new Date().toISOString();
  const track: CaptionTrack = {
    id: randomUUID(),
    projectId: project.id,
    narrationTrackId,
    language: "en",
    source: "whisper",
    isStale: false,
    segments,
    createdAt: now,
    updatedAt: now,
  };

  await persistCaptionTrackArtifacts(track);
  await saveCaptionTrackForProject(project.id, track.id);
  return track;
}

export async function updateCaptionSegment(trackId: string, segmentId: string, text: string): Promise<CaptionTrack> {
  const track = getCaptionTrackOrThrow(trackId, await getCaptionTrack(trackId));
  const trimmedText = text.trim();
  const updatedSegments = track.segments.map((segment) =>
    segment.id === segmentId ? { ...segment, text: trimmedText, edited: true } : segment,
  );

  const updatedTrack: CaptionTrack = {
    ...track,
    source: "manual",
    segments: updatedSegments,
    updatedAt: new Date().toISOString(),
  };

  await persistCaptionTrackArtifacts(updatedTrack);
  return updatedTrack;
}

export async function updateCaptionSegmentTiming(
  trackId: string,
  segmentId: string,
  startMs: number,
  endMs: number,
): Promise<CaptionTrack> {
  const track = getCaptionTrackOrThrow(trackId, await getCaptionTrack(trackId));
  const normalizedStartMs = Math.max(0, Math.round(startMs));
  const normalizedEndMs = Math.max(normalizedStartMs, Math.round(endMs));
  const updatedSegments = track.segments.map((segment) =>
    segment.id === segmentId
      ? { ...segment, startMs: normalizedStartMs, endMs: normalizedEndMs, edited: true }
      : segment,
  );

  const updatedTrack: CaptionTrack = {
    ...track,
    source: "manual",
    segments: updatedSegments,
    updatedAt: new Date().toISOString(),
  };

  await persistCaptionTrackArtifacts(updatedTrack);
  return updatedTrack;
}

export async function markCaptionTrackStale(trackId: string): Promise<void> {
  const track = await getCaptionTrack(trackId);
  if (!track) {
    return;
  }

  await persistCaptionTrackArtifacts({
    ...track,
    isStale: true,
    updatedAt: new Date().toISOString(),
  });
}
