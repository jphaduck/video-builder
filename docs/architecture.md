# Architecture

## Suggested stack
- Frontend: Next.js + TypeScript
- Backend: Next.js server routes or server actions
- Database: Postgres or Supabase
- Storage: object storage for images, audio, renders
- Rendering: Remotion
- AI generation:
  - script generation
  - image generation
  - voice generation
  - timing/caption generation

## Main system modules
1. Project management
2. Story engine
3. Scene planner
4. Image generation pipeline
5. Voiceover pipeline
6. Caption/timing pipeline
7. Render pipeline
8. Review/edit UI

## Core data objects
- Project
- ScriptDraft
- Scene
- SceneImage
- VoiceTrack
- CaptionTrack
- RenderJob

## Pipeline
1. Create project
2. Generate script
3. Split into scenes
4. Generate scene prompts
5. Generate still images
6. Generate voiceover
7. Generate captions/timing
8. Render final video
9. Review and export

## Design philosophy
- modular
- editable
- reliable
- quality-first
