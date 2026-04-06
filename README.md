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
Phase 2 foundation scaffold is in progress.

Completed in Milestone 1:
- project persistence using a file-backed JSON store (`data/projects.json`)
- project list route at `/projects`
- project create and save flow at `/projects/new`
- project detail loading at `/projects/[projectId]`

Implemented scaffold routes:
- `/` homepage
- `/projects` project list page
- `/projects/new` new project page (placeholder form)
- `/projects/[projectId]` project detail page with placeholder sections for script, scenes, images, voiceover, captions, and render

## Run locally
1. Install dependencies:
   ```bash
   npm install
   ```
2. Start dev server:
   ```bash
   npm run dev
   ```
3. Open:
   - http://localhost:3000/
   - http://localhost:3000/projects/new
   - http://localhost:3000/projects/demo-project

## Notes
- This is a slideshow storytelling product, not a full animation product.
- Generation and rendering logic are not implemented yet.
- Project persistence is currently local/file-backed and planned to move to a production storage backend in a later milestone.
