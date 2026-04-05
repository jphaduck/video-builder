# AGENTS.md

Read these files before starting any non-trivial task:
- README.md
- docs/product-spec.md
- docs/architecture.md
- docs/current-state.md
- docs/roadmap.md

Project goal:
Build a web app that creates YouTube story videos in a narrated slideshow format from a user-provided idea. The app should generate a script, scene plan, still images, voiceover, captions, and a final rendered video.

Core product constraints:
- This is NOT a full animation product.
- Videos are slideshow-style with still images, motion, captions, sound, and voiceover.
- Target video length is 5 to 20 minutes.
- Quality matters more than speed.
- Human review should be possible before final render.
- Keep the codebase modular and easy to maintain.

Engineering constraints:
- Use TypeScript.
- Prefer clean, simple architecture over cleverness.
- Do not refactor unrelated files.
- Do not add unnecessary dependencies.
- Use environment variables for all secrets.
- Keep functions small and readable.
- Add comments only where they add real clarity.
- Update docs/current-state.md after each meaningful task.
- Update docs/decisions.md when an important product or engineering decision is made.

Workflow rules:
- For complex work, plan before coding.
- If requirements are fuzzy, ask questions first.
- Work in small milestones.
- After each task, report:
  1. what changed
  2. what still needs work
  3. how to test it
  4. which files were touched

Done when:
- The requested feature works
- The code is reasonably clean
- Relevant docs are updated
- Basic verification or testing is included
