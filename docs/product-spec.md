# Product Spec

## Product name
Story Video Studio

## Product positioning (v1)
Story Video Studio helps a **solo faceless YouTube channel operator** turn a story idea into a YouTube-ready, slideshow-style long-form video draft with minimal manual work.

V1 is optimized for a single creator publishing regularly, not team collaboration or agency workflows.

## Audience definitions
### Product user
- Solo creator producing long-form faceless YouTube story videos.

### End viewer
- People who watch suspense, mystery, crime, irony, social commentary, and dramatic faceless storytelling content on YouTube.

## Core outcome
Given a story idea, the user should be able to produce a strong first draft that is close to post-ready after one structured review pass.

## Non-goals (v1)
- Full animation workflows
- Multi-user collaboration roles/permissions
- Voice cloning
- Vertical/square export presets
- Advanced professional NLE-style editing

## Required video format (v1)
- Runtime: **5 to 20 minutes**
- Format: narrated, still-image-based slideshow with cinematic motion
- Captions: English captions required on every output
- Export preset: **1920x1080, 30 fps, MP4**
- Captions should be burn-in by default (with ability to make this configurable later)

## Default creative parameters
- **Tone default:** cinematic, suspenseful, serious, emotionally clear, immersive, polished
- **Tone variance:** may shift by topic, but should avoid overly casual/comedic/cartoonish output by default
- **Narration default:** natural, immersive, serious, clear, non-robotic delivery with support for dramatic pacing
- **Visual intent default:** cinematic over purely literal; emotionally and narratively aligned while still relevant to spoken content
- **Image pacing default:** target **6 to 10 images per minute**, adjusted by story pacing

## Primary user workflow
1. Create project
2. Provide story input
3. Generate title options and hook
4. Generate script draft
5. Review/approve script draft
6. Generate scene plan
7. Review/approve scene plan
8. Generate scene images
9. Review/approve scene imagery
10. Generate voiceover
11. Review/approve voiceover
12. Generate captions and timeline assembly
13. Review/approve final timeline
14. Export final video

## Input model
### Minimum input (must work)
- One-sentence idea

### Preferred structured input (recommended for quality)
- Theme
- Premise
- Tone/style
- Target runtime (5 to 20 minutes)
- Optional plot beats/notes

The system should accept minimal input but clearly communicate that structured input improves quality.

## Content boundaries and safety scope
### Supported content categories
- Crime, mystery, suspense
- Social commentary
- History and politics
- Dramatic storytelling

### Explicitly disallowed content
- Pornography and explicit 18+ sexual content
- Graphic gore and fetish content
- Hateful or extremist content
- Clearly illegal content
- Content likely to violate YouTube safety/monetization norms

Product goal: support mature, compelling storytelling while staying in YouTube-safe bounds.

## Quality bar (v1)
A successful first draft should satisfy:
- **~80% to 90%** of generated output is usable without major rewrites
- Human edits are primarily review, correction, and refinement rather than major rebuilding
- Coherent narrative, consistent style, clean pacing
- Strong enough for publication after one review pass and light edits

## Human review checkpoints (hard requirement)
The user must be able to stop, review, edit, and approve before progressing at:
1. Script draft
2. Scene plan
3. Image generation output
4. Voiceover output
5. Final timeline before export

## Editing capabilities (v1)
Users must be able to directly edit:
- Full script text
- Plot direction/story beats
- Scene-by-scene image prompts
- Selected generated image per scene
- Voice selection
- Voice pacing/speed and tone/style (where provider supports it)
- Caption text
- Per-scene timing/duration
- Music/SFX volume levels
- Overall narration vs background audio mix

## Visual style controls (v1)
- Project-level global style profile required (for consistency)
- Preset examples: cinematic, dark, realistic, documentary, surreal
- Scene-level visual override allowed
- Optional reference image input supported

## Voiceover policy (v1)
- Use one reliable TTS provider for launch
- Provide 3 to 5 voice options
- Support speech speed control
- Support tone/style control where available
- Regenerate individual sections without rerunning full project
- Basic pronunciation overrides for uncommon names/terms
- Voice cloning is out of scope

## Music and SFX policy (v1)
- All included music/SFX must be copyright-safe for YouTube monetization use
- Music/SFX are optional
- Default usage should be light/minimal to preserve narration clarity
- Sound design should support mood/pacing, not dominate narration

## Title and thumbnail support (v1)
- **Title generation is included in v1**
- **Basic thumbnail support is included in v1**:
  - thumbnail text ideas
  - thumbnail image prompts generated from the approved thumbnail prompt input
- Advanced thumbnail tooling is post-v1

## Drafts and version history (v1)
- Projects must support multiple saved drafts
- Users must be able to compare versions and revert to earlier outputs
- Version history should apply to script/scene/voice/image timeline artifacts

## Performance and cost targets (v1)
Quality-first, but with practical limits:
- 10-minute video draft: target completion in **60 to 120 minutes**
- 20-minute video draft: target completion in **2 to 4 hours**
- Absolute maximum end-to-end generation+render time: **under 8 hours**
- Per-video cost should be tracked and optimized over time without changing core workflow

## Launch KPIs
1. First-draft completion rate
2. Export/publish-to-YouTube rate
3. Percentage of generated output accepted without major rewrites

## Additional product direction
This is a slideshow-style YouTube storytelling product, not an animation product.
Prioritize script quality, natural voiceover, consistent still-image art direction, clean captions, and polished timeline assembly for long-form (5 to 20 minute) videos with built-in human review.
