# Current State

Current phase:
Phase 4 scene planning is complete. Image generation is the next major milestone.

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
  - inline scene editing with per-scene save, regenerate, and image-prompt regenerate actions
  - individual scene approve/reject controls
  - full scene-plan approval gate before image generation unlocks
- foundational developer tooling:
  - `.env.example` documents expected AI provider environment variables
  - Vitest + Testing Library smoke testing
  - GitHub Actions CI running lint, build, and tests on `main`

What does not exist yet:
- database implementation
- production model/provider-backed generation pipeline
- image generation implementation
- voice and caption implementation
- render pipeline implementation

Current priority:
Implement image generation and asset review on top of the approved scene plan workflow.

Next 3 tasks:
1. generate still-image candidates from approved scene prompts
2. add per-scene image selection and approval before narration work
3. preserve asset state in project workflow so downstream voice/caption work stays gated correctly

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
