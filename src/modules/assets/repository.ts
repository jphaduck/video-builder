import "server-only";

// File-backed asset storage layer for reading and writing raw image candidate metadata and image files in data/assets.

import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { auth } from "@/auth";
import { getProject, getProjectByAnyOwner } from "@/lib/project-store";
import type { AssetCandidate } from "@/modules/assets/types";

const DATA_DIR = path.join(process.cwd(), "data");
const ASSETS_DIR = path.join(DATA_DIR, "assets");
const IMAGE_EXTENSION = "png";

let assetWriteQueue: Promise<unknown> = Promise.resolve();

function isErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

function withAssetWriteLock<T>(operation: () => Promise<T>): Promise<T> {
  const queuedOperation = assetWriteQueue.then(operation, operation);
  assetWriteQueue = queuedOperation.then(
    () => undefined,
    () => undefined,
  );
  return queuedOperation;
}

function getAssetMetadataFilePath(assetId: string): string {
  return path.join(ASSETS_DIR, `${assetId}.json`);
}

function getAssetImageFilePath(assetId: string): string {
  return path.join(ASSETS_DIR, `${assetId}.${IMAGE_EXTENSION}`);
}

function resolveAssetImagePath(imageFilePath: string): string | null {
  const absoluteImagePath = path.resolve(process.cwd(), imageFilePath);

  if (!absoluteImagePath.startsWith(`${ASSETS_DIR}${path.sep}`)) {
    return null;
  }

  return absoluteImagePath;
}

function parseAssetCandidate(raw: string, filePath: string): AssetCandidate {
  try {
    return JSON.parse(raw) as AssetCandidate;
  } catch (error) {
    throw new Error(`Failed to parse ${filePath}: ${error instanceof Error ? error.message : "unknown error"}`);
  }
}

async function ensureAssetsDirectory(): Promise<void> {
  await mkdir(ASSETS_DIR, { recursive: true });
}

async function unlinkWithWarning(filePath: string, warningLabel: string): Promise<void> {
  try {
    await unlink(filePath);
  } catch (error) {
    if (isErrnoException(error) && error.code === "ENOENT") {
      console.warn(`${warningLabel} was missing while deleting asset files. Continuing.`);
      return;
    }

    throw error;
  }
}

export async function saveAssetCandidate(asset: AssetCandidate): Promise<void> {
  await ensureAssetsDirectory();

  await withAssetWriteLock(async () => {
    const tempFile = path.join(ASSETS_DIR, `${asset.id}.${randomUUID()}.tmp`);
    await writeFile(tempFile, JSON.stringify(asset, null, 2), "utf8");
    await rename(tempFile, getAssetMetadataFilePath(asset.id));
  });
}

export async function saveAssetImageFile(assetId: string, buffer: Buffer): Promise<string> {
  await ensureAssetsDirectory();

  return withAssetWriteLock(async () => {
    const filePath = getAssetImageFilePath(assetId);
    const tempFile = path.join(ASSETS_DIR, `${assetId}.${randomUUID()}.tmp`);
    await writeFile(tempFile, buffer);
    await rename(tempFile, filePath);
    return path.relative(process.cwd(), filePath);
  });
}

export async function getAssetCandidate(assetId: string): Promise<AssetCandidate | null> {
  await ensureAssetsDirectory();

  try {
    const filePath = getAssetMetadataFilePath(assetId);
    const raw = await readFile(filePath, "utf8");
    return parseAssetCandidate(raw, filePath);
  } catch (error) {
    if (isErrnoException(error) && error.code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

export async function getAssetCandidatesForProject(projectId: string): Promise<AssetCandidate[]> {
  const session = await auth();
  const project = session?.user?.id
    ? await getProject(projectId, session.user.id)
    : await getProjectByAnyOwner(projectId);
  if (!project) {
    return [];
  }

  const assetIds = project.workflow?.assetIds ?? [];
  const candidates = await Promise.all(assetIds.map((assetId) => getAssetCandidate(assetId)));
  return candidates
    .filter((candidate): candidate is AssetCandidate => candidate !== null)
    .sort((a, b) => a.sceneNumber - b.sceneNumber || a.candidateIndex - b.candidateIndex || a.createdAt.localeCompare(b.createdAt));
}

export async function getAssetCandidatesForScene(projectId: string, sceneId: string): Promise<AssetCandidate[]> {
  const candidates = await getAssetCandidatesForProject(projectId);
  return candidates.filter((candidate) => candidate.sceneId === sceneId);
}

export async function listAssetCandidates(): Promise<AssetCandidate[]> {
  await ensureAssetsDirectory();
  const entries = await readdir(ASSETS_DIR, { withFileTypes: true });
  const assets = await Promise.all(
    entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .map(async (entry) => {
        const filePath = path.join(ASSETS_DIR, entry.name);
        const raw = await readFile(filePath, "utf8");
        return parseAssetCandidate(raw, filePath);
      }),
  );

  return assets.sort((a, b) => a.projectId.localeCompare(b.projectId) || a.sceneNumber - b.sceneNumber);
}

export async function deleteAssetCandidate(assetId: string): Promise<void> {
  await ensureAssetsDirectory();

  await withAssetWriteLock(async () => {
    const asset = await getAssetCandidate(assetId);
    const resolvedImagePath = asset?.imageFilePath
      ? resolveAssetImagePath(asset.imageFilePath)
      : null;
    const imageFilePath =
      resolvedImagePath ?? getAssetImageFilePath(assetId);

    await unlinkWithWarning(imageFilePath, `Asset image ${asset?.imageFilePath ?? imageFilePath}`);
    await unlinkWithWarning(getAssetMetadataFilePath(assetId), `Asset metadata ${assetId}`);
  });
}
