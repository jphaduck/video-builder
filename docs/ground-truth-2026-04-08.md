# Ground Truth Audit — 2026-04-08

This audit is based on the current source tree under `src/` and the on-disk persistence directories under `data/`. It does not rely on README claims or milestone notes except as things to compare against the actual implementation.

## Source map

### `src/` files

- `src/app/__tests__/page.test.tsx`
- `src/app/api/assets/[assetId]/route.ts`
- `src/app/api/narration/[trackId]/[sceneNumber]/route.test.ts`
- `src/app/api/narration/[trackId]/[sceneNumber]/route.ts`
- `src/app/api/projects/[projectId]/route.test.ts`
- `src/app/api/projects/[projectId]/route.ts`
- `src/app/globals.css`
- `src/app/layout.tsx`
- `src/app/page.tsx`
- `src/app/projects/[projectId]/page.tsx`
- `src/app/projects/new/page.tsx`
- `src/app/projects/page.tsx`
- `src/components/asset-panel.test.tsx`
- `src/components/asset-panel.tsx`
- `src/components/caption-panel.tsx`
- `src/components/narration-panel.tsx`
- `src/components/project-delete-button.tsx`
- `src/components/project-shell.tsx`
- `src/components/scene-planning-panel.tsx`
- `src/components/script-draft-editor.tsx`
- `src/components/script-draft-history.tsx`
- `src/components/section-card.tsx`
- `src/lib/ai.ts`
- `src/lib/mp3-duration.ts`
- `src/lib/projects.ts`
- `src/lib/prompts.ts`
- `src/lib/types/workflow.ts`
- `src/modules/assets/actions.ts`
- `src/modules/assets/index.ts`
- `src/modules/assets/repository.test.ts`
- `src/modules/assets/repository.ts`
- `src/modules/assets/service.test.ts`
- `src/modules/assets/service.ts`
- `src/modules/assets/types.ts`
- `src/modules/captions/actions.ts`
- `src/modules/captions/index.ts`
- `src/modules/captions/repository.ts`
- `src/modules/captions/service.test.ts`
- `src/modules/captions/service.ts`
- `src/modules/narration/actions.ts`
- `src/modules/narration/index.ts`
- `src/modules/narration/repository.ts`
- `src/modules/narration/service.test.ts`
- `src/modules/narration/service.ts`
- `src/modules/projects/actions.ts`
- `src/modules/projects/index.ts`
- `src/modules/projects/repository.ts`
- `src/modules/projects/types.ts`
- `src/modules/rendering/index.ts`
- `src/modules/rendering/repository.ts`
- `src/modules/rendering/service.ts`
- `src/modules/rendering/types.ts`
- `src/modules/scenes/actions.ts`
- `src/modules/scenes/index.ts`
- `src/modules/scenes/repository.ts`
- `src/modules/scenes/service.test.ts`
- `src/modules/scenes/service.ts`
- `src/modules/scripts/actions.ts`
- `src/modules/scripts/draft-utils.test.ts`
- `src/modules/scripts/draft-utils.ts`
- `src/modules/scripts/index.ts`
- `src/modules/scripts/service.test.ts`
- `src/modules/scripts/service.ts`
- `src/modules/scripts/types.ts`
- `src/modules/settings/index.ts`
- `src/modules/timeline/index.ts`
- `src/modules/timeline/repository.ts`
- `src/modules/timeline/service.ts`
- `src/modules/timeline/types.ts`
- `src/test/server-only.ts`
- `src/types/caption.ts`
- `src/types/narration.ts`
- `src/types/project.ts`
- `src/types/scene.ts`

### `data/` directories

- `data`
- `data/assets`
- `data/captions`
- `data/narration`
- `data/projects`
- `data/rendering`
- `data/scenes`
- `data/timeline`

## Module and component reality check

### `src/modules/`

- `assets`: Generates still-image candidates from approved scene prompts, persists metadata plus image files, and manages selection and approval state.
- `captions`: Transcribes approved narration with Whisper, stores caption tracks plus sidecar exports, and supports caption text and timing edits.
- `narration`: Generates per-scene narration audio with OpenAI TTS, stores track metadata and MP3 files, and supports regenerate/approve/reject flows.
- `projects`: Normalizes project records, manages workflow state transitions, persists script workflow metadata, and deletes projects plus derived artifacts.
- `rendering`: Persists render-job records and can create a pending render job, but does not perform real rendering.
- `scenes`: Generates, persists, edits, regenerates, and approves scene plans derived from an approved script draft.
- `scripts`: Builds beat outlines, generates full story drafts, validates them, supports retry expansion, and provides draft parsing helpers.
- `settings`: Only exports a module constant and does not implement a real settings system.
- `timeline`: Builds and stores a timeline draft from scenes, assets, narration, and captions, but is not wired into the UI.

### `src/components/`

