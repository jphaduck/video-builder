import "server-only";

// Project-domain repository layer that normalizes stored records and applies script workflow mutations.

import { randomUUID } from "node:crypto";
import {
  createProject as createStoredProject,
  getProject as getStoredProject,
  listProjects as listStoredProjects,
  updateProject as updateStoredProject,
} from "@/lib/projects";
import { deleteCaptionTrack } from "@/modules/captions/repository";
import { deleteNarrationTrack } from "@/modules/narration/repository";
import { deleteScene } from "@/modules/scenes/repository";
import { buildSceneOutline } from "@/modules/scripts/draft-utils";
import type {
  CreateProjectInput,
  ProjectRecord,
  ProjectStatus,
  ScriptDraftApprovalStatus,
  StoryDraftRecord,
} from "@/types/project";
import type { GeneratedStoryDraft } from "@/modules/scripts/types";

function normalizeApprovalStatus(value: ScriptDraftApprovalStatus | undefined): ScriptDraftApprovalStatus {
  if (value === "approved" || value === "rejected") {
    return value;
  }

  return "pending";
}

function normalizeDraftRecord(draft: StoryDraftRecord): StoryDraftRecord {
  return {
    ...draft,
    versionLabel: draft.versionLabel || "v1",
    fullNarrationDraft: draft.fullNarrationDraft || "",
    approvalStatus: normalizeApprovalStatus(draft.approvalStatus),
    source: draft.source || "generated",
    derivedFromDraftId: draft.derivedFromDraftId,
  };
}

