# Pipeline scripts

| File | Role |
|---|---|
| `voice.py` | Narration: one Chatterbox take per line (optional voice clone via `--prompt`), Kokoro fallback, joined with controlled pauses → `narration.wav`, `lines.json`. `--only N` re-generates one line. |
| `timeline.py` | faster-whisper word timestamps, each script line verified as heard (≥ 85 %), timings re-spelled to the script (colour, not color) → `words.json`. |
| `facemap.py` | MediaPipe Pose (33 points) + Face Mesh (478 points) per image, in output-canvas pixels → `landmarks.json`. |
| `silhouette.py` | Body-outline widths from MediaPipe segmentation (shoulders, waist, knees, ankles) for measurement overlays. |
| `render.py` | pycairo primitives in the series style (captions, badges with drawn ✓/✗, title cards, measurement lines, tiles + cursor, swatches, scan-line wipes, logo) and the video-making flow: one encode per scene → concat `-c copy` → audio last. |
| `verify_sync.py` | Measures when each event actually appears in the final video and compares it with its spoken word; fails outside ±80 ms. |

Reel timelines live in `../reels/` (e.g. `arjun_outfit.py`); every scene boundary and animation is anchored to a word.
If you have scripts from the Kabir remake, add them here and keep inputs on the command line and models in `~/.cache/forma-studio`.
