import { notFound } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { ProjectShell } from "@/components/project-shell";
import { ScriptDraftHistory } from "@/components/script-draft-history";
import { getProjectById } from "@/modules/projects/repository";
import { generateStoryForProjectAction } from "@/modules/scripts/actions";

type ProjectPageProps = {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ draftId?: string; compareDraftId?: string }>;
};

export default async function ProjectDetailPage({ params, searchParams }: ProjectPageProps) {
  noStore();
  const { projectId } = await params;
  const { draftId, compareDraftId } = await searchParams;
  const project = await getProjectById(projectId);

  if (!project) {
    notFound();
  }

  const activeDraft = project.scriptDrafts.find((draft) => draft.id === project.activeScriptDraftId) ?? null;
  const hasApprovedDraft = Boolean(project.approvedScriptDraftId);

  return (
    <main className="container">
      <h1>{project.name}</h1>
      <p className="subtitle" style={{ marginBottom: 6 }}>
        Project ID: {project.id}
      </p>
      <p className="subtitle" style={{ marginBottom: 6 }}>
        Status: {project.status}
      </p>
      <p className="subtitle" style={{ marginBottom: 16 }}>
        Premise: {project.storyInput.premise}
      </p>

      <section className="card" style={{ marginBottom: 16 }}>
        <h2 style={{ marginTop: 0 }}>Story Engine (Milestone 2)</h2>
        <p className="subtitle" style={{ marginTop: 0 }}>
          Generate and save a new script draft version for this project.
        </p>
        <form action={generateStoryForProjectAction} className="grid">
          <input type="hidden" name="projectId" value={project.id} />
          <input type="hidden" name="projectName" value={project.name} />

          <label>
            <strong>Theme</strong>
            <input
              name="theme"
              defaultValue={project.storyInput.theme ?? ""}
              placeholder="Mystery, crime, social commentary..."
              style={{ width: "100%", marginTop: 8 }}
            />
          </label>

          <label>
            <strong>Premise</strong>
            <textarea
              name="premise"
              defaultValue={project.storyInput.premise}
              required
              rows={3}
              style={{ width: "100%", marginTop: 8 }}
            />
          </label>

          <label>
            <strong>Plot notes</strong>
            <textarea
              name="plotNotes"
              defaultValue={project.storyInput.plotNotes ?? ""}
              placeholder="Optional beats separated by new lines or commas"
              rows={4}
              style={{ width: "100%", marginTop: 8 }}
            />
          </label>

          <label>
            <strong>Target runtime (5 to 20 min)</strong>
            <input
              type="number"
              min={5}
              max={20}
              name="targetRuntimeMin"
              defaultValue={project.storyInput.targetRuntimeMin ?? 10}
              style={{ width: "100%", marginTop: 8 }}
            />
          </label>

          <label>
            <strong>Tone</strong>
            <input
              name="tone"
              defaultValue={project.storyInput.tone ?? ""}
              placeholder="Cinematic, suspenseful, serious..."
              style={{ width: "100%", marginTop: 8 }}
            />
          </label>

          <button type="submit" className="card" style={{ cursor: "pointer", width: 280 }}>
            Generate + Save New Draft Version
          </button>
        </form>
      </section>

      {activeDraft ? (
        <section className="card" style={{ marginBottom: 16 }}>
          <h2 style={{ marginTop: 0 }}>Active Script Draft</h2>
          <p className="subtitle">
            Draft ID: {activeDraft.id} · Version: {activeDraft.versionLabel} · Generated:{" "}
            {new Date(activeDraft.createdAt).toLocaleString()}
          </p>

          <h3>Title options</h3>
          <ul>
            {activeDraft.titleOptions.map((title) => (
              <li key={title}>{title}</li>
            ))}
          </ul>

          <h3>Hook</h3>
          <p>{activeDraft.hook}</p>

          <h3>Full narration draft</h3>
          <pre className="card" style={{ whiteSpace: "pre-wrap", margin: 0 }}>
            {activeDraft.fullNarrationDraft}
          </pre>

          <h3>Scene-by-scene outline</h3>
          <ol>
            {activeDraft.sceneOutline.map((scene) => (
              <li key={scene.sceneNumber} style={{ marginBottom: 8 }}>
                <strong>{scene.heading}</strong>
                <p className="subtitle" style={{ margin: "4px 0 0" }}>
                  {scene.summary}
                </p>
              </li>
            ))}
          </ol>
        </section>
      ) : (
        <section className="card" style={{ marginBottom: 16 }}>
          <h2 style={{ marginTop: 0 }}>Active Script Draft</h2>
          <p className="subtitle">No story draft yet. Use the form above to generate and save one.</p>
        </section>
      )}

      <ScriptDraftHistory
        projectId={project.id}
        scriptDrafts={project.scriptDrafts}
        activeDraftId={project.activeScriptDraftId}
        approvedDraftId={project.approvedScriptDraftId}
        selectedDraftId={draftId}
        compareDraftId={compareDraftId}
      />

      <section className="card" style={{ marginBottom: 16 }}>
        <h2 style={{ marginTop: 0 }}>Scene Planning Gate</h2>
        {hasApprovedDraft ? (
          <p className="subtitle">✅ Scene planning is unlocked because a script draft is approved.</p>
        ) : (
          <p className="subtitle">🔒 Scene planning is locked. Approve one script draft to continue.</p>
        )}
      </section>

      <ProjectShell isScriptApproved={hasApprovedDraft} />
    </main>
  );
}