function normalizeScriptDraftFromLegacy(project: ProjectRecord): StoryDraftRecord[] {
  if (project.scriptDrafts?.length) {
    return project.scriptDrafts.map(normalizeDraftRecord);
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
      approvalStatus: normalizeApprovalStatus(legacyDraft.approvalStatus),
      source: legacyDraft.source || "generated",
      derivedFromDraftId: legacyDraft.derivedFromDraftId,
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

async function deleteScenePlanFiles(sceneIds: string[]): Promise<void> {
  await Promise.all(sceneIds.map((sceneId) => deleteScene(sceneId)));
}

async function deleteNarrationTracks(trackIds: string[]): Promise<void> {
  await Promise.all(trackIds.map((trackId) => deleteNarrationTrack(trackId)));
}

async function deleteCaptionTracks(trackIds: string[]): Promise<void> {
  await Promise.all(trackIds.map((trackId) => deleteCaptionTrack(trackId)));
}

async function deleteDerivedArtifactsForProject(project: ProjectRecord): Promise<void> {
  await deleteScenePlanFiles(project.workflow.sceneIds);
  await deleteNarrationTracks(project.workflow.narrationTrackIds);
  await deleteCaptionTracks(project.workflow.captionTrackIds);
}

function appendUniqueId(ids: string[], nextId: string): string[] {
  return ids.includes(nextId) ? ids : [...ids, nextId];
}

function replaceId(ids: string[], previousId: string, nextId: string): string[] {
  const remainingIds = ids.filter((id) => id !== previousId);
  return appendUniqueId(remainingIds, nextId);
}

export async function listProjects(): Promise<ProjectRecord[]> {
  const projects = await listStoredProjects();
  return projects.map(normalizeProject).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getProjectById(projectId: string): Promise<ProjectRecord | null> {
  const project = await getStoredProject(projectId);
  return project ? normalizeProject(project) : null;
}

export async function createProject(input: CreateProjectInput): Promise<ProjectRecord> {
  const project = await createStoredProject(input);
  return normalizeProject(project);
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
  const updatedProject = await updateStoredProject(projectId, (project) => {
    const existing = normalizeProject(project);
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
      source: "generated",
      sceneOutline: generatedStory.sceneOutline,
    };

    return {
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
  });

  return normalizeProject(updatedProject);
}

type SaveManualStoryDraftInput = {
  titleOptions: string[];
  hook: string;
  narrationDraft: string;
  notes?: string;
  derivedFromDraftId?: string;
};

export async function saveManualScriptDraftForProject(
  projectId: string,
  input: SaveManualStoryDraftInput,
): Promise<ProjectRecord> {
  const updatedProject = await updateStoredProject(projectId, (project) => {
    const existing = normalizeProject(project);
    const now = new Date().toISOString();
    const storyDraftId = randomUUID();
    const nextVersionNumber = existing.scriptDrafts.length + 1;
    const newDraft: StoryDraftRecord = {
      id: storyDraftId,
      createdAt: now,
      versionLabel: `v${nextVersionNumber}`,
      titleOptions: input.titleOptions,
      hook: input.hook,
      fullNarrationDraft: input.narrationDraft,
      notes: input.notes,
      approvalStatus: "pending",
      source: "manual_edit",
      derivedFromDraftId: input.derivedFromDraftId,
      sceneOutline: buildSceneOutline(input.narrationDraft),
    };

    return {
      ...existing,
      status: existing.approvedScriptDraftId ? existing.status : "draft",
      updatedAt: now,
      storyDraft: newDraft,
      scriptDrafts: [...existing.scriptDrafts, newDraft],
      activeScriptDraftId: storyDraftId,
      latestScriptDraftId: storyDraftId,
      workflow: {
        ...existing.workflow,
        scriptDraftIds: [...existing.workflow.scriptDraftIds, storyDraftId],
      },
    };
  });

  return normalizeProject(updatedProject);
}

export async function setActiveScriptDraft(projectId: string, scriptDraftId: string): Promise<ProjectRecord> {
  const updatedProject = await updateStoredProject(projectId, (project) => {
    const existing = normalizeProject(project);
    const selectedDraft = existing.scriptDrafts.find((draft) => draft.id === scriptDraftId);
    if (!selectedDraft) {
      throw new Error(`Script draft not found: ${scriptDraftId}`);
    }

    return {
      ...existing,
      updatedAt: new Date().toISOString(),
      activeScriptDraftId: selectedDraft.id,
      storyDraft: selectedDraft,
    };
  });

  return normalizeProject(updatedProject);
}

export async function approveScriptDraft(projectId: string, scriptDraftId: string): Promise<ProjectRecord> {
  const updatedProject = await updateStoredProject(projectId, async (project) => {
    const existing = normalizeProject(project);
    const approvedAt = new Date().toISOString();
    const shouldClearScenePlan = existing.workflow.sceneIds.length > 0 && existing.approvedScriptDraftId !== scriptDraftId;

    const updatedDrafts = existing.scriptDrafts.map((draft) => ({
      ...draft,
      approvalStatus:
        draft.id === scriptDraftId
          ? ("approved" as const)
          : draft.approvalStatus === "rejected"
            ? ("rejected" as const)
            : ("pending" as const),
    }));
    const approvedDraft = updatedDrafts.find((draft) => draft.id === scriptDraftId);

    if (!approvedDraft) {
      throw new Error(`Script draft not found: ${scriptDraftId}`);
    }

    if (shouldClearScenePlan) {
      await deleteDerivedArtifactsForProject(existing);
    }

    return {
      ...existing,
      status: "script_ready",
      updatedAt: approvedAt,
      scriptDrafts: updatedDrafts,
      approvedScriptDraftId: scriptDraftId,
      activeScriptDraftId: scriptDraftId,
      storyDraft: approvedDraft,
      workflow: {
        ...existing.workflow,
        sceneIds: shouldClearScenePlan ? [] : existing.workflow.sceneIds,
        narrationTrackIds: shouldClearScenePlan ? [] : existing.workflow.narrationTrackIds,
        captionTrackIds: shouldClearScenePlan ? [] : existing.workflow.captionTrackIds,
      },
    };
  });

  return normalizeProject(updatedProject);
}

export async function rejectScriptDraft(projectId: string, scriptDraftId: string): Promise<ProjectRecord> {
  const updatedProject = await updateStoredProject(projectId, async (project) => {
    const existing = normalizeProject(project);
    const rejectedDraft = existing.scriptDrafts.find((draft) => draft.id === scriptDraftId);

    if (!rejectedDraft) {
      throw new Error(`Script draft not found: ${scriptDraftId}`);
    }

    const updatedDrafts = existing.scriptDrafts.map((draft) =>
      draft.id === scriptDraftId ? { ...draft, approvalStatus: "rejected" as const } : draft,
    );
    const approvedScriptDraftId =
      existing.approvedScriptDraftId === scriptDraftId ? undefined : existing.approvedScriptDraftId;
    const shouldClearScenePlan = existing.workflow.sceneIds.length > 0 && existing.approvedScriptDraftId === scriptDraftId;
    const storyDraft = updatedDrafts.find((draft) => draft.id === existing.storyDraft?.id) ?? existing.storyDraft;

    if (shouldClearScenePlan) {
      await deleteDerivedArtifactsForProject(existing);
    }

    return {
      ...existing,
      status: approvedScriptDraftId ? "script_ready" : "draft",
      updatedAt: new Date().toISOString(),
      scriptDrafts: updatedDrafts,
      approvedScriptDraftId,
      storyDraft,
      activeScriptDraftId: existing.activeScriptDraftId === scriptDraftId ? rejectedDraft.id : existing.activeScriptDraftId,
      workflow: {
        ...existing.workflow,
        sceneIds: shouldClearScenePlan ? [] : existing.workflow.sceneIds,
        narrationTrackIds: shouldClearScenePlan ? [] : existing.workflow.narrationTrackIds,
        captionTrackIds: shouldClearScenePlan ? [] : existing.workflow.captionTrackIds,
      },
    };
  });

  return normalizeProject(updatedProject);
}

export async function clearScenePlanForProject(
  projectId: string,
  nextStatus: ProjectStatus = "script_ready",
): Promise<ProjectRecord> {
  const updatedProject = await updateStoredProject(projectId, async (project) => {
    const existing = normalizeProject(project);

    await deleteDerivedArtifactsForProject(existing);

    return {
      ...existing,
      status: nextStatus,
      updatedAt: new Date().toISOString(),
      workflow: {
        ...existing.workflow,
        sceneIds: [],
        narrationTrackIds: [],
        captionTrackIds: [],
      },
    };
  });

  return normalizeProject(updatedProject);
}

export async function saveScenePlanForProject(projectId: string, sceneIds: string[]): Promise<ProjectRecord> {
  const updatedProject = await updateStoredProject(projectId, (project) => {
    const existing = normalizeProject(project);

    return {
      ...existing,
      status: "scene_planning",
      updatedAt: new Date().toISOString(),
      workflow: {
        ...existing.workflow,
        sceneIds,
      },
    };
  });

  return normalizeProject(updatedProject);
}

export async function approveScenePlanForProject(projectId: string): Promise<ProjectRecord> {
  const updatedProject = await updateStoredProject(projectId, (project) => {
    const existing = normalizeProject(project);

    if (existing.workflow.sceneIds.length === 0) {
      throw new Error("Scene plan not found for this project.");
    }

    return {
      ...existing,
      status: "scene_ready",
      updatedAt: new Date().toISOString(),
    };
  });

  return normalizeProject(updatedProject);
}

export async function saveNarrationTrackForProject(projectId: string, trackId: string): Promise<ProjectRecord> {
  const updatedProject = await updateStoredProject(projectId, (project) => {
    const existing = normalizeProject(project);

    return {
      ...existing,
      status: "narration_pending",
      updatedAt: new Date().toISOString(),
      workflow: {
        ...existing.workflow,
        narrationTrackIds: appendUniqueId(existing.workflow.narrationTrackIds, trackId),
      },
    };
  });

  return normalizeProject(updatedProject);
}

export async function replaceNarrationTrackForProject(
  projectId: string,
  previousTrackId: string,
  nextTrackId: string,
): Promise<ProjectRecord> {
  const updatedProject = await updateStoredProject(projectId, (project) => {
    const existing = normalizeProject(project);

    return {
      ...existing,
      status: "narration_pending",
      updatedAt: new Date().toISOString(),
      workflow: {
        ...existing.workflow,
        narrationTrackIds: replaceId(existing.workflow.narrationTrackIds, previousTrackId, nextTrackId),
      },
    };
  });

  return normalizeProject(updatedProject);
}

export async function approveNarrationTrackForProject(projectId: string): Promise<ProjectRecord> {
  const updatedProject = await updateStoredProject(projectId, (project) => {
    const existing = normalizeProject(project);

    return {
      ...existing,
      status: "voice_ready",
      updatedAt: new Date().toISOString(),
    };
  });

  return normalizeProject(updatedProject);
}

export async function saveCaptionTrackForProject(projectId: string, trackId: string): Promise<ProjectRecord> {
  const updatedProject = await updateStoredProject(projectId, (project) => {
    const existing = normalizeProject(project);

    return {
      ...existing,
      updatedAt: new Date().toISOString(),
      workflow: {
        ...existing.workflow,
        captionTrackIds: appendUniqueId(existing.workflow.captionTrackIds, trackId),
      },
    };
  });

  return normalizeProject(updatedProject);
}
