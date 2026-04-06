# Architecture

## Architecture goals
- Quality-first generation pipeline for 5 to 20 minute YouTube slideshow videos
- Mandatory human review gates before critical stage transitions
- Modular services that allow model/provider swaps without rewriting product flow
- Strong observability for quality, latency, and cost KPIs
- First-class draft/version history support across major artifacts

## Suggested stack (v1)
- Frontend: Next.js + TypeScript
- Backend: Next.js route handlers/server actions (TypeScript)
- Database: Postgres (or Supabase Postgres)
- Storage: Object storage for images/audio/renders
- Rendering: Remotion (1080p/30fps pipeline)
- Queue/workers: background jobs for generation and rendering

## Core modules
1. Project management
2. Input normalization and validation
3. Story engine (title/hook/script)
4. Scene planner (scene split + timing)
5. Image pipeline (prompting + still image candidates + selection)
6. Voice pipeline (TTS + pronunciation + per-section regeneration)
7. Caption/timing pipeline
8. Timeline assembler (motion, transitions, audio mix)
9. Review/approval workflow engine
10. Draft/version history manager
11. Thumbnail ideation module (text + image prompt generation)
12. Render/export pipeline
13. Safety/compliance checks
14. Metrics and cost tracking

## Data model (v1)
### Project
- id
- createdAt / updatedAt
- ownerId (single-user assumption now, but explicit field for forward compatibility)
- status
- targetRuntimeMin (5 to 20)
- outputPreset (default 1080p30)
- styleProfileId
- audienceProfile (default faceless YouTube story audience)
- defaultTone (cinematic/suspenseful/serious/emotionally clear)
- targetImagesPerMinuteMin (default 6)
- targetImagesPerMinuteMax (default 10)

### StoryInput
- projectId
- ideaSentence
- theme
- premise
- tone
- plotBeats (optional)

### ScriptDraft
- projectId
- version
- titleOptions
- hook
- fullScript
- approvalStatus

### ScenePlan
- projectId
- version
- scenes[] (scene index, text range, duration target, visual intent)
- approvalStatus

### SceneImage
- projectId
- sceneId
- prompt
- candidates[]
- selectedImage
- styleOverride (optional)
- referenceImage (optional)
- imagePacingHint
- approvalStatus

### VoiceTrack
- projectId
- voiceProvider
- voiceId
- speed
- style
- pronunciationOverrides
- audioAsset
- approvalStatus

### CaptionTrack
- projectId
- language (en for v1)
- captionItems[]
- burnInDefault (true)

### TimelineDraft
- projectId
- sceneTiming
- transitions
- motionPresetByScene
- audioMix (narration/music/sfx)
- approvalStatus

### ThumbnailDraft
- projectId
- version
- thumbnailPrompt
- thumbnailTextIdeas[]
- thumbnailImagePrompts[] (generated from thumbnailPrompt)

### DraftVersion
- projectId
- versionId
- stage
- artifactType
- artifactRef
- createdAt
- createdBy
- notes

### RenderJob
- projectId
- preset (1080p30 mp4)
- state
- startedAt / finishedAt
- outputAsset
- totalCostEstimate

## Workflow/state machine (required approvals)
Pipeline state transitions should enforce approval gates:
1. `script_draft_generated` -> requires `script_approved`
2. `scene_plan_generated` -> requires `scene_plan_approved`
3. `images_generated` -> requires `images_approved`
4. `voice_generated` -> requires `voice_approved`
5. `timeline_draft_generated` -> requires `timeline_approved`
6. `timeline_approved` -> allow `render_started`

No stage should auto-advance past these gates in v1.

## Quality defaults to encode
- Tone default: cinematic, suspenseful, serious, emotionally clear
- Narration default: natural, immersive, non-robotic
- Visual default: cinematic interpretation over literal sentence-by-sentence depiction
- Image pacing: auto-controlled at default 6 to 10 images/minute with scene-level pacing adjustment

## Provider strategy (v1)
- Script/image/caption generation providers should be abstracted behind service interfaces
- TTS: one provider at launch, 3 to 5 voices exposed in product
- Avoid tight coupling so providers can be replaced later for cost/quality reasons

## Safety and policy layer
Add pre-generation and pre-export checks for:
- Disallowed content categories
- Obvious monetization/safety risks
- Unsupported requests (e.g., explicit sexual content, graphic gore, extremist/hate content)

When blocked, return clear user-facing reasons and safe alternatives.

## Performance and cost instrumentation
Track at project and stage level:
- Stage duration
- End-to-end draft completion time
- Render time
- Cost estimate per stage and per project
- Retry/regeneration counts
- Version churn (number of draft revisions before export)

Use these metrics to monitor targets:
- 10-min draft in 60 to 120 minutes
- 20-min draft in 2 to 4 hours
- hard cap under 8 hours
- first draft with ~80% to 90% usability

## API and UI expectations (v1)
- Async job APIs for long-running generation and rendering
- Polling or server-push status updates
- Deterministic versioning for script/scene/voice/image/timeline artifacts
- Fine-grained regenerate actions (scene, section, track) without full pipeline restart
- Auto-saved version history with view/compare/revert flows

## Out of scope (v1)
- Team collaboration
- Voice cloning
- Multi-language caption generation
- Vertical/square render presets
- Full professional timeline editing suite
- Advanced thumbnail image editing tools
