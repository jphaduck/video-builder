import "server-only";

import { randomUUID } from "node:crypto";
import { db, parseProjectRow, runMigration } from "@/lib/db";
import type { CreateProjectInput, Project } from "@/types/project";

type ProjectRow = {
  id: string;
  data: string;
  created_at: string;
  updated_at: string;
  user_id: string;
};

function parseProject(raw: string, context: string): Project {
  try {
    return JSON.parse(raw) as Project;
  } catch (error) {
    throw new Error(`Failed to parse ${context}: ${error instanceof Error ? error.message : "unknown error"}`);
  }
}

async function ensureProjectStoreReady(): Promise<void> {
  await runMigration();
}

export async function saveProject(project: Project, userId: string): Promise<Project> {
  await ensureProjectStoreReady();

  db.prepare(
    `
      INSERT INTO projects (id, data, created_at, updated_at, user_id)
      VALUES (@id, @data, @created_at, @updated_at, @user_id)
      ON CONFLICT(id) DO UPDATE SET
        data = excluded.data,
        created_at = excluded.created_at,
        updated_at = excluded.updated_at,
        user_id = excluded.user_id
    `,
  ).run({
    id: project.id,
    data: JSON.stringify(project, null, 2),
    created_at: project.createdAt,
    updated_at: project.updatedAt,
    user_id: userId,
  });

  return project;
}

export async function createProject(input: CreateProjectInput, userId: string): Promise<Project> {
  const now = new Date().toISOString();
  const project: Project = {
    id: randomUUID(),
    name: input.name,
    status: "draft",
    createdAt: now,
    updatedAt: now,
    storyInput: {
      premise: input.premise,
      targetRuntimeMin: 10,
    },
    scriptDrafts: [],
    workflow: {
      scriptDraftIds: [],
      sceneIds: [],
      assetIds: [],
      narrationTrackIds: [],
      captionTrackIds: [],
      renderJobIds: [],
    },
  };

  return saveProject(project, userId);
}

export async function getProject(projectId: string, userId: string): Promise<Project | null> {
  await ensureProjectStoreReady();

  const row = db
    .prepare("SELECT data FROM projects WHERE id = ? AND user_id = ?")
    .get(projectId, userId) as ProjectRow | undefined;
  const raw = parseProjectRow(row);
  return raw ? parseProject(raw, `projects row ${projectId}`) : null;
}

export async function listProjects(userId: string): Promise<Project[]> {
  await ensureProjectStoreReady();

  const rows = db
    .prepare("SELECT id, data, created_at, updated_at, user_id FROM projects WHERE user_id = ? ORDER BY created_at DESC")
    .all(userId) as ProjectRow[];
  return rows.map((row) => parseProject(row.data, `projects row ${row.id}`));
}

export async function updateProject(
  projectId: string,
  userId: string,
  updater: (project: Project) => Promise<Project> | Project,
): Promise<Project> {
  const currentProject = await getProject(projectId, userId);
  if (!currentProject) {
    throw new Error(`Project not found: ${projectId}`);
  }

  const updatedProject = await updater(currentProject);
  await saveProject(updatedProject, userId);
  return updatedProject;
}

export async function deleteProject(projectId: string, userId: string): Promise<void> {
  await ensureProjectStoreReady();

  const result = db.prepare("DELETE FROM projects WHERE id = ? AND user_id = ?").run(projectId, userId);
  if (result.changes === 0) {
    throw new Error(`Project not found: ${projectId}`);
  }
}

export async function getProjectByAnyOwner(projectId: string): Promise<Project | null> {
  await ensureProjectStoreReady();

  const row = db.prepare("SELECT data FROM projects WHERE id = ?").get(projectId) as ProjectRow | undefined;
  const raw = parseProjectRow(row);
  return raw ? parseProject(raw, `projects row ${projectId}`) : null;
}

export async function getProjectOwnerId(projectId: string): Promise<string | null> {
  await ensureProjectStoreReady();

  const row = db.prepare("SELECT user_id FROM projects WHERE id = ?").get(projectId) as Pick<ProjectRow, "user_id"> | undefined;
  return row?.user_id ?? null;
}
