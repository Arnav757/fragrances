"""Narration: one Chatterbox take per line (Kokoro fallback), joined with short pauses.

    python studio/lib/voice.py lines.txt out_dir [--prompt voice.wav] [--engine chatterbox|kokoro] [--gap 0.3]

Writes out_dir/line_XX.wav (kept, so a single bad line can be re-generated with --only N),
out_dir/narration.wav (24 kHz mono) and out_dir/lines.json (start/end of each line).
"""
import argparse
import json
import os
from pathlib import Path

import numpy as np
import soundfile as sf

SR = 24000
CACHE = Path(os.environ.get("STUDIO_CACHE", Path.home() / ".cache" / "forma-studio"))


def chatterbox_engine(prompt: str | None):
    import torch
    from chatterbox.tts import ChatterboxTTS

    device = "mps" if torch.backends.mps.is_available() else "cuda" if torch.cuda.is_available() else "cpu"
    model = ChatterboxTTS.from_pretrained(device=device)
    torch.manual_seed(7)  # repeatable takes

    def say(text: str) -> np.ndarray:
        wav = model.generate(text, audio_prompt_path=prompt, exaggeration=0.45, cfg_weight=0.45, temperature=0.7)
        audio = wav.squeeze(0).cpu().numpy()
        if model.sr != SR:
            from scipy.signal import resample_poly

            audio = resample_poly(audio, SR, model.sr)
        return audio

    return say


def kokoro_engine(voice: str = "am_michael"):
    from kokoro_onnx import Kokoro
    from scipy.signal import resample_poly

    k = Kokoro(str(CACHE / "kokoro-v0_19.onnx"), str(CACHE / "voices.json"))

    def say(text: str) -> np.ndarray:
        audio, sr = k.create(text, voice=voice, speed=1.05, lang="en-us")
        return audio if sr == SR else resample_poly(audio, SR, sr)

    return say


def trim(audio: np.ndarray, thresh: float = 0.01) -> np.ndarray:
    """Drop leading/trailing near-silence so pauses are controlled by --gap only."""
    idx = np.where(np.abs(audio) > thresh)[0]
    if not len(idx):
        return audio
    a, b = max(0, idx[0] - int(0.03 * SR)), min(len(audio), idx[-1] + int(0.08 * SR))
    return audio[a:b]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("lines")
    ap.add_argument("out")
    ap.add_argument("--prompt", help="reference voice (~10 s wav) for Chatterbox voice cloning")
    ap.add_argument("--engine", default="chatterbox", choices=["chatterbox", "kokoro"])
    ap.add_argument("--gap", type=float, default=0.3)
    ap.add_argument("--only", type=int, help="re-generate just this 1-based line")
    a = ap.parse_args()
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    lines = [l.strip() for l in Path(a.lines).read_text().splitlines() if l.strip()]
    say = chatterbox_engine(a.prompt) if a.engine == "chatterbox" else kokoro_engine()
    for i, text in enumerate(lines, 1):
        f = out / f"line_{i:02d}.wav"
        if f.exists() and a.only not in (None, i):
            continue
        if a.only is None and f.exists():
            continue
        audio = trim(say(text))
        tmp = f.with_name(f.stem + ".part.wav")
        sf.write(tmp, audio, SR)
        tmp.rename(f)
        print(f"line {i}: {len(audio) / SR:.2f}s  {text}", flush=True)
    parts, meta, t = [], [], 0.0
    gap = np.zeros(int(a.gap * SR), dtype=np.float32)
    for i, text in enumerate(lines, 1):
        audio, _ = sf.read(out / f"line_{i:02d}.wav", dtype="float32")
        meta.append({"line": i, "text": text, "start": round(t, 3), "end": round(t + len(audio) / SR, 3)})
        parts += [audio, gap]
        t += len(audio) / SR + a.gap
    sf.write(out / "narration.wav", np.concatenate(parts[:-1]), SR)
    (out / "lines.json").write_text(json.dumps(meta, indent=1))
    print(f"narration.wav: {t - a.gap:.2f}s")


if __name__ == "__main__":
    main()
