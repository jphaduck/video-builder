"use server";

import { revalidatePath } from "next/cache";
import { generateStoryDraft } from "@/modules/scripts/service";
import { approveScriptDraft, saveStoryDraftForProject, setActiveScriptDraft } from "@/modules/projects/repository";

function parseRuntime(rawValue: FormDataEntryValue | null): number {
  const parsed = Number(rawValue ?? 10);
  if (!Number.isFinite(parsed)) {
    return 10;
  }

  return Math.min(20, Math.max(5, Math.round(parsed)));
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
  revalidatePath(`/projects/${updatedProject.id}`);
}

export async function setActiveScriptDraftAction(formData: FormData): Promise<void> {
  const projectId = String(formData.get("projectId") ?? "").trim();
  const scriptDraftId = String(formData.get("scriptDraftId") ?? "").trim();
  if (!projectId || !scriptDraftId) {
    throw new Error("Project ID and script draft ID are required.");
  }

  const updatedProject = await setActiveScriptDraft(projectId, scriptDraftId);
  revalidatePath(`/projects/${updatedProject.id}`);
}

export async function approveScriptDraftAction(formData: FormData): Promise<void> {
  const projectId = String(formData.get("projectId") ?? "").trim();
  const scriptDraftId = String(formData.get("scriptDraftId") ?? "").trim();
  if (!projectId || !scriptDraftId) {
    throw new Error("Project ID and script draft ID are required.");
  }

  const updatedProject = await approveScriptDraft(projectId, scriptDraftId);
  revalidatePath(`/projects/${updatedProject.id}`);
}
