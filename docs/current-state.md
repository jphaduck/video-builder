# Current State

Current phase:
Phase 4 is next. Phase 3 script workflow is complete.

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

What does not exist yet:
- database implementation
- production model/provider-backed generation pipeline
- scene planning implementation
- image generation implementation
- voice and caption implementation
- render pipeline implementation

Current priority:
Begin Milestone 4 by turning an approved script draft into an editable scene plan with pacing controls and approval gating.

Next 3 tasks:
1. persist scene records with duration targets and visual intent fields
2. generate a first-pass scene plan from the approved script draft
3. add scene approval state before image generation can begin

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
