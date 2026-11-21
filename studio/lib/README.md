# Reusable pipeline scripts

Put the renderer, face-mapping, voice and timeline scripts from the Kabir remake here, so Claude Code
reuses them instead of rewriting them. Suggested layout:

| File | Role |
|---|---|
| `timeline.py` | Script lines → narration → word timestamps (faster-whisper) → a timed list of events per scene |
| `voice.py` | Chatterbox narration with a Kokoro fallback; writes `narration.wav` + `words.json` |
| `facemap.py` | MediaPipe Face Mesh + canonical-model UVs → per-frame landmark and region masks (jaw, chin, cheeks, hairline, forehead) |
| `render.py` | pycairo overlays (wireframe, beard binary code, hair strands, highlights, badges, tiles, cursor, captions) → one mp4 per scene, following the video-making skill |

Keep them free of hard-coded paths: take inputs on the command line and read models from
`~/.cache/forma-studio` (or `$STUDIO_CACHE`).
