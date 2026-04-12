# Architecture

## Canonical architecture
Story Video Studio is a Next.js App Router application with TypeScript.

- UI layer: `src/app`
- Reusable UI components: `src/components`
- Domain logic: `src/modules/*`
- Shared server utilities: `src/lib/*`
- Shared types: `src/types/*`

The product is organized around a staged workflow:
project -> script -> scenes -> assets -> narration -> captions -> timeline -> render

## Current implementation
- Next.js App Router renders the product pages and forms
- Server-side mutations currently use server actions for simple form submissions
- Project persistence now uses SQLite at `data/studio.db`, storing each project row as a JSON blob plus ownership metadata
- The low-level persistence boundary lives in `src/lib/projects.ts`
- Feature-specific orchestration sits in module folders such as `src/modules/projects` and `src/modules/scripts`
- Timeline drafts, caption sidecars, narration tracks, render jobs, and final MP4 exports are also stored locally under `data/`
- Rendering runs through dedicated route handlers plus `src/modules/rendering`, with async job state persisted to disk and streamed to the UI over SSE

## Intended server architecture
For generation-heavy features, the canonical server boundary is:
- App Router UI for user-facing pages
- server-side modules for business logic
- route handlers and/or server actions for invoking generation and persistence workflows

Simple form flows can continue to use server actions. Longer-running AI and render work should move toward dedicated route/job boundaries as milestones advance.

## Persistence architecture
Project persistence is now local but database-backed:
- root data directory: `data/`
- SQLite database: `data/studio.db`
- `projects` table stores the full project JSON blob plus `created_at`, `updated_at`, and `user_id`

Derived workflow artifacts are still stored under `data/` as per-file JSON or media assets, preserving clear seams for later migration to broader database-backed or cloud-backed storage.

## Core artifacts
- `Project`
- `StoryInput`
- `StoryDraft`
- `Scene`
- `AssetCandidate`
- `NarrationTrack`
- `CaptionTrack`
- `TimelineDraft`
- `RenderJob`

## Workflow rules
The product should enforce human review before moving through major stages:
1. Script draft approval
2. Scene plan approval
3. Image approval
4. Voice approval
5. Final timeline approval

No final render should happen without a human-approved timeline.

## Current render architecture
The render pipeline is implemented today as a local FFmpeg-based slideshow renderer.

Current render behavior:
- assembles timeline scene stills into a 1920x1080, 30fps MP4 export
- concatenates approved narration audio into one soundtrack
- burns generated SRT captions directly into the final video
- falls back to generated placeholder stills when a scene does not have an approved image
- persists render job metadata and temporary artifacts under `data/rendering/`
- writes final project exports to `data/renders/{projectId}.mp4`
- exposes async start/status routes plus an SSE progress stream for the review UI

## Design constraints
- Slideshow-style storytelling only, not full animation
- Runtime target: 5 to 20 minutes
- Keep modules decoupled enough that AI providers and persistence layers can be swapped later
- Prefer simple, readable server-side code over premature infrastructure complexity
