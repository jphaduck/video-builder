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
All 5 product milestones are complete. The full pipeline now works end to end: script generation and approval, scene planning, image generation and review, narration, captions, timeline assembly, and final MP4 rendering all run inside the app.

Completed work:
- project persistence using per-project JSON files in `data/projects/`, including create, load, list, and delete flows
- story generation with version history, manual draft editing, compare/switch, approval gating, and scene-planning unlock rules
- scene planning from an approved script with per-scene duration targets, visual intent, image prompts, edit/regenerate controls, and approval gating
- still-image generation and review for approved scenes, including local DALL-E 3 image downloads, thumbnail playback through `/api/assets/[assetId]`, single selection, per-scene approve/reject, and project-level image-plan approval
- per-scene narration generation with OpenAI TTS and browser playback through `/api/narration/[trackId]/[sceneNumber]`
- caption generation from approved narration audio with Whisper, inline caption text/timing edits, and SRT/VTT export sidecars
- timeline assembly and review from scenes, images, narration, and captions
- final FFmpeg-based video rendering with burned-in captions, downloadable MP4 output, and in-app playback/streaming
- reusable live evaluation harness for real OpenAI script-generation benchmarking under `npm run eval:scripts`
- Vitest service/smoke testing and GitHub Actions CI using `npm run validate`

What is left for a production-ready version:
- replace file-backed JSON persistence with a real storage/database backend
- add user authentication and per-user project ownership
- improve UI polish, review UX, and error handling across the pipeline

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
- Image generation and review are now implemented; final timeline editing and render export are still upcoming.
- Project persistence is currently local/file-backed under `data/projects/{projectId}.json`.
- Scene persistence is currently local/file-backed under `data/scenes/{sceneId}.json`.
- Asset candidates and generated still images are stored under `data/assets/`.
- Narration tracks are stored under `data/narration/{trackId}/`.
- Caption tracks and subtitle exports are stored under `data/captions/`.

## License
MIT. See [LICENSE](/Users/jp/.codex/workspaces/default/repo/LICENSE).
