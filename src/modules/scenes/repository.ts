import "server-only";

import { auth } from "@/auth";
import { db, runMigration } from "@/lib/db";
import { getProject, getProjectByAnyOwner } from "@/lib/project-store";
import type { Scene } from "@/types/scene";

type SceneDataRow = {
  data: string;
};

function parseScene(raw: string, context: string): Scene {
  try {
    return JSON.parse(raw) as Scene;
  } catch (error) {
    throw new Error(`Failed to parse ${context}: ${error instanceof Error ? error.message : "unknown error"}`);
  }
}

async function ensureSceneStoreReady(): Promise<void> {
  await runMigration();
}

export async function saveScene(scene: Scene): Promise<void> {
  await ensureSceneStoreReady();

  db.prepare(
    `
      INSERT INTO scenes (id, project_id, data, updated_at)
      VALUES (@id, @project_id, @data, @updated_at)
      ON CONFLICT(id) DO UPDATE SET
        project_id = excluded.project_id,
        data = excluded.data,
        updated_at = excluded.updated_at
    `,
  ).run({
    id: scene.id,
    project_id: scene.projectId,
    data: JSON.stringify(scene, null, 2),
    updated_at: scene.updatedAt,
  });
}

export async function getScene(sceneId: string): Promise<Scene | null> {
  await ensureSceneStoreReady();

  const row = db.prepare("SELECT data FROM scenes WHERE id = ?").get(sceneId) as SceneDataRow | undefined;
  return row ? parseScene(row.data, `scenes row ${sceneId}`) : null;
}

export async function getScenesForProject(projectId: string): Promise<Scene[]> {
  await ensureSceneStoreReady();

  const session = await auth();
  const project = session?.user?.id
    ? await getProject(projectId, session.user.id)
    : await getProjectByAnyOwner(projectId);
  if (!project) {
    return [];
  }

  const rows = db
    .prepare("SELECT data FROM scenes WHERE project_id = ?")
    .all(projectId) as SceneDataRow[];

  return rows
    .map((row) => parseScene(row.data, `scenes row for project ${projectId}`))
    .sort((a, b) => a.sceneNumber - b.sceneNumber || a.createdAt.localeCompare(b.createdAt));
}

export async function deleteScene(sceneId: string): Promise<void> {
  await ensureSceneStoreReady();
  db.prepare("DELETE FROM scenes WHERE id = ?").run(sceneId);
}
