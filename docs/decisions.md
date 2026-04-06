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

## 2026-04-06 - Milestone 1 persistence uses local JSON file store behind project repository
- Decision: Implement initial project persistence with a `projects` repository backed by `data/projects.json`.
- Why: Smallest clean step to enable create/list/load flows without committing early to a database driver.
- Impact: Repository API should remain stable so storage backend can later move to Postgres/Supabase with minimal route changes.
