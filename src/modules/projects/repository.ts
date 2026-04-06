import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { CreateProjectInput, ProjectRecord, StoryDraftRecord } from "@/modules/projects/types";
import type { GeneratedStoryDraft } from "@/modules/scripts/types";

const DATA_DIR = path.join(process.cwd(), "data");
const PROJECTS_FILE = path.join(DATA_DIR, "projects.json");

type ProjectsStore = {
  projects: ProjectRecord[];
};

function normalizeScriptDraftFromLegacy(project: ProjectRecord): StoryDraftRecord[] {
  if (project.scriptDrafts?.length) {
    return project.scriptDrafts;
  }

  if (!project.storyDraft) {
    return [];
  }

  const legacyDraft = project.storyDraft as StoryDraftRecord & { narrationDraft?: string };
  return [
    {
      ...legacyDraft,
      versionLabel: legacyDraft.versionLabel || "v1",
      fullNarrationDraft: legacyDraft.fullNarrationDraft || legacyDraft.narrationDraft || "",
      approvalStatus: legacyDraft.approvalStatus || "pending",
    },
  ];
}

function normalizeProject(project: ProjectRecord): ProjectRecord {
  const scriptDrafts = normalizeScriptDraftFromLegacy(project);
  const latestScriptDraftId = project.latestScriptDraftId ?? scriptDrafts.at(-1)?.id;
  const activeScriptDraftId = project.activeScriptDraftId ?? latestScriptDraftId;

  return {
    ...project,
    scriptDrafts,
    activeScriptDraftId,
    latestScriptDraftId,
    approvedScriptDraftId: project.approvedScriptDraftId,
    workflow: {
      scriptDraftIds: project.workflow?.scriptDraftIds ?? scriptDrafts.map((draft) => draft.id),
      sceneIds: project.workflow?.sceneIds ?? [],
      assetIds: project.workflow?.assetIds ?? [],
      narrationTrackIds: project.workflow?.narrationTrackIds ?? [],
      captionTrackIds: project.workflow?.captionTrackIds ?? [],
      renderJobIds: project.workflow?.renderJobIds ?? [],
    },
  };
}

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
  return [...store.projects].map(normalizeProject).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getProjectById(projectId: string): Promise<ProjectRecord | null> {
  const store = await readStore();
  const project = store.projects.find((entry) => entry.id === projectId);
  return project ? normalizeProject(project) : null;
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

  const store = await readStore();
  store.projects.push(project);
  await writeStore(store);

  return project;
}

type SaveStoryInput = {
  premise: string;
  theme?: string;
  tone?: string;
  plotNotes?: string;
  targetRuntimeMin?: number;
};

export async function saveStoryDraftForProject(
  projectId: string,
  storyInput: SaveStoryInput,
  generatedStory: GeneratedStoryDraft,
): Promise<ProjectRecord> {
  const store = await readStore();
  const projectIndex = store.projects.findIndex((project) => project.id === projectId);

  if (projectIndex < 0) {
    throw new Error(`Project not found: ${projectId}`);
  }

  const existing = normalizeProject(store.projects[projectIndex]);
  const now = new Date().toISOString();
  const storyDraftId = randomUUID();
  const nextVersionNumber = existing.scriptDrafts.length + 1;
  const newDraft: StoryDraftRecord = {
    id: storyDraftId,
    createdAt: now,
    versionLabel: `v${nextVersionNumber}`,
    titleOptions: generatedStory.titleOptions,
    hook: generatedStory.hook,
    fullNarrationDraft: generatedStory.narrationDraft,
    notes: generatedStory.notes,
    approvalStatus: "pending",
    sceneOutline: generatedStory.sceneOutline,
  };

  const updatedProject: ProjectRecord = {
    ...existing,
    status: existing.approvedScriptDraftId ? existing.status : "draft",
    updatedAt: now,
    storyInput: {
      ...existing.storyInput,
      premise: storyInput.premise,
      theme: storyInput.theme,
      tone: storyInput.tone,
      plotNotes: storyInput.plotNotes,
      targetRuntimeMin: storyInput.targetRuntimeMin,
    },
    storyDraft: newDraft,
    scriptDrafts: [...existing.scriptDrafts, newDraft],
    activeScriptDraftId: storyDraftId,
    latestScriptDraftId: storyDraftId,
    workflow: {
      ...existing.workflow,
      scriptDraftIds: [...existing.workflow.scriptDraftIds, storyDraftId],
    },
  };

  store.projects[projectIndex] = updatedProject;
  await writeStore(store);

  return updatedProject;
}

export async function setActiveScriptDraft(projectId: string, scriptDraftId: string): Promise<ProjectRecord> {
  const store = await readStore();
  const projectIndex = store.projects.findIndex((project) => project.id === projectId);

  if (projectIndex < 0) {
    throw new Error(`Project not found: ${projectId}`);
  }

  const existing = normalizeProject(store.projects[projectIndex]);
  const selectedDraft = existing.scriptDrafts.find((draft) => draft.id === scriptDraftId);
  if (!selectedDraft) {
    throw new Error(`Script draft not found: ${scriptDraftId}`);
  }

  const updatedProject: ProjectRecord = {
    ...existing,
    updatedAt: new Date().toISOString(),
    activeScriptDraftId: selectedDraft.id,
    storyDraft: selectedDraft,
  };

  store.projects[projectIndex] = updatedProject;
  await writeStore(store);

  return updatedProject;
}

export async function approveScriptDraft(projectId: string, scriptDraftId: string): Promise<ProjectRecord> {
  const store = await readStore();
  const projectIndex = store.projects.findIndex((project) => project.id === projectId);

  if (projectIndex < 0) {
    throw new Error(`Project not found: ${projectId}`);
  }

  const existing = normalizeProject(store.projects[projectIndex]);
  const approvedAt = new Date().toISOString();

  const updatedDrafts = existing.scriptDrafts.map((draft) => ({
    ...draft,
    approvalStatus: draft.id === scriptDraftId ? ("approved" as const) : ("pending" as const),
  }));
  const approvedDraft = updatedDrafts.find((draft) => draft.id === scriptDraftId);

  if (!approvedDraft) {
    throw new Error(`Script draft not found: ${scriptDraftId}`);
  }

  const updatedProject: ProjectRecord = {
    ...existing,
    status: "script_ready",
    updatedAt: approvedAt,
    scriptDrafts: updatedDrafts,
    approvedScriptDraftId: scriptDraftId,
    activeScriptDraftId: scriptDraftId,
    storyDraft: approvedDraft,
  };

  store.projects[projectIndex] = updatedProject;
  await writeStore(store);

  return updatedProject;
}
