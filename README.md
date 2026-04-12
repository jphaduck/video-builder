# Story Video Studio

Story Video Studio creates YouTube-ready narrated slideshow-style story videos from a theme, premise, and plot notes.

The app is designed to:

* generate a title and hook
* generate a full script for a 5 to 20 minute video
* split the script into scenes
* generate still images for each scene
* generate a voiceover
* generate captions
* assemble the final video with motion, transitions, subtitles, music, and export

## Current status

All 5 milestones are complete. The full generation pipeline works end to end:

**Script** → **Scenes** → **Images** → **Narration** → **Captions** → **Timeline** → **Render**

What is implemented:

* SQLite-backed local storage for project and workflow metadata
* GitHub OAuth authentication with NextAuth protecting project pages and project API routes
* Two-stage story generation (beat outline → full cinematic script) with validation, draft versioning, approve/reject gating, and manual editing
* Scene planning with per-scene image prompt generation, regeneration, and approval
* Still image generation via DALL-E 3 with 2 candidates per scene and a selection/approval flow
* Per-scene narration via OpenAI TTS with regenerate and approve controls
* Caption generation via Whisper with inline text and timing editing
* Timeline assembly with per-scene duration and caption preview
* Video render pipeline using FFmpeg with file-backed job queue — produces a real MP4 with burned-in captions, merged narration, and optional ambient music
* Real-time render progress via Server-Sent Events
* 140 tests across 31 test files

What remains for a production-ready version:

* Replace local SQLite and filesystem artifact storage with a production database/object-storage backend
* Replace placeholder ambient audio with real licensed music tracks
* UI polish and improved error messaging

## Run locally

1. Install dependencies:

   ```
   npm install
   ```

2. Add your environment variables to `.env.local`:

   ```
   OPENAI_API_KEY=your_key_here
   GITHUB_CLIENT_ID=your_github_oauth_app_client_id
   GITHUB_CLIENT_SECRET=your_github_oauth_app_client_secret
   NEXTAUTH_SECRET=generate_with_openssl_rand_base64_32
   NEXTAUTH_URL=http://localhost:3000
   ```

3. Start dev server:

   ```
   npm run dev
   ```

4. Validate the repo before pushing changes:

   ```
   npm run validate
   ```

5. Open:
   * http://localhost:3000/
   * http://localhost:3000/projects
   * create a project at http://localhost:3000/projects/new
   * open the generated project detail page after saving

## Notes

* This is a slideshow storytelling product, not a full animation product.
* All generation steps use real OpenAI APIs (GPT-4o, DALL-E 3, TTS, Whisper).
* Project and workflow metadata are SQLite-backed locally. Binary artifacts still live on the local filesystem.
* FFmpeg must be available on the host system for rendering to work.
* Ambient audio files in public/audio/ are sine-wave placeholders — replace with real music.
