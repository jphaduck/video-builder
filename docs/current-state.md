# Current State

Current branch:
main

Current phase:
Phase 2 - Milestone 1 complete (project persistence)

What exists:
- repo created
- GitHub connected to ChatGPT
- implementation-ready planning docs
- Next.js + TypeScript app scaffold with App Router
- persistent local project storage using a file-backed JSON store (`data/projects.json`)
- working project flows:
  - create project from `/projects/new`
  - list saved projects at `/projects`
  - load project detail at `/projects/[projectId]`
- project detail page with placeholder workflow UI sections for:
  - script
  - scenes
  - assets/images
  - narration/voiceover
  - captions
  - render
- typed module structure for:
  - projects
  - scripts
  - scenes
  - assets
  - narration
  - captions
  - rendering
  - settings

What does not exist yet:
- database implementation
- generation pipeline implementation
- render pipeline implementation
- persistence for script/scene/image/voice/caption/render artifacts
- real workflow state machine in app logic

Current priority:
Move from file-backed local storage to production-ready data modeling and storage abstractions while keeping existing routes stable.

Next 3 tasks:
1. add draft/version persistence primitives linked to project IDs
2. introduce repository abstraction that can swap JSON store for Postgres/Supabase
3. implement richer project metadata fields from the product spec

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
