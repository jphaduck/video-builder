# Roadmap

## Milestone 1: Project persistence
Status: complete

- Create, save, list, and load projects
- Persist projects locally during early development
- Establish reusable project types and storage utilities

## Milestone 2: Story engine
Status: complete

- Generate title options, hook, full narration draft, and scene outline
- Save generated story output onto the project
- Expose the generation workflow in the project detail page

## Milestone 3: Script review and approval workflow
Status: complete

- Support multiple script draft versions
- Compare drafts, revert by making one active, manually edit into a new draft version
- Require explicit approve/reject before scene planning

## Milestone 4: Scene and image planning
Status: complete

- Turn the approved script into editable scene records
- Add duration targets, visual intent, and image prompt planning
- Add a scene approval gate before image generation

## Milestone 5: Voice and captions
Status: complete

- Generate narration audio
- Generate and edit captions
- Add voice/caption review before final assembly
- Export caption sidecars (`.srt` / `.vtt`)

## Milestone 6: Render pipeline
Status: complete

- Assemble slideshow video output from the approved timeline draft
- Use the shipped FFmpeg renderer for 1920x1080, 30fps MP4 export
- Merge narration audio and burn captions into the final video
- Persist render jobs locally and stream live progress updates to the review UI
