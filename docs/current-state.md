# Current State

Current phase:
Phase 5 narration and captions is complete. Image generation and the final render/timeline pipeline are the next major milestones.

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
  - persisted script draft versions per project including:
    - title options
    - hook
    - full narration draft
    - scene-by-scene outline
    - generation source metadata
  - draft comparison and active-draft switching
  - manual script editing that saves as a new version
  - explicit approve/reject gate before scene planning unlocks
- scene planning workflow for approved scripts:
  - persistent per-scene records stored in `data/scenes/{sceneId}.json`
  - AI-generated scene plan with scene summaries, script excerpts, duration targets, visual intent, and image prompts
  - inline scene editing with per-scene save, regenerate, image-prompt regenerate, and full-plan regenerate actions
  - individual scene approve/reject controls
  - full scene-plan approval gate before narration unlocks
  - hardened scene-plan parsing that tolerates JSON code fences and partial scene objects with warnings/defaults instead of failing immediately
  - scene-plan invalidation deletes scene files and clears downstream narration/caption references
- narration workflow for approved scene plans:
  - per-scene narration generation using OpenAI TTS (`tts-1-hd`)
  - one MP3 file per scene stored on disk in `data/narration/{trackId}/scene-{sceneNumber}.mp3`
  - narration track metadata stored in `data/narration/{trackId}/track.json`
  - review UI with voice selection, speed control, pronunciation overrides, per-scene audio playback, approve/reject, and full-track regeneration
  - project status moves to `narration_pending` while a narration track is under review and to `voice_ready` once approved
- captions workflow for approved narration tracks:
  - caption generation from narration audio via Whisper word timestamps
  - caption tracks stored in `data/captions/{captionTrackId}.json`
  - caption chunking into readable segments with start/end timing
  - inline caption text and timing edits that mark segments as edited
  - stale-caption detection when the latest caption track no longer matches the latest narration track
- foundational developer tooling:
  - `.env.example` documents expected AI provider environment variables
  - Vitest + Testing Library smoke and service tests
  - GitHub Actions CI running lint, build, and tests on `main`

What does not exist yet:
- database implementation
- image generation and asset review implementation
- final timeline composition
- Remotion render pipeline implementation
- background jobs/queueing

Current priority:
Implement image generation and asset review, then wire the approved assets plus approved narration/captions into the render pipeline.

Next 3 tasks:
1. generate still-image candidates from approved scene prompts
2. add per-scene image selection and approval before timeline assembly
3. build the Remotion timeline/render stage from approved scenes, assets, narration, and captions

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
