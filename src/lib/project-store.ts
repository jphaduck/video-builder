import "server-only";

import { randomUUID } from "node:crypto";
import { db, parseProjectRow, runMigration } from "@/lib/db";
import type { CreateProjectInput, Project } from "@/types/project";

type ProjectRow = {
  id: string;
  data: string;
  created_at: string;
  updated_at: string;
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

export async function saveProject(project: Project): Promise<Project> {
  await ensureProjectStoreReady();

  db.prepare(
    `
      INSERT INTO projects (id, data, created_at, updated_at)
      VALUES (@id, @data, @created_at, @updated_at)
      ON CONFLICT(id) DO UPDATE SET
        data = excluded.data,
        created_at = excluded.created_at,
        updated_at = excluded.updated_at
    `,
  ).run({
    id: project.id,
    data: JSON.stringify(project, null, 2),
    created_at: project.createdAt,
    updated_at: project.updatedAt,
  });

  return project;
}

export async function createProject(input: CreateProjectInput): Promise<Project> {
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

  return saveProject(project);
}

export async function getProject(projectId: string): Promise<Project | null> {
  await ensureProjectStoreReady();

  const row = db.prepare("SELECT data FROM projects WHERE id = ?").get(projectId) as ProjectRow | undefined;
  const raw = parseProjectRow(row);
  return raw ? parseProject(raw, `projects row ${projectId}`) : null;
}

export async function listProjects(): Promise<Project[]> {
  await ensureProjectStoreReady();

  const rows = db.prepare("SELECT id, data, created_at, updated_at FROM projects ORDER BY created_at DESC").all() as ProjectRow[];
  return rows.map((row) => parseProject(row.data, `projects row ${row.id}`));
}

export async function updateProject(
  projectId: string,
  updater: (project: Project) => Promise<Project> | Project,
): Promise<Project> {
  const currentProject = await getProject(projectId);
  if (!currentProject) {
    throw new Error(`Project not found: ${projectId}`);
  }

  const updatedProject = await updater(currentProject);
  await saveProject(updatedProject);
  return updatedProject;
}

export async function deleteProject(projectId: string): Promise<void> {
  await ensureProjectStoreReady();

  const result = db.prepare("DELETE FROM projects WHERE id = ?").run(projectId);
  if (result.changes === 0) {
    throw new Error(`Project not found: ${projectId}`);
  }
}
