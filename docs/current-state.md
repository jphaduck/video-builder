# Current State

Current branch:
work

Current phase:
Phase 2 - Milestone 2 complete (story engine scaffold)

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
- story engine scaffold for saved projects:
  - structured story input fields on project detail page (theme, premise, plot notes, target runtime, tone)
  - modular script service for story draft generation
  - persisted story draft output per project including:
    - title options
    - hook
    - full narration draft
    - scene-by-scene outline
  - story output displayed on the project detail page after generation

What does not exist yet:
- database implementation
- production model/provider-backed generation pipeline
- render pipeline implementation
- persistence for scene/image/voice/caption/render artifacts
- real workflow state machine in app logic

Current priority:
Move from local story generation scaffold to richer versioned story artifacts and prepare repository abstraction for database migration.

Next 3 tasks:
1. add explicit script draft version records with compare/revert primitives
2. introduce repository abstraction that can swap JSON store for Postgres/Supabase
3. implement script approval gating before scene planning

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
