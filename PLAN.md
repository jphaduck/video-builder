# PLAN.md

## Phase 1: Core pipeline — COMPLETE

All 5 product milestones are complete. The full pipeline works end to end:
script → scenes → images → narration → captions → timeline → MP4 render.

150 tests across 31 test files. Script generation held at 88% pass rate in the
latest focused 25-run evaluation after retry hardening. A larger full-batch rerun
is still warranted before treating script quality as fully closed.

## Phase 2: Production hardening — IN PROGRESS

### Authentication — COMPLETE
* NextAuth with GitHub OAuth
* All project pages and project API routes protected
* Projects scoped to authenticated user

### Storage — COMPLETE
* SQLite via better-sqlite3 replaces file-based JSON across projects, scenes, assets, narration, captions, timelines, and render jobs
* Project ownership is enforced in SQLite with `user_id`
* Render job queue persists to disk and survives process restarts
* Binary workflow artifacts (PNG, MP3, SRT/VTT, MP4) remain on the local filesystem

### Remaining for production deployment
* Replace local binary artifact storage with cloud/object storage where appropriate
* Replace placeholder ambient audio with real licensed music tracks
* Continue tightening script generation quality beyond the current focused-eval baseline

## Phase 3: Deployment — IN PROGRESS

### Containerization — IN PROGRESS
* Dockerfile with FFmpeg bundled
* Next.js standalone output for smaller runtime images
* docker-compose local runtime with persistent `/app/data`

### CI/CD — COMPLETE
* GitHub Actions CI workflow runs lint, typecheck, test, and build on pushes and pull requests to `main`
* GitHub Actions Docker workflow validates the image build on pushes to `main` and `v*` tags

### Remaining deployment work
* Cloud file storage (S3 or R2) for generated MP3/PNG/MP4 files
* Deploy to a platform that supports long-running processes
  (Render, Railway, or Fly.io — not Vercel, which does not support FFmpeg)
