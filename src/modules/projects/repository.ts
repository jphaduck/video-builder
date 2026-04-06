import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { CreateProjectInput, ProjectRecord } from "@/modules/projects/types";

const DATA_DIR = path.join(process.cwd(), "data");
const PROJECTS_FILE = path.join(DATA_DIR, "projects.json");

type ProjectsStore = {
  projects: ProjectRecord[];
};

async function ensureStore(): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });

  try {
    await readFile(PROJECTS_FILE, "utf8");
  } catch {
    await writeFile(PROJECTS_FILE, JSON.stringify({ projects: [] }, null, 2), "utf8");
  }
}

async function readStore(): Promise<ProjectsStore> {
  await ensureStore();
  const raw = await readFile(PROJECTS_FILE, "utf8");

  try {
    const parsed = JSON.parse(raw) as ProjectsStore;
    return { projects: parsed.projects ?? [] };
  } catch {
    return { projects: [] };
  }
}

async function writeStore(store: ProjectsStore): Promise<void> {
  await ensureStore();
  await writeFile(PROJECTS_FILE, JSON.stringify(store, null, 2), "utf8");
}

export async function listProjects(): Promise<ProjectRecord[]> {
  const store = await readStore();
  return [...store.projects].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getProjectById(projectId: string): Promise<ProjectRecord | null> {
  const store = await readStore();
  return store.projects.find((project) => project.id === projectId) ?? null;
}

export async function createProject(input: CreateProjectInput): Promise<ProjectRecord> {
  const now = new Date().toISOString();

  const project: ProjectRecord = {
    id: randomUUID(),
    name: input.name,
    status: "draft",
    createdAt: now,
    updatedAt: now,
    storyInput: {
      premise: input.premise,
    },
    workflow: {
      scriptDraftIds: [],
      sceneIds: [],
      assetIds: [],
      narrationTrackIds: [],
      captionTrackIds: [],
      renderJobIds: [],
    },
  };

  const store = await readStore();
  store.projects.push(project);
  await writeStore(store);

  return project;
}
