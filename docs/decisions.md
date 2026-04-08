# Decisions

## 2026-04-05 - Primary v1 user is solo faceless YouTube operator
- Decision: Optimize v1 UX and workflow for one creator producing videos regularly.
- Why: Keeps scope tight and aligned with highest-value use case.
- Impact: No team collaboration workflows in v1.

## 2026-04-05 - End-viewer profile set for faceless story audiences
- Decision: Target viewer taste profile is suspense, mystery, crime, irony, and dramatic storytelling.
- Why: Helps tune script, narration, and visual defaults toward a clear content lane.
- Impact: Prompting/style defaults should align to this audience profile.

## 2026-04-05 - Mandatory human approval gates in generation pipeline
- Decision: Require explicit approval at script, scene plan, image, voice, and final timeline stages.
- Why: Quality-first product direction and human-in-the-loop control before export.
- Impact: Pipeline state machine must block stage progression until approvals are recorded.

## 2026-04-05 - V1 output preset fixed to YouTube landscape 1080p30 MP4
- Decision: Standardize export on 1920x1080 at 30 fps for launch.
- Why: Reduce rendering complexity and fit primary YouTube long-form publish flow.
- Impact: Vertical/square outputs deferred to post-v1.

## 2026-04-05 - Tone, narration, and visual defaults formalized
- Decision: Default output tone is cinematic/suspenseful/serious/emotionally clear; narration should feel immersive and natural; visuals should lean cinematic rather than purely literal.
- Why: Ensures consistent brand voice and avoids low-quality generic output.
- Impact: Prompt templates and generation settings need default style constraints.

## 2026-04-05 - Default image pacing set to 6 to 10 images per minute
- Decision: Use 6-10 images/minute baseline, with slower/faster scene-level adjustments.
- Why: Balances visual dynamism with readability and narrative pacing.
- Impact: Scene planner and timeline logic must support pacing heuristics.

## 2026-04-05 - One TTS provider at launch, voice cloning out of scope
- Decision: Ship one reliable TTS integration with 3 to 5 voice options and section-level regeneration.
- Why: Maximize reliability and reduce integration risk while preserving key user controls.
- Impact: Provider abstraction still required for future swap/expansion.

## 2026-04-05 - Copyright-safe audio policy
- Decision: Music/SFX sources must be safe for YouTube monetized usage.
- Why: Prevent downstream publishing risk for core creator persona.
- Impact: Audio sourcing and policy checks required before export.

## 2026-04-05 - V1 includes title generation and basic thumbnail support
- Decision: Include title generation plus thumbnail text ideas and thumbnail image prompts in v1.
- Why: Packaging support increases publish readiness without full thumbnail editor scope.
- Impact: Add packaging outputs to story/export flows; advanced thumbnail tooling deferred.

## 2026-04-05 - Multiple drafts and version history required in v1
- Decision: Projects must support saved versions, comparison, and revert.
- Why: Enables safe iteration and stronger human review workflows.
- Impact: Versioned artifact data model and UI actions are required in v1.

## 2026-04-05 - Quality and performance targets formalized
- Decision: Aim for ~80%-90% usable first draft and practical completion windows (10 min in 60-120 min, 20 min in 2-4 h, hard max <8 h).
- Why: Define concrete success thresholds for product and engineering prioritization.
- Impact: Instrumentation for quality, latency, and cost metrics is a v1 requirement.


## 2026-04-06 - Thumbnail prompts are the source for thumbnail outputs
- Decision: Thumbnail image prompt outputs must be generated from explicit thumbnail prompt input.
- Why: Keeps thumbnail ideation controllable and aligned to creator intent.
- Impact: Data model and pipeline must persist a thumbnail prompt artifact.

## 2026-04-06 - Pacing control defaults to auto
- Decision: Image pacing is auto-controlled by default (target 6-10 images/minute) with scene-level adjustments.
- Why: Reduces manual burden and keeps pacing adaptive to story flow.
- Impact: Scene planner/timeline should apply pacing heuristics automatically.

## 2026-04-06 - Version history is auto-saved
- Decision: Draft versions are auto-saved across major pipeline artifacts/stages.
- Why: Protects work-in-progress and makes iteration safer for solo creators.
- Impact: Persisted snapshots at stage boundaries are required.

## 2026-04-06 - Phase 2 scaffold uses Next.js App Router with typed module-first structure
- Decision: Scaffold v1 foundation using Next.js + TypeScript App Router under `src/app`, with dedicated module folders for projects, scripts, scenes, assets, narration, captions, rendering, and settings.
- Why: Keeps codebase modular and maintainable while aligning with documented architecture boundaries.
- Impact: Future feature work should attach logic to module boundaries instead of ad-hoc page-only code.

## 2026-04-06 - Milestone 1 persistence uses per-project JSON files behind a simple projects library
- Decision: Persist each project as `data/projects/{projectId}.json` and access project storage through `src/lib/projects.ts`.
- Why: Keeps early persistence local and dependency-free while avoiding a monolithic shared JSON file and preserving a clean seam for future database replacement.
- Impact: Higher-level project modules should depend on the library/repository interface rather than file layout details.

