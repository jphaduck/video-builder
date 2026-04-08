"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type ProjectDeleteButtonProps = {
  projectId: string;
  projectName: string;
};

export function ProjectDeleteButton({ projectId, projectName }: ProjectDeleteButtonProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDelete(): Promise<void> {
    if (!window.confirm(`Delete "${projectName}"? This will remove the project and its derived files.`)) {
      return;
    }

    setIsDeleting(true);

    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Project deletion failed.");
      }

      router.replace("/projects");
      router.refresh();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Project deletion failed.");
      setIsDeleting(false);
    }
  }

  return (
    <button
      type="button"
      className="card"
      onClick={() => void handleDelete()}
      disabled={isDeleting}
      style={{ cursor: isDeleting ? "wait" : "pointer" }}
    >
      {isDeleting ? "Deleting..." : "Delete"}
    </button>
  );
}
