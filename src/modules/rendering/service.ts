import { randomUUID } from "node:crypto";
import fs from "node:fs";
import { access, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import ffmpeg from "fluent-ffmpeg";
import sharp from "sharp";
import { captionSegmentsToSrt } from "@/modules/captions/srt";
import { getProjectById, saveRenderJobForProject, setProjectStatus } from "@/modules/projects/repository";
import { getTimelineDraftForProject } from "@/modules/timeline/service";
import { RENDERING_DIR, RENDERS_DIR } from "@/modules/rendering/paths";
import { saveRenderJob, updateRenderJob } from "@/modules/rendering/repository";
import type { CaptionSegment } from "@/types/caption";
import type { NarrationSceneAudio } from "@/types/narration";
import type { Scene } from "@/types/scene";
import type { AssetCandidate } from "@/modules/assets/types";
import type { TimelineDraft } from "@/modules/timeline/types";
import type { RenderJob } from "@/modules/rendering/types";

const RENDER_WIDTH = 1920;
const RENDER_HEIGHT = 1080;
const PLACEHOLDER_COLORS = ["#0f172a", "#1d4ed8", "#14532d", "#581c87", "#7c2d12", "#164e63"];

function resolveBundledFfmpegPath(): string {
  const platformFolder = `${process.platform}-${process.arch}`;
  const binaryName = process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg";
  const candidatePaths = [
    process.env.FFMPEG_PATH,
    path.join(process.cwd(), "node_modules", "@ffmpeg-installer", platformFolder, binaryName),
  ].filter((value): value is string => Boolean(value));

  const ffmpegPath = candidatePaths.find((candidatePath) => fs.existsSync(candidatePath));
  if (!ffmpegPath) {
    throw new Error("FFmpeg binary not found. Install @ffmpeg-installer/ffmpeg or set FFMPEG_PATH.");
  }

  return ffmpegPath;
}

ffmpeg.setFfmpegPath(resolveBundledFfmpegPath());

type RenderSceneInput = {
  scene: Scene;
  imagePath: string;
  narration: NarrationSceneAudio;
};

function escapeConcatFilePath(filePath: string): string {
  return filePath.replace(/'/g, "'\\''");
}

function escapeSubtitleFilterPath(filePath: string): string {
  return filePath.replace(/\\/g, "/").replace(/:/g, "\\:").replace(/'/g, "\\'");
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function wrapText(value: string, wordsPerLine: number): string[] {
  const words = value.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return ["Scene Placeholder"];
  }

  const lines: string[] = [];
  for (let index = 0; index < words.length; index += wordsPerLine) {
    lines.push(words.slice(index, index + wordsPerLine).join(" "));
  }

  return lines.slice(0, 3);
}

function runFfmpeg(command: ffmpeg.FfmpegCommand, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    command
      .on("end", () => resolve())
      .on("error", (error) => reject(error))
      .save(outputPath);
  });
}

function getSelectedApprovedAsset(sceneId: string, assets: AssetCandidate[]): AssetCandidate | null {
  return assets.find((asset) => asset.sceneId === sceneId && asset.selected && asset.approvalStatus === "approved") ?? null;
}

async function ensureFileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function createPlaceholderImage(projectId: string, scene: Scene, colorIndex: number): Promise<string> {
  await mkdir(RENDERING_DIR, { recursive: true });
  const outputPath = path.join(RENDERING_DIR, `${projectId}-placeholder-scene-${scene.sceneNumber}.png`);
  const lines = wrapText(`Scene ${scene.sceneNumber}: ${scene.heading}`, 4);
  const lineHeight = 88;
  const startY = 430;
  const svg = `
    <svg width="${RENDER_WIDTH}" height="${RENDER_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="transparent" />
      <text x="50%" y="${startY}" text-anchor="middle" fill="#ffffff" font-family="Helvetica, Arial, sans-serif" font-size="66" font-weight="700">
        ${lines
          .map((line, index) => `<tspan x="50%" dy="${index === 0 ? 0 : lineHeight}">${escapeXml(line)}</tspan>`)
          .join("")}
      </text>
    </svg>
  `;

  await sharp({
    create: {
      width: RENDER_WIDTH,
      height: RENDER_HEIGHT,
      channels: 4,
      background: PLACEHOLDER_COLORS[colorIndex % PLACEHOLDER_COLORS.length],
    },
  })
    .composite([{ input: Buffer.from(svg) }])
    .png()
    .toFile(outputPath);

  return outputPath;
}

async function writeSrtFile(projectId: string, segments: CaptionSegment[]): Promise<string> {
  await mkdir(RENDERING_DIR, { recursive: true });
  const srtPath = path.join(RENDERING_DIR, `${projectId}.srt`);
  await writeFile(srtPath, captionSegmentsToSrt(segments), "utf8");
  return srtPath;
}

async function gatherRenderScenes(projectId: string, draft: TimelineDraft): Promise<RenderSceneInput[]> {
  const narrationBySceneId = new Map(draft.narrationTrack.scenes.map((sceneAudio) => [sceneAudio.sceneId, sceneAudio]));
  const orderedScenes = [...draft.scenes].sort((a, b) => a.sceneNumber - b.sceneNumber);

  const renderScenes: RenderSceneInput[] = [];
  for (const [index, scene] of orderedScenes.entries()) {
    const narration = narrationBySceneId.get(scene.id);
    if (!narration) {
      throw new Error(`Narration entry missing for scene ${scene.sceneNumber}.`);
    }

    const absoluteAudioPath = path.join(process.cwd(), narration.audioFilePath);
    const hasNarrationFile = await ensureFileExists(absoluteAudioPath);
    if (!hasNarrationFile) {
      throw new Error(`Narration file missing for scene ${scene.sceneNumber}: ${narration.audioFilePath}`);
    }

    const asset = getSelectedApprovedAsset(scene.id, draft.assets);
    let imagePath: string;
    if (asset?.imageFilePath) {
      const absoluteImagePath = path.join(process.cwd(), asset.imageFilePath);
      imagePath = (await ensureFileExists(absoluteImagePath))
        ? absoluteImagePath
        : await createPlaceholderImage(projectId, scene, index);
    } else {
      imagePath = await createPlaceholderImage(projectId, scene, index);
    }

    renderScenes.push({
      scene,
      imagePath,
      narration,
    });
  }

  return renderScenes;
}

async function concatenateNarrationAudio(projectId: string, renderScenes: RenderSceneInput[]): Promise<string> {
  await mkdir(RENDERING_DIR, { recursive: true });
  const listPath = path.join(RENDERING_DIR, `${projectId}-audio.txt`);
  const outputPath = path.join(RENDERING_DIR, `${projectId}-audio.mp3`);
  const listContents = renderScenes
    .map((item) => `file '${escapeConcatFilePath(path.join(process.cwd(), item.narration.audioFilePath))}'`)
    .join("\n");

  await writeFile(listPath, listContents, "utf8");

  await runFfmpeg(
    ffmpeg()
      .input(listPath)
      .inputOptions(["-f", "concat", "-safe", "0"])
      .outputOptions(["-y", "-acodec", "libmp3lame", "-q:a", "2"]),
    outputPath,
  );

  return outputPath;
}

async function createSlideshowVideo(projectId: string, renderScenes: RenderSceneInput[], audioPath: string, srtPath: string): Promise<string> {
  await mkdir(RENDERING_DIR, { recursive: true });
  await mkdir(RENDERS_DIR, { recursive: true });

  const imageListPath = path.join(RENDERING_DIR, `${projectId}-images.txt`);
  const outputPath = path.join(RENDERS_DIR, `${projectId}.mp4`);
  const imageListLines = renderScenes.flatMap((item, index, items) => {
    const duration = Math.max(item.narration.measuredDurationSeconds || item.narration.durationSeconds || 1, 0.5);
    const lines = [`file '${escapeConcatFilePath(item.imagePath)}'`, `duration ${duration.toFixed(3)}`];
    if (index === items.length - 1) {
      lines.push(`file '${escapeConcatFilePath(item.imagePath)}'`);
    }
    return lines;
  });

  await writeFile(imageListPath, imageListLines.join("\n"), "utf8");

  const subtitleFilter = `subtitles='${escapeSubtitleFilterPath(srtPath)}'`;
  await runFfmpeg(
    ffmpeg()
      .input(imageListPath)
      .inputOptions(["-f", "concat", "-safe", "0"])
      .input(audioPath)
      .outputOptions([
        "-y",
        "-r",
        "30",
        "-c:v",
        "libx264",
        "-preset",
        "medium",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-movflags",
        "+faststart",
        "-shortest",
      ])
      .videoFilters([
        "scale=1920:1080:force_original_aspect_ratio=increase",
        "crop=1920:1080",
        "format=yuv420p",
        subtitleFilter,
      ]),
    outputPath,
  );

  return outputPath;
}

async function updateRenderJobState(
  jobId: string,
  status: RenderJob["status"],
  outputFilePath: string | null,
  errorMessage: string | null,
  progressMessage: string | null,
): Promise<RenderJob> {
  return updateRenderJob(jobId, (job) => ({
    ...job,
    status,
    outputFilePath,
    errorMessage,
    progressMessage,
    updatedAt: new Date().toISOString(),
  }));
}

export async function createRenderJob(
  projectId: string,
  timelineDraftId: string,
  status: RenderJob["status"] = "queued",
  progressMessage: string | null = "Queued for render processing.",
): Promise<RenderJob> {
  const project = await getProjectById(projectId);
  if (!project) {
    throw new Error(`Project not found: ${projectId}`);
  }

  const now = new Date().toISOString();
  const job: RenderJob = {
    id: randomUUID(),
    projectId,
    timelineDraftId,
    status,
    outputFilePath: null,
    errorMessage: null,
    progressMessage,
    createdAt: now,
    updatedAt: now,
  };

  await saveRenderJob(job);
  await saveRenderJobForProject(projectId, job.id);
  return job;
}

export async function renderProject(projectId: string, renderJobId?: string): Promise<string> {
  const project = await getProjectById(projectId);
  if (!project) {
    throw new Error(`Project not found: ${projectId}`);
  }

  const timelineDraft = await getTimelineDraftForProject(projectId);
  if (!timelineDraft) {
    throw new Error("Timeline draft not found for this project. Build the timeline before rendering.");
  }

  const activeRenderJobId = renderJobId ?? project.workflow.renderJobIds.at(-1);
  if (!activeRenderJobId) {
    throw new Error("Render job not found for this project.");
  }

  await updateRenderJobState(activeRenderJobId, "rendering", null, null, "Preparing scene images...");

  try {
    const renderScenes = await gatherRenderScenes(projectId, timelineDraft);
    await updateRenderJobState(activeRenderJobId, "rendering", null, null, "Merging narration audio...");
    const srtPath = await writeSrtFile(projectId, [...timelineDraft.captionTrack.segments].sort((a, b) => a.startMs - b.startMs));
    const audioPath = await concatenateNarrationAudio(projectId, renderScenes);
    await updateRenderJobState(activeRenderJobId, "rendering", null, null, "Assembling video...");
    await updateRenderJobState(activeRenderJobId, "rendering", null, null, "Burning in captions...");
    const outputPath = await createSlideshowVideo(projectId, renderScenes, audioPath, srtPath);
    const relativeOutputPath = path.relative(process.cwd(), outputPath);

    await updateRenderJobState(activeRenderJobId, "rendering", null, null, "Finalising export...");
    await updateRenderJobState(activeRenderJobId, "complete", relativeOutputPath, null, "Render complete.");
    await setProjectStatus(projectId, "rendered");
    return relativeOutputPath;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Render failed.";
    await updateRenderJobState(activeRenderJobId, "error", null, message, "Render failed.");
    throw error;
  }
}
