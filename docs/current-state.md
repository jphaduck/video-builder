# Current State

Current phase:
All 6 roadmap milestones are complete. The next phase is production hardening: storage, auth, UI polish, stronger error handling, and better runtime ergonomics.

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
  - delete a project from `/projects`, including cleanup of its persisted derived artifacts
- script workflow for saved projects:
  - structured story input fields on project detail page (theme, premise, plot notes, target runtime, tone)
  - modular script service for story draft generation
  - script generation now runs in two stages: a 12-20 beat structural outline first, then full narration from that outline
  - beat outlines now fail clearly when the model returns no parseable numbered beats or fewer than 8 usable beats
  - stage 2 user prompts explicitly require one paragraph per beat minimum and prevent skipping beats from the outline
  - retry path now preserves the first failed draft, feeds it back as context, and asks the model to expand the middle and ending instead of regenerating a new draft from scratch
  - retry expansion now requires at least 2 new middle paragraphs and 1 new ending paragraph tied to specific beats from the structural outline, so short retries add concrete new material instead of broadly restating the draft
  - the expansion retry now puts extra emphasis on bureaucratic and low-motion stories by treating paperwork, waiting, compliance pressure, isolation, and institutional language as real story beats instead of background exposition
  - script generation now targets a minimum of 650 words and 8 paragraphs for 5-minute drafts, with higher runtime requests scaling by `Math.max(8, ceil(runtimeMinutes * 1.2))`
  - stage 2 prompts now explicitly say the word target is a floor, not a stopping point, so drafts should keep expanding past the minimum when the middle or ending still feels thin
  - expected script-generation improvement target is roughly 650-900 words for 5-minute drafts instead of the earlier 420-510 word range seen in live evaluations
  - script validation now enforces minimum word count, minimum paragraph count, title quality checks, second-person voice, and anti-echo protection before a draft is accepted
  - story titles and hooks now explicitly push for story-specific distinctiveness, plot-event anchoring, and more concrete, less generic office-bound opening moments
  - draft scene outlines now derive short, title-cased headings from each paragraph's first sentence and strip trailing orphaned prepositions/articles instead of using generic "Scene N" labels
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
  - OpenAI DALL-E 3 still-image generation from each approved scene's `imagePrompt`, prefixed for cinematic no-text / no-face framing
  - image downloads are saved locally on disk instead of relying on expiring provider CDN URLs
  - 2 locally persisted image candidates per scene with single-selection review controls
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
- timeline workflow:
  - file-backed timeline drafts stored in `data/timeline/{projectId}.json`
  - timeline assembly from the latest saved scenes, still-image assets, approved narration track, and current caption track
  - timeline build/rebuild action plus `GET` / `POST` route at `/api/projects/[projectId]/timeline`
  - read-only timeline review panel on the project detail page with scene heading, thumbnail/placeholder, narration duration, caption preview, and cumulative start offset
  - timeline build is gated on approved narration plus a current non-stale caption track
  - building a timeline draft moves the project to `timeline_ready`
- rendering workflow:
  - file-backed render job metadata stored in `data/rendering/{renderJobId}.json`
  - temp render artifacts stored in `data/rendering/`, including merged narration audio and burned-caption `.srt`
  - final MP4 exports written to `data/renders/{projectId}.mp4`
  - FFmpeg-based slideshow rendering that holds each scene still for its narration duration, merges per-scene narration into one audio track, and burns captions directly into the video
  - Sharp-generated 1920x1080 placeholder images when no approved still exists for a scene
  - async render start/status route at `/api/projects/[projectId]/render`
  - SSE progress route at `/api/projects/[projectId]/render/progress` for live render status and stage messages
  - browser video streaming route at `/api/projects/[projectId]/render/stream`
  - render output streaming and render-job cleanup now ignore persisted output paths outside `data/renders`, preventing poisoned metadata from reading or deleting arbitrary repo files
  - render panel on the project detail page with live SSE status updates, stage progress messaging, HTML5 playback, and download link
  - successful renders promote the project to `rendered`
- review UX hardening:
  - scene, image, narration, caption, timeline, and render panels now surface explicit empty states, visible error banners, and action-specific loading text instead of relying on silent disabled controls
  - timeline review now warns when a saved draft may be out of date relative to the latest approved content
  - render start now honors the standardized `{ data }` API envelope, and the render panel surfaces explicit start/progress stream failures instead of silently treating successful starts as errors or stalling on disconnects
- API route hardening:
  - JSON API routes now consistently return `{ data: ... }` on success and `{ error: string }` on failure
  - project-scoped routes now require UUID-format `projectId` params before doing work, closing traversal into other `data/*.json` files while still returning clean `400` / `404` / generic `500` responses
  - stream and SSE routes keep binary/event-stream success responses but now return clean JSON error payloads when validation or repository lookups fail
- foundational developer tooling:
  - `.env.example` documents current and future-facing AI provider variables
  - MIT license committed
  - Vitest smoke/service tests and GitHub Actions CI using `npm run validate`
  - Next.js build tracing is pinned to the repository root so production builds do not infer `/Users/jp` from a parent lockfile in the Codex workspace
  - focused repository/service coverage now exercises high-risk project deletion cleanup, scene file persistence/order/error paths, render-job file persistence/cleanup, and timeline draft assembly/error paths
  - reusable live script evaluation harness under `npm run eval:scripts`, with JSON reports that now calculate `passRate` from passed rows in `results`, `retryRate` from retry-triggered rows, and `retrySuccessRate` from successful retries
  - git now ignores generated artifacts across all `data/` workflow directories while tracking `.gitkeep` placeholders so the local folder structure remains intact

What does not exist yet:
- editable timeline controls
- background jobs/queueing
- production storage/database backend
- user authentication
- music/background audio layer in the render pipeline
- broader UI polish and error-handling improvements

Current priority:
Polish the now-complete pipeline for production use, starting with storage/auth foundations, better review UX, and more production-ready rendering ergonomics.

Next 3 tasks:
1. replace local file persistence with a production storage backend
2. add authentication and per-user project ownership
3. improve UI polish, real-time render progress, and failure recovery

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
