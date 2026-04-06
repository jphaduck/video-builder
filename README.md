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
Phase 2 story generation workflow is in progress.

Completed foundation work:
- project persistence using a file-backed JSON store (`data/projects.json`)
- project list route at `/projects`
- project create and save flow at `/projects/new`
- project detail loading at `/projects/[projectId]`
- story draft generation, version history, active draft switching, and approval gating

Implemented scaffold routes:
- `/` homepage
- `/projects` project list page
- `/projects/new` new project page
- `/projects/[projectId]` project detail page with story generation, script draft versioning, and workflow placeholders for later milestones

## Run locally
1. Install dependencies:
   ```bash
   npm install
   ```
2. Add your OpenAI API key to `.env.local`:
   ```bash
   OPENAI_API_KEY=your_key_here
   ```
3. Start dev server:
   ```bash
   npm run dev
   ```
4. Open:
   - http://localhost:3000/
   - http://localhost:3000/projects
   - create a project at http://localhost:3000/projects/new
   - open the generated project detail page after saving

## Notes
- This is a slideshow storytelling product, not a full animation product.
- Story draft generation is implemented, but scenes/assets/narration/captions/rendering are still scaffolded for later milestones.
- Project persistence is currently local/file-backed and planned to move to a production storage backend in a later milestone.
