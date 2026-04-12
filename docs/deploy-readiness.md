# Deploy Readiness Report

## Ready
- Next.js production build is green locally.
- Full validation suite is green: lint, build, tests, and typecheck.
- Core product pipeline works end to end: projects, scripts, scenes, assets, narration, captions, timeline, and render.
- GitHub OAuth authentication is in place with project and derived-artifact ownership enforcement.
- Project and workflow metadata are SQLite-backed.
- Render execution is asynchronous and restart-tolerant via the file-backed queue and startup worker.
- Docker deployment assets exist: `Dockerfile`, `.dockerignore`, `docker-compose.yml`, and Next.js standalone output.
- GitHub Actions CI is configured for lint, typecheck, test, and build.
- GitHub Actions Docker workflow is configured to validate the image build on push.

## Blocking for deployment
- A real production OAuth setup is required:
  - `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` must come from a real GitHub OAuth app.
  - `NEXTAUTH_URL` must be the real public HTTPS domain, not `http://localhost:3000`.
  - The GitHub OAuth callback URL must match `https://<your-domain>/api/auth/callback/github`.
- The app must run on a platform that supports:
  - long-running Node processes
  - FFmpeg in the runtime image
  - a persistent writable volume mounted at `/app/data`
- The current render worker and artifact storage are single-instance by design:
  - queue state lives in `data/rendering/queue.json`
  - SQLite lives in `data/studio.db`
  - images, audio, subtitles, and renders live on the local filesystem
  - horizontal scaling is not safe without redesigning queue coordination and artifact storage
- Vercel is not a viable deployment target for the current architecture because the app depends on FFmpeg, writable local storage, and a long-running background worker.
- Local Docker verification is still missing on this development machine because the `docker` CLI/runtime is not installed here. The repo has the container assets, but the image has not been validated end-to-end from this environment.

## Nice-to-have before launch
- Move binary artifacts from local disk to object storage such as S3 or R2.
- Replace the placeholder ambient audio tracks with licensed production music.
- Rerun the larger 50-run script eval after the latest prompt hardening to confirm quality holds at scale.
- Add better operational visibility around render failures, queue health, and disk usage.
- Improve review-panel polish and final error messaging.
- Add a deployment workflow that publishes a tagged image, not just a build-check workflow.

## Recommended deployment platform
Render is the best fit for the current architecture.

Why:
- It supports long-running Node web services.
- It supports Docker-based deploys.
- It supports persistent disks, which this app needs for `/app/data`.
- It is a simpler operational match for a single-instance service with a local queue, SQLite, and FFmpeg.

Why Vercel will not work:
- The render worker is a long-running in-process interval started at app startup.
- The app writes SQLite data and generated artifacts to local disk.
- The render path depends on FFmpeg being available in the runtime.
- The queue and render artifacts assume a persistent writable filesystem and a single running process.

Fly.io is also viable if you want more infrastructure control, but it will require the same single-instance + persistent-volume discipline. Railway may also work, but the key requirement is still persistent writable storage and no horizontal scaling for the current worker model.

## Environment variables required in production
- `OPENAI_API_KEY`: required for script, image, narration, and caption generation.
- `GITHUB_CLIENT_ID`: GitHub OAuth client ID for NextAuth sign-in.
- `GITHUB_CLIENT_SECRET`: GitHub OAuth client secret for NextAuth sign-in.
- `NEXTAUTH_SECRET`: secret used by NextAuth to sign and verify session state.
- `NEXTAUTH_URL`: the public base URL of the deployed app, used by NextAuth callbacks and redirects.
- `STUDIO_DB_PATH` (optional override): custom SQLite database path if you do not want the default `data/studio.db`.
- `FFMPEG_PATH` (optional override): custom FFmpeg binary path if the runtime does not provide FFmpeg on PATH or via the bundled installer location.
- `PORT` (platform-managed in most hosts): HTTP port for the Node server to listen on.
- `HOSTNAME` (platform-managed in most hosts): bind host for the standalone server.
