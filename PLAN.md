# PLAN.md

## Phase 1: Core pipeline — COMPLETE

All 5 product milestones are complete. The full pipeline works end to end:
script → scenes → images → narration → captions → timeline → MP4 render.

137 tests across 29 test files. Script generation held at 88% pass rate in the
latest focused 25-run evaluation after retry hardening. A larger full-batch rerun
is still warranted before treating script quality as fully closed.

## Phase 2: Production hardening — IN PROGRESS

### Authentication — COMPLETE
* NextAuth with GitHub OAuth
* All project pages and project API routes protected
* Projects scoped to authenticated user

### Storage — IN PROGRESS
* SQLite via better-sqlite3 replaces file-based JSON for projects
* Project ownership is enforced in SQLite with `user_id`
* Render job queue persists to disk and survives process restarts
* Scenes, assets, narration, captions, timeline, and render metadata are still file-backed

### Remaining for production deployment
* Replace remaining file-backed workflow stores with SQLite or cloud storage
* Extend ownership enforcement from the project row to all derived artifacts
* Docker container with FFmpeg bundled
* CI/CD pipeline
* Replace placeholder ambient audio with real licensed music tracks
* Continue tightening script generation quality beyond the current focused-eval baseline

## Phase 3: Deployment — NOT STARTED

* Containerize with Docker
* CI/CD with GitHub Actions
* Cloud file storage (S3 or R2) for generated MP3/PNG/MP4 files
* Deploy to a platform that supports long-running processes
  (Render, Railway, or Fly.io — not Vercel, which does not support FFmpeg)