## 2026-04-06 - Milestone 2 story engine uses modular local generator service
- Decision: Implement story generation through a dedicated scripts service module that returns a structured story draft (title options, hook, narration draft, scene outline) and persist results on the project record.
- Why: Delivers Milestone 2 end-to-end behavior now while keeping provider-facing generation logic isolated for future model integrations.
- Impact: Future AI provider integrations can swap generation internals without rewriting project routes or persistence wiring.

## 2026-04-06 - Use Vitest and Testing Library for lightweight UI verification
- Decision: Add Vitest with Testing Library and Jest DOM for smoke-level UI tests.
- Why: Gives the project a fast, low-ceremony way to verify core rendering without introducing a heavy test harness.
- Impact: New UI work should add focused smoke or behavior tests where it improves confidence.

## 2026-04-06 - Run automated checks in GitHub Actions on main and pull requests
- Decision: Add a CI workflow that runs `npm ci`, `npm run lint`, `npm run build`, and `npm test` on push and pull request to `main`.
- Why: Protects the repo from basic regressions and keeps foundational checks consistent between local development and GitHub.
- Impact: Future changes should keep these commands green and update the workflow only when the canonical validation steps change.

## 2026-04-06 - Scene persistence uses per-scene JSON files during Milestone 4
- Decision: Persist each scene as `data/scenes/{sceneId}.json` and keep project workflow references in `project.workflow.sceneIds`.
- Why: Matches the existing local-file persistence strategy while keeping scene records independently addressable and easy to replace later.
- Impact: Scene services should treat the project workflow as the source of ordering and membership, while scene files remain the individual storage unit.

## 2026-04-06 - Scene edits and prompt changes reset approval to pending
- Decision: Any manual scene edit, scene regeneration, or image-prompt regeneration resets that scene's approval status back to `pending`.
- Why: A previously approved scene should not stay approved after its content changes.
- Impact: The UI and scene-plan approval flow must require a fresh human approval pass after scene content changes.

## 2026-04-06 - Approving a different script invalidates the current scene plan
- Decision: When a new script draft becomes the approved script, the project clears `workflow.sceneIds` and returns to the script-ready stage.
- Why: Scene plans are tied to a specific approved script draft and become stale when the approved script changes.
- Impact: Downstream scene work is invalidated by script approval changes, and new scenes must be generated from the newly approved script.

## 2026-04-06 - Clearing a scene plan must delete scene files before removing workflow references
- Decision: When a scene plan is cleared or regenerated, the system deletes each referenced `data/scenes/{sceneId}.json` file before it clears `workflow.sceneIds`.
- Why: Prevents orphaned scene JSON files from accumulating and keeps the on-disk scene store aligned with project workflow state.
- Impact: Scene-plan invalidation paths must treat file deletion as part of the clear operation, while missing files only emit warnings.

## 2026-04-06 - Scene generation parsing tolerates fenced JSON and partial scene objects
- Decision: Scene-plan parsing accepts JSON wrapped in markdown fences and fills missing scene fields with safe defaults while logging warnings.
- Why: Model responses are not always perfectly structured, and hard failure on every partial omission makes the scene workflow brittle.
- Impact: Scene-generation code should validate the response shape, warn on degraded output quality, and let the user review/regenerate instead of crashing immediately.

## 2026-04-06 - Narration is generated per approved scene and stored as per-scene MP3 files
- Decision: Generate narration from each approved scene's `scriptExcerpt` instead of synthesizing the full script in one pass, and store audio files in `data/narration/{trackId}/scene-{sceneNumber}.mp3` with a companion `track.json`.
- Why: OpenAI TTS input size is too small for full 5-20 minute scripts, and per-scene audio aligns directly with the later slideshow/timeline render model.
- Impact: Narration review, regeneration, and playback all operate at the track level while audio storage remains file-based instead of JSON-embedded.

## 2026-04-06 - Caption tracks become stale when the latest narration track changes
- Decision: Treat the last ID in `project.workflow.narrationTrackIds` and `project.workflow.captionTrackIds` as the active track for UI purposes, and mark the latest caption track stale when its `narrationTrackId` no longer matches the latest narration track.
- Why: The current project type already stores workflow track histories but does not have dedicated active-track fields, and adding new project fields was not necessary for Milestone 5.
- Impact: Page loads and narration regeneration paths must compare the latest workflow IDs, preserve older caption history, and surface a warning when captions no longer match the current narration audio.

## 2026-04-07 - Prompt specs are centralized and versioned
- Decision: Move LLM prompts into `src/lib/prompts.ts` and persist `{ promptId, promptVersion, model, temperature }` on generated script drafts and scenes.
- Why: Prompt text and inference settings are now part of the artifact provenance, which makes future prompt iteration safer and more traceable.
- Impact: Generated artifacts must record prompt metadata, and prompt changes should increment the prompt version instead of silently replacing inline strings.

