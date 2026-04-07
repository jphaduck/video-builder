# Story Video Studio

Story Video Studio creates YouTube-ready narrated slideshow-style story videos from a theme, premise, and plot notes.

The app is designed to:
- generate a title and hook
- generate a full script for a 5 to 20 minute video
- split the script into scenes
- generate still images for each scene
- generate a voiceover
- generate captions
- assemble the final video with motion, transitions, subtitles, music, and export

## Current status
Phase 3 script workflow is complete and the repo is ready to begin Milestone 4 scene planning.

Completed foundation work:
- project persistence using per-project JSON files in `data/projects/`
- project list route at `/projects`
- project create and save flow at `/projects/new`
- project detail loading at `/projects/[projectId]`
- story draft generation, version history, active draft switching, manual draft editing, reject/approve gating, and scene-planning unlock rules
- Vitest smoke testing and GitHub Actions CI

Implemented routes:
- `/` homepage
- `/projects` project list page
- `/projects/new` new project page
- `/projects/[projectId]` project detail page with story generation, script draft versioning, manual editing, and workflow placeholders for later milestones

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
4. Validate the repo before pushing changes:
   ```bash
   npm run validate
   ```
5. Open:
   - http://localhost:3000/
   - http://localhost:3000/projects
   - create a project at http://localhost:3000/projects/new
   - open the generated project detail page after saving

## Notes
- This is a slideshow storytelling product, not a full animation product.
- The script workflow through approval is implemented, but scene planning, assets, narration, captions, and rendering are still scaffolded for later milestones.
- Project persistence is currently local/file-backed under `data/projects/{projectId}.json` and planned to move to a production storage backend in a later milestone.
