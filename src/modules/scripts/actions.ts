"use server";

import { redirect } from "next/navigation";
import { parseTitleOptionsText } from "@/modules/scripts/draft-utils";
import {
  approveScriptDraft,
  rejectScriptDraft,
  saveManualScriptDraftForProject,
  saveStoryDraftForProject,
  setActiveScriptDraft,
} from "@/modules/projects/repository";
import { generateStoryDraft } from "@/modules/scripts/service";

function parseRuntime(rawValue: FormDataEntryValue | null): number {
  const parsed = Number(rawValue ?? 10);
  if (!Number.isFinite(parsed)) {
    return 10;
  }

  return Math.min(20, Math.max(5, Math.round(parsed)));
}

function buildProjectRedirectPath(projectId: string, scriptDraftId?: string): string {
  const params = new URLSearchParams();
  if (scriptDraftId) {
    params.set("draftId", scriptDraftId);
  }

  const query = params.toString();
  return query ? `/projects/${projectId}?${query}` : `/projects/${projectId}`;
}

export async function generateStoryForProjectAction(formData: FormData): Promise<void> {
  const projectId = String(formData.get("projectId") ?? "").trim();
  const premise = String(formData.get("premise") ?? "").trim();

  if (!projectId || !premise) {
    throw new Error("Project ID and premise are required to generate a story draft.");
  }

  const storyInput = {
    premise,
    theme: String(formData.get("theme") ?? "").trim() || undefined,
    tone: String(formData.get("tone") ?? "").trim() || undefined,
    plotNotes: String(formData.get("plotNotes") ?? "").trim() || undefined,
    targetRuntimeMin: parseRuntime(formData.get("targetRuntimeMin")),
  };

  const projectName = String(formData.get("projectName") ?? "").trim();
  const generatedStory = await generateStoryDraft({
    projectName: projectName || "Untitled Project",
    premise: storyInput.premise,
    theme: storyInput.theme,
    tone: storyInput.tone,
    plotNotes: storyInput.plotNotes,
    targetRuntimeMin: storyInput.targetRuntimeMin ?? 10,
  });

  const updatedProject = await saveStoryDraftForProject(projectId, storyInput, generatedStory);
  redirect(buildProjectRedirectPath(updatedProject.id, updatedProject.activeScriptDraftId));
}

export async function setActiveScriptDraftAction(formData: FormData): Promise<void> {
  const projectId = String(formData.get("projectId") ?? "").trim();
  const scriptDraftId = String(formData.get("scriptDraftId") ?? "").trim();
  if (!projectId || !scriptDraftId) {
    throw new Error("Project ID and script draft ID are required.");
  }

  const updatedProject = await setActiveScriptDraft(projectId, scriptDraftId);
  redirect(buildProjectRedirectPath(updatedProject.id, scriptDraftId));
}

export async function approveScriptDraftAction(formData: FormData): Promise<void> {
  const projectId = String(formData.get("projectId") ?? "").trim();
  const scriptDraftId = String(formData.get("scriptDraftId") ?? "").trim();
  if (!projectId || !scriptDraftId) {
    throw new Error("Project ID and script draft ID are required.");
  }

  const updatedProject = await approveScriptDraft(projectId, scriptDraftId);
  redirect(buildProjectRedirectPath(updatedProject.id, scriptDraftId));
}

export async function rejectScriptDraftAction(formData: FormData): Promise<void> {
  const projectId = String(formData.get("projectId") ?? "").trim();
  const scriptDraftId = String(formData.get("scriptDraftId") ?? "").trim();
  if (!projectId || !scriptDraftId) {
    throw new Error("Project ID and script draft ID are required.");
  }

  const updatedProject = await rejectScriptDraft(projectId, scriptDraftId);
  redirect(buildProjectRedirectPath(updatedProject.id, scriptDraftId));
}

export async function saveEditedScriptDraftAction(formData: FormData): Promise<void> {
  const projectId = String(formData.get("projectId") ?? "").trim();
  const sourceDraftId = String(formData.get("sourceDraftId") ?? "").trim() || undefined;
  const hook = String(formData.get("hook") ?? "").trim();
  const narrationDraft = String(formData.get("narrationDraft") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim() || undefined;
  const titleOptions = parseTitleOptionsText(String(formData.get("titleOptionsText") ?? ""));

  if (!projectId || !hook || !narrationDraft) {
    throw new Error("Project ID, hook, and narration draft are required.");
  }

  if (titleOptions.length !== 3) {
    throw new Error("Provide exactly 3 title options, one per line.");
  }

  const updatedProject = await saveManualScriptDraftForProject(projectId, {
    titleOptions,
    hook,
    narrationDraft,
    notes,
    derivedFromDraftId: sourceDraftId,
  });

  redirect(buildProjectRedirectPath(updatedProject.id, updatedProject.activeScriptDraftId));
}
