# PLAN.md

Current milestone:
All 5 product milestones are complete

## Milestone 1: Project persistence
Status: complete

Goal:
Allow users to create, save, load, list, and delete projects.

Acceptance criteria:
- A user can create a new project from `/projects/new`
- A project is saved in persistent storage
- A saved project can be loaded at `/projects/[projectId]`
- A project list page exists
- A project can be deleted cleanly with derived artifact cleanup

Validation:
- `npm run lint`
- `npm run typecheck`
- `npm run build`
- manually create, reload, list, and delete a project

## Milestone 2: Story engine and review
Status: complete

Goal:
Generate, review, edit, compare, and approve story drafts before downstream work begins.

Acceptance criteria:
- Input fields for theme, premise, plot notes, runtime, and tone
- A service layer that creates structured story output
- Output saved to the project with version history
- User can switch active drafts, manually edit into a new version, and explicitly approve/reject a draft
- Scene planning remains locked until a script draft is approved

Validation:
- `npm run lint`
- `npm run typecheck`
- `npm run build`
- manually generate, edit, compare, reject, and approve drafts for a test project

## Milestone 3: Scene and image planning
Status: complete

Goal:
Turn the approved script into editable scenes and reviewed still-image selections.

Acceptance criteria:
- Scene records include script excerpt, duration target, visual intent, and image prompt
- User can edit/regenerate scenes and regenerate image prompts
- Scene plan requires explicit approval
- Image candidates are generated per approved scene, persisted locally, and reviewed with selection + approval controls
- Project-level image plan approval unlocks downstream stages

Validation:
- `npm run lint`
- `npm run typecheck`
- `npm run build`
- manually generate and approve a scene plan, then generate and approve still images

## Milestone 4: Voice and captions
Status: complete

Goal:
Generate narration audio and timed captions from the approved scenes.

Acceptance criteria:
- Narration can be generated, played back, regenerated, and approved
- Caption segments are generated from narration audio and persisted
- UI displays real voice and caption sections with review/edit controls
- Subtitle sidecars are exported

Validation:
- `npm run lint`
- `npm run typecheck`
- `npm run build`
- manually generate approved narration and captions for a test project

## Milestone 5: Timeline and render pipeline
Status: complete

Goal:
Assemble the approved project into a reviewable timeline and export a final MP4.

Acceptance criteria:
- Timeline draft builds from scenes, selected images, narration, and captions
- Timeline review is visible on the project detail page
- Render jobs can be started, tracked, and completed
- Final video is playable locally and downloadable from the app

Validation:
- `npm run lint`
- `npm run typecheck`
- `npm run build`
- manually build a timeline and render one test video successfully

## Next phase

- Production storage backend (replace file-based JSON)
- User authentication
- UI polish and error handling improvements
- Real-time render progress (websocket or SSE instead of polling)
- Music/background audio layer in render pipeline
