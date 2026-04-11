import "server-only";

// File-backed scene storage layer for reading and writing raw scene records in data/scenes.

import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { auth } from "@/auth";
import { getProject, getProjectByAnyOwner } from "@/lib/project-store";
import type { Scene } from "@/types/scene";

const DATA_DIR = path.join(process.cwd(), "data");
const SCENES_DIR = path.join(DATA_DIR, "scenes");

let sceneWriteQueue: Promise<unknown> = Promise.resolve();

function isErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

function withSceneWriteLock<T>(operation: () => Promise<T>): Promise<T> {
  const queuedOperation = sceneWriteQueue.then(operation, operation);
  sceneWriteQueue = queuedOperation.then(
    () => undefined,
    () => undefined,
  );
  return queuedOperation;
}

function getSceneFilePath(sceneId: string): string {
  return path.join(SCENES_DIR, `${sceneId}.json`);
}

function parseScene(raw: string, filePath: string): Scene {
  try {
    return JSON.parse(raw) as Scene;
  } catch (error) {
    throw new Error(`Failed to parse ${filePath}: ${error instanceof Error ? error.message : "unknown error"}`);
  }
}

async function ensureScenesDirectory(): Promise<void> {
  await mkdir(SCENES_DIR, { recursive: true });
}

async function writeSceneFile(scene: Scene): Promise<void> {
  await ensureScenesDirectory();
  const tempFile = path.join(SCENES_DIR, `${scene.id}.${randomUUID()}.tmp`);
  await writeFile(tempFile, JSON.stringify(scene, null, 2), "utf8");
  await rename(tempFile, getSceneFilePath(scene.id));
}

export async function saveScene(scene: Scene): Promise<void> {
  await ensureScenesDirectory();

  await withSceneWriteLock(async () => {
    await writeSceneFile(scene);
  });
}

export async function getScene(sceneId: string): Promise<Scene | null> {
  await ensureScenesDirectory();

  try {
    const raw = await readFile(getSceneFilePath(sceneId), "utf8");
    return parseScene(raw, getSceneFilePath(sceneId));
  } catch (error) {
    if (isErrnoException(error) && error.code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

export async function getScenesForProject(projectId: string): Promise<Scene[]> {
  const session = await auth();
  const project = session?.user?.id
    ? await getProject(projectId, session.user.id)
    : await getProjectByAnyOwner(projectId);
  if (!project) {
    return [];
  }

  const scenes = await Promise.all(project.workflow.sceneIds.map((sceneId) => getScene(sceneId)));

  return scenes
    .filter((scene): scene is Scene => scene !== null)
    .sort((a, b) => a.sceneNumber - b.sceneNumber || a.createdAt.localeCompare(b.createdAt));
}

export async function deleteScene(sceneId: string): Promise<void> {
  await ensureScenesDirectory();

  await withSceneWriteLock(async () => {
    try {
      await unlink(getSceneFilePath(sceneId));
    } catch (error) {
      if (isErrnoException(error) && error.code === "ENOENT") {
        console.warn(`Scene file missing while deleting scene ${sceneId}. Continuing.`);
        return;
      }

      throw error;
    }
  });
}
