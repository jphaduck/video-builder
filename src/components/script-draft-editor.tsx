import { serializeTitleOptions } from "@/modules/scripts/draft-utils";
import type { StoryDraftRecord } from "@/modules/projects/types";
import { saveEditedScriptDraftAction } from "@/modules/scripts/actions";

type ScriptDraftEditorProps = {
  projectId: string;
  draft: StoryDraftRecord;
};

export function ScriptDraftEditor({ projectId, draft }: ScriptDraftEditorProps) {
  return (
    <section className="card" style={{ marginTop: 16 }}>
      <h3 style={{ marginTop: 0 }}>Edit Draft as New Version</h3>
      <p className="subtitle" style={{ marginTop: 0 }}>
        Manual edits create a new draft version so you can refine the script without losing earlier generated work.
      </p>
      <form action={saveEditedScriptDraftAction} className="grid">
        <input type="hidden" name="projectId" value={projectId} />
        <input type="hidden" name="sourceDraftId" value={draft.id} />

        <label>
          <strong>Title options</strong>
          <p className="subtitle" style={{ margin: "6px 0 0" }}>
            Enter exactly 3 title options, one per line.
          </p>
          <textarea
            name="titleOptionsText"
            defaultValue={serializeTitleOptions(draft.titleOptions)}
            rows={4}
            style={{ width: "100%", marginTop: 8 }}
          />
        </label>

        <label>
          <strong>Hook</strong>
          <textarea name="hook" defaultValue={draft.hook} rows={5} style={{ width: "100%", marginTop: 8 }} />
        </label>

        <label>
          <strong>Full narration draft</strong>
          <textarea
            name="narrationDraft"
            defaultValue={draft.fullNarrationDraft}
            rows={16}
            style={{ width: "100%", marginTop: 8 }}
          />
        </label>

        <label>
          <strong>Editor notes</strong>
          <textarea
            name="notes"
            defaultValue={draft.notes ?? ""}
            placeholder="Optional notes about why this version exists or what changed"
            rows={3}
            style={{ width: "100%", marginTop: 8 }}
          />
        </label>

        <button type="submit" className="card" style={{ cursor: "pointer", width: 260 }}>
          Save Edited Draft Version
        </button>
      </form>
    </section>
  );
}
