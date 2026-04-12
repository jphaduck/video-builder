import "server-only";

import { db, runMigration } from "@/lib/db";
import type { TimelineDraft } from "@/modules/timeline/types";

type TimelineDataRow = {
  data: string;
};

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

  const row = db.prepare("SELECT data FROM timelines WHERE project_id = ?").get(projectId) as TimelineDataRow | undefined;
  return row ? parseTimelineDraft(row.data, `timelines row ${projectId}`) : null;
}

export async function deleteTimelineDraft(projectId: string): Promise<void> {
  await ensureTimelineStoreReady();
  db.prepare("DELETE FROM timelines WHERE project_id = ?").run(projectId);
}