## 2026-04-07 - Caption timelines use measured narration durations as scene offsets
- Decision: Offset caption segment timestamps by the measured MP3 duration of earlier narration scenes, and export `.srt` / `.vtt` sidecars whenever a caption track changes.
- Why: Whisper timestamps are scene-local, but the final timeline needs project-wide timings that line up with real narration audio instead of estimated speech lengths.
- Impact: Narration tracks must store `measuredDurationSeconds`, caption generation must accumulate those offsets, and caption edits must regenerate subtitle export files.

## 2026-04-07 - Scene approval seeds asset candidates instead of waiting for a separate bootstrap step
- Decision: Approving a scene now ensures that placeholder asset candidates are created from the approved image prompt.
- Why: This gives the next image milestone a stable, persisted handoff artifact without adding image generation itself yet.
- Impact: Scene approval has a downstream persistence side effect, and scene-plan invalidation must clear asset candidate records along with other derived artifacts.

## 2026-04-07 - Script retry now expands the failed draft instead of regenerating from scratch
- Decision: When a script draft fails retryable validation, keep the first draft and ask the model to expand it rather than requesting a brand-new second draft.
- Why: Live evaluations showed that a fresh second pass only added a small amount of length and often repeated the same compressed structure.
- Impact: Script retries now preserve the initial opening and structure while targeting a fuller middle and ending, and short-on-retry failures surface as a distinct final error.

## 2026-04-07 - Script generation now uses a two-stage outline-then-script flow
- Decision: Generate a 12-20 beat structural outline first, then write the full narration from that outline.
- Why: Separating planning from narration reduces summary-style compression and gives the full draft a clearer structural spine.
- Impact: Every script generation now uses two model calls before any retry, and stage-2 prompts must include the generated beat outline as context.

## 2026-04-07 - Script validation floors were raised for cinematic pacing
- Decision: Raise the minimum accepted script target to `Math.max(650, runtimeMinutes * 130)` words and `Math.max(10, runtimeMinutes * 2)` paragraphs.
- Why: Earlier thresholds allowed technically valid drafts that still felt like compressed synopses, especially at 5-minute targets.
- Impact: Shorter and flatter drafts are rejected more aggressively, and retry/expansion prompts must target the higher runtime floor explicitly.

## 2026-04-07 - Draft scene headings now come from paragraph content
- Decision: Derive scene outline headings from the paragraph’s first sentence (with a short-fragment fallback) instead of generic scene labels.
- Why: Narrative headings make scene outlines more useful for image planning, voice review, and downstream timeline work.
- Impact: Scene outline items remain ordered by numeric index, but their headings now reflect the script content directly.

## 2026-04-08 - Live-eval findings now shape story-specific titles, hooks, and retry expansion
- Decision: Use the live evaluation harness results to tighten story draft prompts around three observed weak spots: generic interchangeable titles, repetitive desk-bound hook openings, and retry under-expansion on quieter bureaucratic stories.
- Why: The 50-run evaluation showed the pipeline was broadly stable, but quality dipped in exactly those areas while other suspected issues like outline count and network reliability were not primary problems.
- Impact: Story prompts now demand story-specific title distinctiveness and more concrete opening moments, while the expansion retry spends more time on paperwork, waiting, institutional language, and lived consequences when the story’s tension is procedural rather than chase-driven.

## 2026-04-08 - Second eval pass pushes titles, hooks, and expansion beyond minimum-floor behavior
- Decision: Tighten story prompt wording so titles anchor to specific plot events, office-bound hooks open on a distinct trigger rather than a swappable workstation setup, and stage-2/retry prompts explicitly continue past the minimum floor when the story still feels lean.
- Why: The latest 50-run eval showed three concrete weak spots: generic/swappable titles, repetitive desk-terminal-monitor openings, and too many drafts passing or failing right around the hard 650-word floor.
- Impact: Title generations should become less interchangeable, hooks should vary more by story type, and stage-2 outputs should be pushed farther into the middle and ending instead of stopping as soon as they satisfy the minimum threshold.

## 2026-04-08 - Timeline review unlocks from approved narration plus current captions
- Decision: Treat timeline assembly as available when the latest narration track is approved and the latest caption track exists and is not stale, then mark the project `timeline_ready` once the draft is built.
- Why: The codebase does not have a separate caption approval model today, so the safest real gating signal is a current caption track paired to the approved narration.
- Impact: The timeline review UI can ship without inventing a parallel caption-approval state, and rebuilds can invalidate any future render jobs by returning the project to the timeline-ready stage.

## 2026-04-08 - Final video export uses local FFmpeg with placeholder still fallback
- Decision: Implement the first real render/export milestone with a local FFmpeg slideshow pipeline that merges narration audio, burns SRT captions into the video, and writes a final MP4 to `data/renders/`, while using Sharp-generated placeholder stills when no approved scene image is available.
- Why: The rendering scaffold already had local file-backed timeline and render-job storage, so FFmpeg was the smallest path to a real playable export without introducing a larger composition framework first.
- Impact: Render jobs now track `rendering` / `complete` / `error` state, the UI can poll and stream finished MP4s, and missing scene images no longer block final rendering outright.
