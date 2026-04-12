import "server-only";

import { auth } from "@/auth";
import { db, runMigration } from "@/lib/db";
import { getProject, getProjectByAnyOwner } from "@/lib/project-store";
import type { TimelineDraft } from "@/modules/timeline/types";

type TimelineDataRow = {
  data: string;
};

async function getReadableProject(projectId: string) {
  const session = await auth();
  return session?.user?.id ? getProject(projectId, session.user.id) : getProjectByAnyOwner(projectId);
}

function parseTimelineDraft(raw: string, context: string): TimelineDraft {
  try {
    return JSON.parse(raw) as TimelineDraft;
  } catch (error) {
    throw new Error(`Failed to parse ${context}: ${error instanceof Error ? error.message : "unknown error"}`);
  }
}

async function ensureTimelineStoreReady(): Promise<void> {
  await runMigration();
}

export async function saveTimelineDraft(draft: TimelineDraft): Promise<void> {
  await ensureTimelineStoreReady();

  db.prepare(
    `
      INSERT INTO timelines (project_id, data, updated_at)
      VALUES (@project_id, @data, @updated_at)
      ON CONFLICT(project_id) DO UPDATE SET
        data = excluded.data,
        updated_at = excluded.updated_at
    `,
  ).run({
    project_id: draft.projectId,
    data: JSON.stringify(draft, null, 2),
    updated_at: draft.updatedAt,
  });
}

export async function getTimelineDraft(projectId: string): Promise<TimelineDraft | null> {
  await ensureTimelineStoreReady();

  const project = await getReadableProject(projectId);
  if (!project) {
    return null;
  }

  const row = db.prepare("SELECT data FROM timelines WHERE project_id = ?").get(projectId) as TimelineDataRow | undefined;
  return row ? parseTimelineDraft(row.data, `timelines row ${projectId}`) : null;
}

export async function deleteTimelineDraft(projectId: string): Promise<void> {
  await ensureTimelineStoreReady();
  db.prepare("DELETE FROM timelines WHERE project_id = ?").run(projectId);
}
