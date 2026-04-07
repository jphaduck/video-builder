import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, readdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { CreateProjectInput, Project } from "@/types/project";

const DATA_DIR = path.join(process.cwd(), "data");
const PROJECTS_DIR = path.join(DATA_DIR, "projects");
const LEGACY_PROJECTS_FILE = path.join(DATA_DIR, "projects.json");
const LEGACY_PROJECTS_ARCHIVE_FILE = path.join(DATA_DIR, "projects.legacy-backup.json");

type LegacyProjectsStore = {
  projects?: Project[];
};

let projectWriteQueue: Promise<unknown> = Promise.resolve();
let migrationPromise: Promise<void> | null = null;

function isErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

function withProjectWriteLock<T>(operation: () => Promise<T>): Promise<T> {
  const queuedOperation = projectWriteQueue.then(operation, operation);
  projectWriteQueue = queuedOperation.then(
    () => undefined,
    () => undefined,
  );
  return queuedOperation;
}

function getProjectFilePath(projectId: string): string {
  return path.join(PROJECTS_DIR, `${projectId}.json`);
}

function parseProject(raw: string, filePath: string): Project {
  try {
    return JSON.parse(raw) as Project;
  } catch (error) {
    throw new Error(`Failed to parse ${filePath}: ${error instanceof Error ? error.message : "unknown error"}`);
  }
}

async function writeProjectFile(project: Project): Promise<void> {
  await mkdir(PROJECTS_DIR, { recursive: true });
  const tempFile = path.join(PROJECTS_DIR, `${project.id}.${randomUUID()}.tmp`);
  await writeFile(tempFile, JSON.stringify(project, null, 2), "utf8");
  await rename(tempFile, getProjectFilePath(project.id));
}

async function archiveLegacyStore(raw: string): Promise<void> {
  try {
    await writeFile(LEGACY_PROJECTS_ARCHIVE_FILE, raw, { encoding: "utf8", flag: "wx" });
  } catch (error) {
    if (!(isErrnoException(error) && error.code === "EEXIST")) {
      throw error;
    }
  }

  try {
    await unlink(LEGACY_PROJECTS_FILE);
  } catch (error) {
    if (!(isErrnoException(error) && error.code === "ENOENT")) {
      throw error;
    }
  }
}

async function migrateLegacyProjectsIfNeeded(): Promise<void> {
  if (!migrationPromise) {
    migrationPromise = withProjectWriteLock(async () => {
      let raw: string;

      try {
        raw = await readFile(LEGACY_PROJECTS_FILE, "utf8");
      } catch (error) {
        if (isErrnoException(error) && error.code === "ENOENT") {
          return;
        }

        throw error;
      }

      const parsed = JSON.parse(raw) as LegacyProjectsStore;
      const legacyProjects = Array.isArray(parsed.projects) ? parsed.projects : [];

      for (const project of legacyProjects) {
        try {
          await readFile(getProjectFilePath(project.id), "utf8");
        } catch (error) {
          if (isErrnoException(error) && error.code === "ENOENT") {
            await writeProjectFile(project);
            continue;
          }

          throw error;
        }
      }

      await archiveLegacyStore(raw);
    }).catch((error) => {
      migrationPromise = null;
      throw error;
    });
  }

  await migrationPromise;
}

async function ensureProjectsDirectory(): Promise<void> {
  await mkdir(PROJECTS_DIR, { recursive: true });
  await migrateLegacyProjectsIfNeeded();
}

async function readProjectRequired(projectId: string): Promise<Project> {
  const project = await getProject(projectId);

  if (!project) {
    throw new Error(`Project not found: ${projectId}`);
  }

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
  await ensureProjectsDirectory();

  try {
    const raw = await readFile(getProjectFilePath(projectId), "utf8");
    return parseProject(raw, getProjectFilePath(projectId));
  } catch (error) {
    if (isErrnoException(error) && error.code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

export async function listProjects(): Promise<Project[]> {
  await ensureProjectsDirectory();
  const entries = await readdir(PROJECTS_DIR, { withFileTypes: true });
  const projects = await Promise.all(
    entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .map(async (entry) => {
        const filePath = path.join(PROJECTS_DIR, entry.name);
        const raw = await readFile(filePath, "utf8");
        return parseProject(raw, filePath);
      }),
  );

  return projects.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function saveProject(project: Project): Promise<Project> {
  await ensureProjectsDirectory();

  return withProjectWriteLock(async () => {
    await writeProjectFile(project);
    return project;
  });
}

export async function updateProject(projectId: string, updater: (project: Project) => Promise<Project> | Project): Promise<Project> {
  await ensureProjectsDirectory();

  return withProjectWriteLock(async () => {
    const currentProject = await readProjectRequired(projectId);
    const updatedProject = await updater(currentProject);
    await writeProjectFile(updatedProject);
    return updatedProject;
  });
}
