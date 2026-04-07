# Architecture

## Canonical architecture
Story Video Studio is a Next.js App Router application with TypeScript.

- UI layer: `src/app`
- Reusable UI components: `src/components`
- Domain logic: `src/modules/*`
- Shared server utilities: `src/lib/*`
- Shared types: `src/types/*`

The product is organized around a staged workflow:
project -> script -> scenes -> assets -> narration -> captions -> render

## Current implementation
- Next.js App Router renders the product pages and forms
- Server-side mutations currently use server actions for simple form submissions
- Early milestone persistence uses local JSON files in `data/projects/{projectId}.json`
- The low-level persistence boundary lives in `src/lib/projects.ts`
- Feature-specific orchestration sits in module folders such as `src/modules/projects` and `src/modules/scripts`

## Intended server architecture
For generation-heavy features, the canonical server boundary is:
- App Router UI for user-facing pages
- server-side modules for business logic
- route handlers and/or server actions for invoking generation and persistence workflows

Simple form flows can continue to use server actions. Longer-running AI and render work should move toward dedicated route/job boundaries as milestones advance.

## Persistence architecture
During early milestones, project persistence is local and file-backed:
- root data directory: `data/`
- per-project files: `data/projects/{projectId}.json`

This keeps the storage dependency-free while preserving a clear replacement seam for a future database-backed implementation.

## Core artifacts
- `Project`
- `StoryInput`
- `StoryDraft`
- later milestones: `ScenePlan`, `SceneImage`, `VoiceTrack`, `CaptionTrack`, `TimelineDraft`, `RenderJob`

## Workflow rules
The product should enforce human review before moving through major stages:
1. Script draft approval
2. Scene plan approval
3. Image approval
4. Voice approval
5. Final timeline approval

No final render should happen without a human-approved timeline.

## Planned render architecture
The render pipeline is not implemented yet.

When the render milestone is reached later in the roadmap, the intended renderer is:
- Remotion
- 1920x1080
- 30fps
- slideshow-style video composition with still images, motion, captions, narration, and optional audio beds

## Design constraints
- Slideshow-style storytelling only, not full animation
- Runtime target: 5 to 20 minutes
- Keep modules decoupled enough that AI providers and persistence layers can be swapped later
- Prefer simple, readable server-side code over premature infrastructure complexity
