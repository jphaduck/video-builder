# PLAN.md

## Milestone 1: Project persistence
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
- npm run build
- manually create a project and reload it successfully

## Milestone 2: Story engine
Goal:
Generate title options, hook, full script, and scene outline from user input.

Acceptance criteria:
- Input fields for theme, premise, plot notes, runtime, and tone
- A service layer that creates structured story output
- Output saved to the project
- Project detail page shows generated story sections

Validation:
- npm run lint
- npm run build
- generate a story draft for a test project

## Milestone 3: Scene and image planning
Goal:
Turn the script into scenes and scene image prompts.

Acceptance criteria:
- Each scene has text, duration target, and image prompt
- User can regenerate prompts per scene
- Scene list is saved and editable

Validation:
- npm run lint
- npm run build

## Milestone 4: Voice and captions
Goal:
Generate narration and timed captions.

Acceptance criteria:
- Narration can be generated and attached to a project
- Caption segments are stored
- UI displays voice and caption sections with real data

Validation:
- npm run lint
- npm run build

## Milestone 5: Render pipeline
Goal:
Render a slideshow-style MP4 with still images, motion, subtitles, and narration.

Acceptance criteria:
- Remotion template wired to project data
- One working export flow
- Final video playable locally

Validation:
- npm run lint
- npm run build
- render one test video successfully
