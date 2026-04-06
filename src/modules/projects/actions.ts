"use server";

import { redirect } from "next/navigation";
import { createProject } from "@/modules/projects/repository";

export async function createProjectAction(formData: FormData): Promise<void> {
  const name = String(formData.get("name") ?? "").trim();
  const premise = String(formData.get("premise") ?? "").trim();

  if (!name || !premise) {
    throw new Error("Project name and premise are required.");
  }

  const project = await createProject({ name, premise });
  redirect(`/projects/${project.id}`);
}
