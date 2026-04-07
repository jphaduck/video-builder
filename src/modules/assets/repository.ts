import "server-only";

// File-backed asset candidate storage layer for reading and writing raw asset candidate records in data/assets.

import { mkdir, readFile, readdir, rename, unlink, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { getProject } from "@/lib/projects";
import type { AssetCandidate } from "@/modules/assets/types";

const DATA_DIR = path.join(process.cwd(), "data");
const ASSETS_DIR = path.join(DATA_DIR, "assets");

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

function getAssetFilePath(assetId: string): string {
  return path.join(ASSETS_DIR, `${assetId}.json`);
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

export async function saveAssetCandidate(asset: AssetCandidate): Promise<void> {
  await ensureAssetsDirectory();

  await withAssetWriteLock(async () => {
    const tempFile = path.join(ASSETS_DIR, `${asset.id}.${randomUUID()}.tmp`);
    await writeFile(tempFile, JSON.stringify(asset, null, 2), "utf8");
    await rename(tempFile, getAssetFilePath(asset.id));
  });
}

export async function getAssetCandidate(assetId: string): Promise<AssetCandidate | null> {
  await ensureAssetsDirectory();

  try {
    const filePath = getAssetFilePath(assetId);
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
  const project = await getProject(projectId);
  if (!project) {
    return [];
  }

  const assetIds = project.workflow?.assetIds ?? [];
  const candidates = await Promise.all(assetIds.map((assetId) => getAssetCandidate(assetId)));
  return candidates
    .filter((candidate): candidate is AssetCandidate => candidate !== null)
    .sort((a, b) => a.sceneNumber - b.sceneNumber || a.candidateIndex - b.candidateIndex || a.createdAt.localeCompare(b.createdAt));
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
    try {
      await unlink(getAssetFilePath(assetId));
    } catch (error) {
      if (isErrnoException(error) && error.code === "ENOENT") {
        return;
      }

      throw error;
    }
  });
}
