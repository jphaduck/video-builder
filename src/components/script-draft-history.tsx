import Link from "next/link";
import type { StoryDraftRecord } from "@/modules/projects/types";
import { approveScriptDraftAction, setActiveScriptDraftAction } from "@/modules/scripts/actions";

type ScriptDraftHistoryProps = {
  projectId: string;
  scriptDrafts: StoryDraftRecord[];
  activeDraftId?: string;
  approvedDraftId?: string;
  selectedDraftId?: string;
  compareDraftId?: string;
};

function getDraftById(scriptDrafts: StoryDraftRecord[], draftId: string | undefined): StoryDraftRecord | null {
  if (!draftId) {
    return null;
  }

  return scriptDrafts.find((draft) => draft.id === draftId) ?? null;
}

export function ScriptDraftHistory({
  projectId,
  scriptDrafts,
  activeDraftId,
  approvedDraftId,
  selectedDraftId,
  compareDraftId,
}: ScriptDraftHistoryProps) {
  const orderedDrafts = [...scriptDrafts].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const selectedDraft = getDraftById(orderedDrafts, selectedDraftId ?? activeDraftId) ?? orderedDrafts.at(-1) ?? null;
  const compareDraft = getDraftById(orderedDrafts, compareDraftId);

  return (
    <section className="card" style={{ marginBottom: 16 }}>
      <h2 style={{ marginTop: 0 }}>Script Draft Version History</h2>
      <p className="subtitle">
        Create multiple drafts, switch active draft, compare versions, and approve one to unlock scene planning.
      </p>

      {orderedDrafts.length === 0 ? (
        <p className="subtitle">No script drafts yet. Generate one above to start version history.</p>
      ) : (
        <>
          <div className="grid">
            {orderedDrafts.map((draft) => (
              <article key={draft.id} className="card">
                <h3 style={{ marginTop: 0 }}>
                  {draft.versionLabel}
                  {draft.id === activeDraftId ? " · Active" : ""}
                  {draft.id === approvedDraftId ? " · Approved" : ""}
                </h3>
                <p className="subtitle" style={{ marginTop: 0, marginBottom: 8 }}>
                  {new Date(draft.createdAt).toLocaleString()} · Status: {draft.approvalStatus}
                </p>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <Link href={`/projects/${projectId}?draftId=${draft.id}`} className="card">
                    Open
                  </Link>
                  {selectedDraft && draft.id !== selectedDraft.id ? (
                    <Link href={`/projects/${projectId}?draftId=${selectedDraft.id}&compareDraftId=${draft.id}`} className="card">
                      Compare with selected
                    </Link>
                  ) : null}
                  <form action={setActiveScriptDraftAction}>
                    <input type="hidden" name="projectId" value={projectId} />
                    <input type="hidden" name="scriptDraftId" value={draft.id} />
                    <button type="submit" className="card" style={{ cursor: "pointer" }}>
                      Make Active (Revert)
                    </button>
                  </form>
                  <form action={approveScriptDraftAction}>
                    <input type="hidden" name="projectId" value={projectId} />
                    <input type="hidden" name="scriptDraftId" value={draft.id} />
                    <button type="submit" className="card" style={{ cursor: "pointer" }}>
                      Approve Draft
                    </button>
                  </form>
                </div>
              </article>
            ))}
          </div>

          {selectedDraft ? (
            <section className="card" style={{ marginTop: 16 }}>
              <h3 style={{ marginTop: 0 }}>Selected Draft: {selectedDraft.versionLabel}</h3>
              <p className="subtitle">
                Status: {selectedDraft.approvalStatus} · Generated: {new Date(selectedDraft.createdAt).toLocaleString()}
              </p>
              {selectedDraft.notes ? <p className="subtitle">Notes: {selectedDraft.notes}</p> : null}
              <h4>Hook</h4>
              <p>{selectedDraft.hook}</p>
              <h4>Title options ({selectedDraft.titleOptions.length})</h4>
              <ul>
                {selectedDraft.titleOptions.map((title) => (
                  <li key={title}>{title}</li>
                ))}
              </ul>
            </section>
          ) : null}

          {selectedDraft && compareDraft ? (
            <section className="card" style={{ marginTop: 16 }}>
              <h3 style={{ marginTop: 0 }}>
                Compare {selectedDraft.versionLabel} vs {compareDraft.versionLabel}
              </h3>
              <p className="subtitle">
                Hook changed: {selectedDraft.hook === compareDraft.hook ? "No" : "Yes"} · Title count:{" "}
                {selectedDraft.titleOptions.length} vs {compareDraft.titleOptions.length}
              </p>
              <div className="grid grid-2">
                <article className="card">
                  <h4 style={{ marginTop: 0 }}>{selectedDraft.versionLabel}</h4>
                  <p>{selectedDraft.hook}</p>
                </article>
                <article className="card">
                  <h4 style={{ marginTop: 0 }}>{compareDraft.versionLabel}</h4>
                  <p>{compareDraft.hook}</p>
                </article>
              </div>
            </section>
          ) : null}
        </>
      )}
    </section>
  );
}
