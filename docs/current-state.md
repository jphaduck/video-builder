# Current State

Current phase:
Phase 6 still-image generation and asset approval is complete. Timeline assembly and final rendering are the next major milestones.

What exists:
- repo created
- GitHub connected to ChatGPT
- implementation-ready planning docs
- Next.js + TypeScript app scaffold with App Router
- persistent local project storage using per-project JSON files in `data/projects/{projectId}.json`
- working project flows:
  - create project from `/projects/new`
  - list saved projects at `/projects`
  - load project detail at `/projects/[projectId]`
- script workflow for saved projects:
  - structured story input fields on project detail page (theme, premise, plot notes, target runtime, tone)
  - modular script service for story draft generation
  - persisted script draft versions per project with prompt metadata (`promptId`, prompt version, model, temperature)
  - draft comparison and active-draft switching
  - manual script editing that saves as a new version
  - explicit approve/reject gate before scene planning unlocks
- scene planning workflow for approved scripts:
  - persistent per-scene records stored in `data/scenes/{sceneId}.json`
  - AI-generated scene plan with duration targets, visual intent, image prompts, and per-scene prompt metadata
  - inline scene editing with per-scene save, regenerate, image-prompt regenerate, and full-plan regenerate actions
  - individual scene approve/reject controls
  - scene-plan invalidation deletes scene, asset, narration, and caption artifacts before clearing workflow references
- still-image asset workflow for approved scene plans:
  - persistent asset candidate metadata stored in `data/assets/{assetId}.json`
  - generated image files stored on disk in `data/assets/{assetId}.png`
  - OpenAI still-image generation from each approved scene's `imagePrompt`
  - multiple image candidates per scene with single-selection review controls
  - per-scene selected-image approve/reject controls and project-level image-plan approval
  - image file route for browser thumbnails via `/api/assets/[assetId]`
  - image plan reaches `images_ready` only when every approved scene has one selected and approved image
  - regenerating or re-selecting images invalidates downstream timeline/render artifacts without touching scenes, narration, or captions
- narration workflow for approved scene plans:
  - per-scene narration generation using OpenAI TTS (`tts-1-hd`)
  - one MP3 file per scene stored on disk in `data/narration/{trackId}/scene-{sceneNumber}.mp3`
  - narration track metadata stored in `data/narration/{trackId}/track.json`
  - MP3 duration measurement stored as `measuredDurationSeconds` per scene and used for timeline/caption offset math
  - hardened narration playback route with UUID/integer validation, async streaming, and 400/404 handling
  - review UI with voice selection, speed control, pronunciation overrides, per-scene audio playback, approve/reject, and full-track regeneration
- captions workflow for approved narration tracks:
  - caption generation from narration audio via Whisper word timestamps
  - caption chunking into readable segments with cumulative offsets based on measured narration durations
  - caption tracks stored in `data/captions/{captionTrackId}.json`
  - SRT and VTT subtitle exports written to `data/captions/{captionTrackId}.srt` and `.vtt`
  - inline caption text and timing edits that regenerate the export sidecars
  - stale-caption detection when the latest caption track no longer matches the latest narration track
- next-stage scaffolding:
  - file-backed timeline draft module in `src/modules/timeline`
  - file-backed rendering job module in `src/modules/rendering`
- foundational developer tooling:
  - `.env.example` documents current and future-facing AI provider variables
  - MIT license committed
  - Vitest smoke/service tests and GitHub Actions CI using `npm run validate`

What does not exist yet:
- final timeline editor UI
- Remotion render/export implementation
- background jobs/queueing
- database-backed persistence

Current priority:
Promote approved scenes, selected still images, narration, and captions into a human-reviewable timeline draft and render job flow.

Next 3 tasks:
1. build a timeline draft from approved scenes, selected still images, narration, and captions
2. add timeline review/edit controls before final rendering
3. build the Remotion render stage and persist render jobs/artifacts

Files to read first next session:
- AGENTS.md
- docs/product-spec.md
- docs/architecture.md
- docs/roadmap.md
- docs/style-guide.md
- docs/decisions.md
- docs/current-state.md

Notes:
This project is for YouTube slideshow-style story videos with still images, not full animation.
Human review remains mandatory before final export.
