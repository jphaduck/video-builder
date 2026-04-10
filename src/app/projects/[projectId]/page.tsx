import { notFound } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { AssetPanel } from "@/components/asset-panel";
import { CaptionPanel } from "@/components/caption-panel";
import { NarrationPanel } from "@/components/narration-panel";
import { ProjectShell } from "@/components/project-shell";
import { RenderPanel } from "@/components/render-panel";
import { ScenePlanningPanel } from "@/components/scene-planning-panel";
import { ScriptDraftEditor } from "@/components/script-draft-editor";
import { ScriptDraftHistory } from "@/components/script-draft-history";
import { TimelinePanel } from "@/components/timeline-panel";
import { getAssetCandidatesForProject } from "@/modules/assets/repository";
import { markCaptionTrackStale } from "@/modules/captions/service";
import { getCaptionTrack } from "@/modules/captions/repository";
import { getNarrationTrack } from "@/modules/narration/repository";
import { getLatestJobForProject } from "@/modules/rendering/queue";
import { countWords } from "@/modules/scripts/draft-utils";
import { getProjectById } from "@/modules/projects/repository";
import { getScenesForProject } from "@/modules/scenes/repository";
import { generateStoryForProjectAction } from "@/modules/scripts/actions";
import { getTimelineDraftForProject } from "@/modules/timeline/service";
import type { ProjectStatus } from "@/types/project";

const SCENE_PLAN_APPROVED_STATUSES = new Set<ProjectStatus>([
  "scene_ready",
  "narration_pending",
  "images_ready",
  "voice_ready",
  "timeline_ready",
  "rendered",
]);

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

  const selectedDraft =
    project.scriptDrafts.find((draft) => draft.id === (draftId ?? project.activeScriptDraftId)) ??
    project.scriptDrafts.at(-1) ??
    null;
  const hasApprovedDraft = Boolean(project.approvedScriptDraftId);
  const scenes = await getScenesForProject(project.id);
  const assets = await getAssetCandidatesForProject(project.id);
  const isScenePlanApproved =
    SCENE_PLAN_APPROVED_STATUSES.has(project.status) &&
    project.workflow.sceneIds.length > 0 &&
    scenes.length === project.workflow.sceneIds.length &&
    scenes.every((scene) => scene.approvalStatus === "approved");
  const isImagePlanApproved = Boolean(project.workflow.imagePlanApprovedAt);
  const activeNarrationTrackId = project.workflow.narrationTrackIds.at(-1);
  const activeCaptionTrackId = project.workflow.captionTrackIds.at(-1);
  const narrationTrack = activeNarrationTrackId ? await getNarrationTrack(activeNarrationTrackId) : null;
  let captionTrack = activeCaptionTrackId ? await getCaptionTrack(activeCaptionTrackId) : null;
  const timelineDraft = await getTimelineDraftForProject(project.id);
  const latestRenderJob = await getLatestJobForProject(project.id);

  if (
    captionTrack &&
    narrationTrack &&
    captionTrack.narrationTrackId !== narrationTrack.id &&
    !captionTrack.isStale
  ) {
    await markCaptionTrackStale(captionTrack.id);
    captionTrack = {
      ...captionTrack,
      isStale: true,
    };
  }

  const canBuildTimeline =
    narrationTrack?.approvalStatus === "approved" && Boolean(captionTrack) && captionTrack?.isStale === false;

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
        <h2 style={{ marginTop: 0 }}>Story Engine (Phase 3)</h2>
        <p className="subtitle" style={{ marginTop: 0 }}>
          Generate new script versions, review them side by side, and approve exactly one before scene planning.
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

      {selectedDraft ? (
        <section className="card" style={{ marginBottom: 16 }}>
          <h2 style={{ marginTop: 0 }}>Script Draft Workspace</h2>
          <p className="subtitle">
            Draft ID: {selectedDraft.id} · Version: {selectedDraft.versionLabel}
            {selectedDraft.id === project.activeScriptDraftId ? " · Active" : ""}
            {selectedDraft.id === project.approvedScriptDraftId ? " · Approved" : ""}
            {" · "}
            {selectedDraft.source === "manual_edit" ? "Manual edit" : "Generated"} · Created:{" "}
            {new Date(selectedDraft.createdAt).toLocaleString()}
          </p>
          <p className="subtitle">
            Status: {selectedDraft.approvalStatus} · Word count: {countWords(selectedDraft.fullNarrationDraft)} · Scene
            outline items: {selectedDraft.sceneOutline.length}
          </p>

          <h3>Title options</h3>
          <ul>
            {selectedDraft.titleOptions.map((title) => (
              <li key={title}>{title}</li>
            ))}
          </ul>

          <h3>Hook</h3>
          <p>{selectedDraft.hook}</p>

          <h3>Full narration draft</h3>
          <pre className="card" style={{ whiteSpace: "pre-wrap", margin: 0 }}>
            {selectedDraft.fullNarrationDraft}
          </pre>

          <h3>Scene-by-scene outline</h3>
          <ol>
            {selectedDraft.sceneOutline.map((scene) => (
              <li key={scene.sceneNumber} style={{ marginBottom: 8 }}>
                <strong>{scene.heading}</strong>
                <p className="subtitle" style={{ margin: "4px 0 0" }}>
                  {scene.summary}
                </p>
              </li>
            ))}
          </ol>

          <ScriptDraftEditor projectId={project.id} draft={selectedDraft} />
        </section>
      ) : (
        <section className="card" style={{ marginBottom: 16 }}>
          <h2 style={{ marginTop: 0 }}>Script Draft Workspace</h2>
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

      <ScenePlanningPanel
        projectId={project.id}
        isScenePlanApproved={isScenePlanApproved}
        hasApprovedScript={hasApprovedDraft}
        initialScenes={scenes}
      />

      <AssetPanel
        projectId={project.id}
        projectStatus={project.status}
        isScenePlanApproved={isScenePlanApproved}
        isImagePlanApproved={isImagePlanApproved}
        scenes={scenes}
        initialAssets={assets}
      />

      <NarrationPanel
        projectId={project.id}
        projectStatus={project.status}
        isScenePlanApproved={isScenePlanApproved}
        sceneCount={scenes.length}
        scenes={scenes}
        initialNarrationTrack={narrationTrack}
      />

      <CaptionPanel
        projectId={project.id}
        initialNarrationTrack={narrationTrack}
        initialCaptionTrack={captionTrack}
      />

      <TimelinePanel
        project={project}
        initialTimelineDraft={timelineDraft}
        canBuildTimeline={canBuildTimeline}
      />

      {timelineDraft ? (
        <RenderPanel
          projectId={project.id}
          initialRenderJob={latestRenderJob}
          initialMusicTrack={project.musicTrack ?? "subtle"}
        />
      ) : null}

      <ProjectShell
        isScriptApproved={hasApprovedDraft}
        isScenePlanApproved={isScenePlanApproved}
        isTimelineReady={project.status === "timeline_ready" || project.status === "rendered"}
      />
    </main>
  );
}
