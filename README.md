# Story Video Studio

![CI](https://github.com/jphaduck/video-builder/actions/workflows/ci.yml/badge.svg)

Story Video Studio creates YouTube-ready narrated slideshow-style story videos from a theme, premise, and plot notes.

## What it does

Give it a story idea and it runs a complete automated pipeline:

**Script** -> **Scenes** -> **Images** -> **Narration** -> **Captions** -> **Timeline** -> **Render**

Every step has approve/reject controls, regeneration, and human review before the final MP4 is produced.

## What is built

* Two-stage story generation (beat outline then full cinematic script) with draft versioning and approve/reject gating
* Scene planning with per-scene image prompt generation and approval
* Still image generation via DALL-E 3, 2 candidates per scene
* Per-scene narration via OpenAI TTS
* Caption generation via Whisper with timing editing
* Timeline assembly and FFmpeg render pipeline producing a real MP4
* Optional ambient music layer in the render
* Real-time render progress via Server-Sent Events
* File-backed render job queue with restart recovery
* GitHub OAuth authentication via NextAuth
* All project data scoped to the authenticated user
* SQLite storage for all project and workflow metadata
* Docker container with FFmpeg bundled
* GitHub Actions CI pipeline
* 150 tests across 31 test files

## Run locally

1. Install dependencies:

   ```
   npm install
   ```

2. Add required environment variables to `.env.local`:

   ```
   OPENAI_API_KEY=your_openai_api_key
   GITHUB_CLIENT_ID=your_github_oauth_app_client_id
   GITHUB_CLIENT_SECRET=your_github_oauth_app_client_secret
   NEXTAUTH_SECRET=generate_with_openssl_rand_base64_32
   NEXTAUTH_URL=http://localhost:3000
   ```

3. Start dev server:

   ```
   npm run dev
   ```

4. Open http://localhost:3000 and sign in with GitHub.

## Run with Docker

```
docker compose up --build
```

Set the same environment variables in a `.env` file at the repo root.
Data is persisted in a Docker volume.

## Validate before pushing

```
npm run validate
```

## Notes

* This is a slideshow storytelling product, not a full animation product.
* All generation steps use real OpenAI APIs (GPT-4o, DALL-E 3, TTS, Whisper).
* FFmpeg must be available on the host system when running outside Docker.
* Ambient audio files in public/audio/ are sine-wave placeholders.
* To deploy use Render, Railway, or Fly.io. Vercel does not support FFmpeg or long-running processes.
