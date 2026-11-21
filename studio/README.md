# FORMA content studio

The toolkit behind FORMA's AI "glow-up" reels: AI characters (ChatGPT images + Gemini/Veo animation)
edited into motion-matched Reels by Claude Code with real face tracking, natural narration and
word-accurate captions.

## Setup (once, in Claude Code on your Mac)

```bash
bash studio/setup.sh
```

It installs everything below and finishes with a self-test. About 4 GB including PyTorch and the speech
models. To skip the large Chatterbox/PyTorch install: `STUDIO_SKIP_CHATTERBOX=1 bash studio/setup.sh`.
Needs `git`, `ffmpeg` (`brew install ffmpeg`) and Node (for `npm i -g bun`); `uv` and Bun are installed
if missing.

## What gets installed

**Skills** (into `~/.claude/skills`)

| Skill | Role |
|---|---|
| **reanimate** | Frame-by-frame breakdown of a reference reel, a timing spec, and side-by-side compare sheets. Pinned to a reviewed commit (MIT). |
| **video-making** | Rendering method: one encoded file per scene, joined without re-encoding, sound added last. Source in `skills/video-making/`. |

**Tools** (Python 3.11 env at `~/.venvs/studio`; models in `~/.cache/forma-studio`)

| Tool | Role | Notes |
|---|---|---|
| MediaPipe Face Mesh 0.10.14 + canonical face model | 468 face points per frame (478 with irises), plus the canonical model's UV map, so scans and overlays sit on the real face | Needs Python 3.11 |
| Chatterbox TTS | Natural narration | Pulls in PyTorch 2.6. About 80 s per sentence on a 4-core Linux CPU; much faster on Apple Silicon (MPS) |
| Kokoro (kokoro-onnx 0.3.3) | Fast backup voice | Uses the **v0.19** model files: kokoro-onnx 0.4+ (v1.0 voices) needs NumPy 2, which breaks MediaPipe and Chatterbox |
| faster-whisper (small.en) | Word timestamps, so each animation and caption lands on the spoken word | `STUDIO_WHISPER=medium.en` for more accuracy |
| pycairo | Drawing overlays, labels, thumbnails and the cursor | IBM Plex Mono has no ✓/✗ glyphs: draw ticks and crosses as paths |
| OpenCV, scikit-image, SciPy | Masks, wireframe lines, logo removal, audio resampling | |
| ffmpeg | Cutting, encoding, `delogo`, joining | System install |
| Fonts | Playfair Display (incl. Italic), IBM Plex Mono, Syne, Inter Tight (FORMA brand) | From github.com/google/fonts (OFL) |

Check everything any time:

```bash
source ~/.venvs/studio/bin/activate
python studio/tools/selftest.py --face some_photo.jpg --full
```

## Making a reel (the pipeline that produced *Arjun's Outfit Glowup*)

```bash
source ~/.venvs/studio/bin/activate
W=studio/work/arjun                                   # assets/ holds the brief's images
python studio/lib/voice.py studio/reels/arjun_outfit.lines.txt $W/voice --prompt $W/voice/kabir_voice_prompt.wav   # narration
python studio/lib/timeline.py $W/voice                 # word timestamps, checked against the script
python studio/lib/facemap.py $W/landmarks.json $W/assets/*.png                              # pose + face points
PYTHONPATH=studio/lib python studio/lib/silhouette.py $W img1_before img2_fit img3_balance img5_after_studio  # outline widths
# Gemini/Veo clips → work/clips/g1.mp4, g3.mp4: remove the corner sparkle, then align each clip to its still
python studio/lib/unwatermark.py estimate $W/clips/g1.mp4 $W/clips/g3.mp4 $W/clips/wm_alpha.npy --box 576 1136 48 48
python studio/lib/unwatermark.py apply $W/clips/g1.mp4 $W/clips/g1_clean.mp4 $W/clips/wm_alpha.npy --box 576 1136 48 48
PYTHONPATH=studio/lib python studio/lib/align.py $W $W/clips/g1_clean.mp4 0.9 img2_fit pose    # → clips/clips.json
python studio/reels/arjun_outfit.py $W --stills        # look at key frames first
python studio/reels/arjun_outfit.py $W                 # render: per-scene encode → join → audio
python studio/lib/verify_sync.py $W/render/arjun_outfit_glowup.mp4 $W/render/events.json  # ±80 ms check
```

Or hand the whole job to Claude Code:

1. Generate the images and clips from a brief in `briefs/` (e.g. `briefs/arjun-outfit-glowup.md`) and
   put them, named as the brief says, in `studio/work/<reel>/assets/`.
2. Give Claude Code this prompt:

> Use the reanimate skill to break down `[reference reel]` frame by frame and remake it motion-faithfully
> with the assets in `studio/work/<reel>/assets/`, following `studio/briefs/<brief>.md`. Reuse the
> scripts in `studio/lib/`. Use MediaPipe Face Mesh with the canonical face model's texture map to place
> every face overlay (wireframe, beard binary code, hair strands, region highlights) on the real face.
> Narrate with Chatterbox (Kokoro as fallback), get word timestamps with faster-whisper, and trigger each
> animation and caption on its word. Render with pycairo + ffmpeg following the video-making skill. Verify
> with reanimate's compare sheets until every transition is within ±80 ms of the reference. Finish with the
> FORMA end card, loudness at −14 LUFS, and the AI-character disclosure.

`studio/work/` is git-ignored: renders and assets stay local.

## Reference: Kabir's Glowup (the first reel)

Narration measured with faster-whisper: 15 sentences, 122 words, **150 words per minute**. Structure: hook
→ problem (3 traits) → goal → three numbered fixes, each with ✗/✓ tiles → payoff → "Follow for more
grooming tips." New briefs keep this pacing and structure.
