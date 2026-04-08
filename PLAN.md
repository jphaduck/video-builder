# PLAN.md

Current milestone:
Milestones 1 through 6 are complete

## Milestone 1: Project persistence
Status: complete

Note:
- Projects can now be created, loaded, listed, and deleted from persistent local storage.

Goal:
Allow users to create, save, load, and list projects.

Acceptance criteria:
- A user can create a new project from /projects/new
- A project is saved in persistent storage
- A saved project can be loaded at /projects/[projectId]
- A basic project list page exists
- Types are clean and reusable

Validation:
- npm run lint
- npm run typecheck
- npm run build
- manually create a project and reload it successfully

## Milestone 2: Story engine
Status: complete

Goal:
Generate title options, hook, full script, and scene outline from user input.

Acceptance criteria:
- Input fields for theme, premise, plot notes, runtime, and tone
- A service layer that creates structured story output
- Output saved to the project
- Project detail page shows generated story sections

Validation:
- npm run lint
- npm run typecheck
- npm run build
- generate a story draft for a test project

## Milestone 3: Script review and approval workflow
Status: complete

Goal:
Review, edit, compare, reject, revert, and approve script drafts before scene planning starts.

Acceptance criteria:
- User can generate multiple script draft versions
- User can compare versions and switch the active draft
- User can manually edit a draft into a new saved version
- User can explicitly approve or reject a draft
- Scene planning remains locked until a script draft is approved

Validation:
- npm run lint
- npm run typecheck
- npm run build
- manually create, edit, reject, and approve drafts for one test project

## Milestone 4: Scene and image planning
Status: complete

Note:
- Implemented through `src/modules/scenes/` plus the still-image review flow in `src/modules/assets/`.
- Scene records are persisted separately from the project record and referenced through `project.workflow.sceneIds`.

Goal:
Turn the approved script into editable scenes and scene image prompts.

Acceptance criteria:
- Each scene has text, duration target, and image prompt
- User can regenerate prompts per scene
- Scene list is saved and editable

Validation:
- npm run lint
- npm run typecheck
- npm run build

## Milestone 5: Voice and captions
Status: complete

Goal:
Generate narration and timed captions.

Acceptance criteria:
- Narration can be generated and attached to a project
- Caption segments are stored
- UI displays voice and caption sections with real data

Validation:
- npm run lint
- npm run typecheck
- npm run build

## Milestone 6: Render pipeline
Status: complete

Note:
- Implemented with the existing file-backed timeline and rendering modules plus a real FFmpeg-based slideshow exporter.
- Timeline review is now wired on the project detail page, and the render panel streams the finished MP4 back through the app.

Goal:
Render a slideshow-style MP4 with still images, motion, subtitles, and narration.

Acceptance criteria:
- Remotion template wired to project data
- One working export flow
- Final video playable locally

Validation:
- npm run lint
- npm run typecheck
- npm run build
- render one test video successfully

## What's next

- real image-generation provider tuning and production wiring
- UI polish across script, scene, timeline, and render review surfaces
- production-ready storage and job execution beyond local file persistence
