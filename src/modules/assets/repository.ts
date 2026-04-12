import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { auth } from "@/auth";
import { db, runMigration } from "@/lib/db";
import { getProject, getProjectByAnyOwner } from "@/lib/project-store";
import type { AssetCandidate } from "@/modules/assets/types";

const DATA_DIR = path.join(process.cwd(), "data");
const ASSETS_DIR = path.join(DATA_DIR, "assets");
const IMAGE_EXTENSION = "png";

type AssetDataRow = {
  data: string;
};

async function getReadableProject(projectId: string) {
  const session = await auth();
  return session?.user?.id ? getProject(projectId, session.user.id) : getProjectByAnyOwner(projectId);
}

function isErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
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

function parseAssetCandidate(raw: string, context: string): AssetCandidate {
  try {
    return JSON.parse(raw) as AssetCandidate;
  } catch (error) {
    throw new Error(`Failed to parse ${context}: ${error instanceof Error ? error.message : "unknown error"}`);
  }
}

async function ensureAssetStoreReady(): Promise<void> {
  await runMigration();
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
  await ensureAssetStoreReady();

  db.prepare(
    `
      INSERT INTO assets (id, project_id, scene_id, data, updated_at)
      VALUES (@id, @project_id, @scene_id, @data, @updated_at)
      ON CONFLICT(id) DO UPDATE SET
        project_id = excluded.project_id,
        scene_id = excluded.scene_id,
        data = excluded.data,
        updated_at = excluded.updated_at
    `,
  ).run({
    id: asset.id,
    project_id: asset.projectId,
    scene_id: asset.sceneId,
    data: JSON.stringify(asset, null, 2),
    updated_at: asset.updatedAt,
  });
}

export async function saveAssetImageFile(assetId: string, buffer: Buffer): Promise<string> {
  await ensureAssetsDirectory();

  const filePath = getAssetImageFilePath(assetId);
  const tempFile = path.join(ASSETS_DIR, `${assetId}.${randomUUID()}.tmp`);
  await writeFile(tempFile, buffer);
  await rename(tempFile, filePath);
  return path.relative(process.cwd(), filePath);
}

export async function getAssetCandidate(assetId: string): Promise<AssetCandidate | null> {
  await ensureAssetStoreReady();

  const row = db.prepare("SELECT data FROM assets WHERE id = ?").get(assetId) as AssetDataRow | undefined;
  if (!row) {
    return null;
  }

  const asset = parseAssetCandidate(row.data, `assets row ${assetId}`);
  const project = await getReadableProject(asset.projectId);
  return project ? asset : null;
}

export async function getAssetCandidatesForProject(projectId: string): Promise<AssetCandidate[]> {
  await ensureAssetStoreReady();

  const project = await getReadableProject(projectId);
  if (!project) {
    return [];
  }

  const rows = db.prepare("SELECT data FROM assets WHERE project_id = ?").all(projectId) as AssetDataRow[];
  return rows
    .map((row) => parseAssetCandidate(row.data, `assets row for project ${projectId}`))
    .sort((a, b) => a.sceneNumber - b.sceneNumber || a.candidateIndex - b.candidateIndex || a.createdAt.localeCompare(b.createdAt));
}

export async function getAssetCandidatesForScene(projectId: string, sceneId: string): Promise<AssetCandidate[]> {
  const candidates = await getAssetCandidatesForProject(projectId);
  return candidates.filter((candidate) => candidate.sceneId === sceneId);
}

export async function listAssetCandidates(): Promise<AssetCandidate[]> {
  await ensureAssetStoreReady();

  const rows = db.prepare("SELECT data FROM assets").all() as AssetDataRow[];
  return rows
    .map((row) => parseAssetCandidate(row.data, "assets row"))
    .sort(
      (a, b) =>
        a.projectId.localeCompare(b.projectId) ||
        a.sceneNumber - b.sceneNumber ||
        a.candidateIndex - b.candidateIndex ||
        a.createdAt.localeCompare(b.createdAt),
    );
}

export async function deleteAssetCandidate(assetId: string): Promise<void> {
  await ensureAssetStoreReady();

  const asset = await getAssetCandidate(assetId);
  const resolvedImagePath = asset?.imageFilePath ? resolveAssetImagePath(asset.imageFilePath) : null;
  const imageFilePath = resolvedImagePath ?? getAssetImageFilePath(assetId);

  await unlinkWithWarning(imageFilePath, `Asset image ${asset?.imageFilePath ?? imageFilePath}`);
  db.prepare("DELETE FROM assets WHERE id = ?").run(assetId);
}
