# Story Video Studio

Story Video Studio creates YouTube-ready narrated slideshow-style story videos from a theme, premise, and plot notes.

The app is designed to:
- generate a title and hook
- generate a full script for a 5 to 20 minute video
- split the script into scenes
- generate still-image prompts and asset candidates for each scene
- generate a voiceover
- generate captions
- assemble the final video with motion, transitions, subtitles, music, and export

## Current status
Phase 5 narration and captions is complete. The repo is ready to move into image generation, asset review, and final timeline/render work.

Completed work:
- project persistence using per-project JSON files in `data/projects/`
- project list route at `/projects`
- project create and save flow at `/projects/new`
- project detail loading at `/projects/[projectId]`
- story draft generation, version history, active draft switching, manual draft editing, reject/approve gating, and scene-planning unlock rules
- scene plan generation from an approved script with per-scene duration targets, visual intent, image prompts, edit/regenerate controls, full-plan regeneration, and scene-plan approval gating
- per-scene narration generation with OpenAI TTS and browser playback through `/api/narration/[trackId]/[sceneNumber]`
- caption generation from approved narration audio with Whisper, plus inline caption text/timing edits and SRT/VTT export sidecars
- asset candidate scaffolding on scene approval, plus timeline/rendering scaffolds for the next milestones
- Vitest service/smoke testing and GitHub Actions CI using `npm run validate`

Implemented routes:
- `/` homepage
- `/projects` project list page
- `/projects/new` new project page
- `/projects/[projectId]` project detail page with story generation, scene planning, narration, and caption review
- `/api/narration/[trackId]/[sceneNumber]` audio playback route

## Run locally
1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy `.env.example` to `.env.local` and fill in the variables you need:
   ```bash
   cp .env.example .env.local
   ```
3. Start dev server:
   ```bash
   npm run dev
   ```
4. Run tests:
   ```bash
   npm test
   ```
5. Validate the repo before pushing changes:
   ```bash
   npm run validate
   ```
6. Open:
   - http://localhost:3000/
   - http://localhost:3000/projects
   - create a project at http://localhost:3000/projects/new
   - open the generated project detail page after saving

## Notes
- This is a slideshow storytelling product, not a full animation product.
- Actual image generation/render export are still upcoming, but the repo now persists scene prompts, narration tracks, caption tracks, asset candidates, and timeline/rendering scaffolds.
- Project persistence is currently local/file-backed under `data/projects/{projectId}.json`.
- Scene persistence is currently local/file-backed under `data/scenes/{sceneId}.json`.
- Narration tracks are stored under `data/narration/{trackId}/`.
- Caption tracks and subtitle exports are stored under `data/captions/`.

## License
MIT. See [LICENSE](/Users/jp/.codex/workspaces/default/repo/LICENSE).