- `asset-panel.tsx`: Client UI for per-scene still-image generation, candidate review, selection, approval, and project-level image-plan approval.
- `caption-panel.tsx`: Client UI for caption generation from approved narration and inline caption text/timing edits.
- `narration-panel.tsx`: Client UI for narration generation, playback, regeneration, and approval using saved narration tracks.
- `project-delete-button.tsx`: Confirms and deletes a project from the projects list page.
- `project-shell.tsx`: Displays high-level workflow cards describing script, scene, image, narration, caption, and render stages.
- `scene-planning-panel.tsx`: Client UI for generating scenes, editing scene fields, regenerating individual scenes or prompts, and approving the scene plan.
- `script-draft-editor.tsx`: Saves manual script edits as a new draft version instead of mutating an existing draft.
- `script-draft-history.tsx`: Shows version history, compare links, active-draft switching, and approve/reject controls for script drafts.
- `section-card.tsx`: Simple reusable card component used by the workflow shell.

## Milestone status from source

### Milestone 1 — Project persistence

Milestone 1 is genuinely complete. The storage layer is file-backed in `src/lib/projects.ts`, where each project is stored as JSON under `data/projects/{projectId}.json` with temp-file writes, a write queue, list/load/update helpers, and legacy migration support. Projects can be created from `/projects/new` via `src/modules/projects/actions.ts`, loaded and listed on `/projects` and `/projects/[projectId]`, and deleted through `src/app/api/projects/[projectId]/route.ts` plus `src/components/project-delete-button.tsx`. The repository layer in `src/modules/projects/repository.ts` also cleans up derived scene, asset, narration, caption, timeline, and render files before deleting the project record.

### Milestone 2 — Story engine

Milestone 2 is genuinely complete end to end. The project detail page at `src/app/projects/[projectId]/page.tsx` renders a real story generation form that posts to `generateStoryForProjectAction` in `src/modules/scripts/actions.ts`, which calls `generateStoryDraft()` in `src/modules/scripts/service.ts` and persists the result. The script service is not a placeholder: it runs a two-stage outline-then-script generation flow, validates word count, paragraph count, titles, hook shape, second-person voice, and anti-echo, and performs an expansion retry when needed. The UI shows real output including title options, hook, full narration draft, and scene outline, and draft history is real: `script-draft-history.tsx` and `script-draft-editor.tsx` provide version history, compare, active switching, manual edit-as-new-version, and approve/reject controls, all backed by repository logic.

### Milestone 3 — Scene and image planning

Milestone 3 is genuinely complete and already extends beyond simple prompt planning. `src/modules/scenes/service.ts` generates scene plans from the approved script, persists them via `src/modules/scenes/repository.ts`, and supports per-scene updates, regeneration, image-prompt regeneration, approval, rejection, and full scene-plan approval. The project detail page mounts `ScenePlanningPanel`, which exposes those controls in the UI. On top of that, `src/modules/assets/service.ts` implements a real still-image candidate workflow that generates image options for each approved scene, stores them under `data/assets`, and allows selection, per-scene approval/rejection, and project-level image-plan approval through `asset-panel.tsx`. This milestone is therefore complete both as scene planning and as still-image review.

### Milestone 4 — Voice and captions

Milestone 4 is genuinely complete end to end under the current naming, which uses `narration` rather than `voiceover`. `src/modules/narration/service.ts` generates per-scene narration MP3 files with OpenAI TTS, persists track metadata and files under `data/narration`, and supports regenerate, approve, and reject flows. `src/modules/captions/service.ts` consumes approved narration with `whisper-1`, creates structured caption segments and subtitle sidecars, and supports inline text and timing edits. The project detail page mounts both `NarrationPanel` and `CaptionPanel`, and the audio stream route at `src/app/api/narration/[trackId]/[sceneNumber]/route.ts` serves real audio to the browser. This is not scaffolded UI.

### Milestone 5 — Render pipeline

Milestone 5 is the first milestone that is not complete end to end. There is some real backend assembly code: `src/modules/timeline/service.ts` can build and persist a timeline draft from the latest scenes, assets, narration, and captions, and `src/modules/rendering/service.ts` can create a pending render-job record. However, there is no timeline review/edit UI, no route or page that exposes the timeline draft to the user, no render controls on the project detail page, and no actual video renderer or export pipeline. The render milestone is therefore only partially scaffolded at the module layer and is not wired to a user-facing workflow.

## Last complete milestone and real next milestone

The last fully complete milestone is Milestone 4, voice and captions. The real next milestone is Milestone 5, specifically turning the existing timeline and render-job scaffolds into a real timeline review/edit flow and a true render/export pipeline.

## Modules that exist but are not wired to the UI

- `src/modules/timeline/*` exists and can build/store a timeline draft, but nothing in `src/app/` or `src/components/` renders or edits that draft.
- `src/modules/rendering/*` exists and can create render-job records, but there is no user-facing UI or real renderer behind it.
- `src/modules/settings/index.ts` exists only as a placeholder constant export and has no UI or service behavior attached to it.

## UI sections that exist but are not wired to a real service

There are no major workflow sections for scripts, scenes, assets, narration, or captions that are purely placeholder UI. Those sections are backed by real services. The closest thing to a placeholder is `ProjectShell`, which describes the workflow stages in card form but does not itself drive any workflow logic. The render stage appears there as descriptive UI only because the real timeline/render flow is not yet exposed anywhere else.
