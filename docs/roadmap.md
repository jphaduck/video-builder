# Roadmap

## Phase 1 - Planning lock (current)
Goal: convert high-level concept into implementation-ready requirements.

Deliverables:
- finalized product spec with v1 scope boundaries
- architecture with explicit approval-gated pipeline
- style guidance aligned to YouTube-safe slideshow storytelling
- KPI, latency, and cost targets documented

Exit criteria:
- docs are specific enough to implement without major guessing
- v1 non-goals clearly listed

## Phase 2 - App foundation
Goal: ship technical foundation for single-user project workflow.

Deliverables:
- Next.js + TypeScript scaffold
- project creation and project list views
- persistent storage model for Project + StoryInput
- auto-save version history primitives for draft artifacts
- job orchestration skeleton for async generation stages

Exit criteria:
- can create/save/load project and trigger background stage jobs
- can save and retrieve multiple versions per project

## Phase 3 - Story engine + script approval gate
Goal: generate high-quality script drafts and enforce first review checkpoint.

Deliverables:
- input form supporting both one-sentence and structured input
- title/hook/script generation
- full script editor
- explicit approve/reject gate for script
- script version compare + revert

Exit criteria:
- approved script required before scene planning can begin

## Phase 4 - Scene planning + approval gate
Goal: convert script to editable scene plan with pacing control.

Deliverables:
- scene segmentation and duration targeting
- enforce auto-controlled image pacing target of 6 to 10 images per minute (with scene adjustments)
- scene intent fields (visual direction per scene)
- scene plan editing UX
- explicit approve/reject gate for scene plan

Exit criteria:
- approved scene plan required before image generation

## Phase 5 - Image pipeline + approval gate
Goal: generate stylistically consistent still imagery.

Deliverables:
- global style profile selection
- scene prompt generation and editing
- cinematic-over-literal visual prompting defaults
- multi-candidate image generation per scene
- scene-level style overrides + optional reference images
- per-scene image selection and manual regeneration
- explicit approve/reject gate for image stage

Exit criteria:
- approved image set required before voice generation

## Phase 6 - Voice + captions + approval gate
Goal: generate natural narration and editable captions.

Deliverables:
- single TTS provider integration
- 3 to 5 voice options
- pacing/speed controls (+ tone/style if available)
- pronunciation overrides
- per-section voice regeneration
- English caption generation + caption editing
- explicit approve/reject gate for voice stage

Exit criteria:
- approved voice track required before final timeline approval

## Phase 7 - Timeline assembly + final review gate
Goal: assemble a polished draft timeline ready for export.

Deliverables:
- image motion and transitions
- caption placement/styling
- audio mix controls (narration/music/SFX)
- final timeline review screen with approve/reject
- timeline version compare + revert

Exit criteria:
- export disabled until final timeline approved

## Phase 8 - Render/export + packaging + KPI instrumentation
Goal: produce final YouTube-ready deliverable and track outcomes.

Deliverables:
- render pipeline for 1920x1080 @ 30fps MP4
- captions burn-in default behavior
- title options surfaced for final selection
- basic thumbnail tooling:
  - thumbnail text ideas
  - thumbnail image prompts generated from thumbnail prompt input
- render job tracking and retry handling
- basic analytics for:
  - first-draft completion rate
  - export/publish rate
  - acceptance without major rewrites
  - duration and cost metrics

Exit criteria:
- users can consistently reach export with measurable quality/cost/latency telemetry

## Post-v1 candidates
- thumbnail rendering/compositing UI
- partial rerender optimization
- additional style packs
- additional narration providers
- vertical/square output presets
