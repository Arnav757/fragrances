"""Proves each studio tool works end to end (not just that it imports).

    python studio/tools/selftest.py                       # fast checks
    python studio/tools/selftest.py --face frame.jpg      # also run Face Mesh on a real photo
    python studio/tools/selftest.py --full                # also run Chatterbox (slow on CPU)

Writes its outputs to ~/.cache/forma-studio/selftest/ so you can look at them.
"""
import argparse
import math
import os
import sys
import time
from pathlib import Path

CACHE = Path(os.environ.get("STUDIO_CACHE", Path.home() / ".cache" / "forma-studio"))
OUT = CACHE / "selftest"
LINE = "Kabir has a narrow jaw, so a boxed beard adds width to his face."
results: list[tuple[str, bool, str]] = []


def check(name):
    def wrap(fn):
        def run(*a, **k):
            t = time.time()
            try:
                detail = fn(*a, **k) or ""
                results.append((name, True, f"{detail} ({time.time() - t:.1f}s)"))
            except Exception as e:  # noqa: BLE001 — report every failure, keep going
                results.append((name, False, f"{type(e).__name__}: {e}"))
        return run
    return wrap


@check("pycairo + fonts")
def cairo_fonts():
    import cairo

    s = cairo.ImageSurface(cairo.FORMAT_ARGB32, 1080, 300)
    c = cairo.Context(s)
    c.set_source_rgb(0.95, 0.94, 0.93)
    c.paint()
    c.set_source_rgb(0.07, 0.07, 0.07)
    c.select_font_face("Playfair Display", cairo.FONT_SLANT_ITALIC, cairo.FONT_WEIGHT_NORMAL)
    c.set_font_size(72)
    c.move_to(60, 130)
    c.show_text("Kabir's Glowup")
    c.select_font_face("IBM Plex Mono", cairo.FONT_SLANT_NORMAL, cairo.FONT_WEIGHT_BOLD)
    c.set_font_size(30)
    c.move_to(60, 210)
    c.show_text("NARROW JAW  ✓")
    c.select_font_face("Syne", cairo.FONT_SLANT_NORMAL, cairo.FONT_WEIGHT_BOLD)
    c.set_font_size(48)
    c.move_to(600, 210)
    c.show_text("BEARD")
    s.write_to_png(str(OUT / "fonts.png"))
    return "fonts.png"


@check("MediaPipe canonical face model")
def canonical():
    obj = (CACHE / "canonical_face_model.obj").read_text().splitlines()
    v = sum(1 for l in obj if l.startswith("v "))
    vt = sum(1 for l in obj if l.startswith("vt "))
    f = sum(1 for l in obj if l.startswith("f "))
    assert v == 468 and vt == 468, f"unexpected model: {v} vertices, {vt} uvs"
    assert (CACHE / "canonical_face_model_uv_visualization.png").stat().st_size > 0
    return f"{v} vertices, {vt} UVs, {f} triangles + UV texture map"


@check("MediaPipe Face Mesh on a photo")
def face_mesh(path: str):
    import cairo
    import cv2
    import mediapipe as mp

    img = cv2.imread(path)
    assert img is not None, f"can't read {path}"
    h, w = img.shape[:2]
    with mp.solutions.face_mesh.FaceMesh(static_image_mode=True, refine_landmarks=True, max_num_faces=1) as fm:
        res = fm.process(cv2.cvtColor(img, cv2.COLOR_BGR2RGB))
    assert res.multi_face_landmarks, "no face found"
    lm = res.multi_face_landmarks[0].landmark
    pts = [(p.x * w, p.y * h) for p in lm]
    # Draw the tessellation as a wireframe with pycairo, the way the reel's scans are drawn.
    rgba = cv2.cvtColor(img, cv2.COLOR_BGR2BGRA)
    surf = cairo.ImageSurface.create_for_data(memoryview(rgba), cairo.FORMAT_ARGB32, w, h, rgba.strides[0])
    c = cairo.Context(surf)
    c.set_source_rgba(1, 1, 1, 0.55)
    c.set_line_width(max(1.0, w / 900))
    for a, b in mp.solutions.face_mesh_connections.FACEMESH_TESSELATION:
        c.move_to(*pts[a])
        c.line_to(*pts[b])
    c.stroke()
    surf.flush()
    cv2.imwrite(str(OUT / "face_mesh.png"), rgba)
    jaw_w = math.dist(pts[234], pts[454])
    face_h = math.dist(pts[10], pts[152])
    return f"{len(lm)} landmarks; face height/width {face_h / jaw_w:.2f}; face_mesh.png"


@check("Kokoro TTS → faster-whisper word timestamps")
def kokoro_whisper():
    import soundfile as sf
    from faster_whisper import WhisperModel
    from kokoro_onnx import Kokoro

    k = Kokoro(str(CACHE / "kokoro-v0_19.onnx"), str(CACHE / "voices.json"))
    audio, sr = k.create(LINE, voice="am_michael", speed=1.0, lang="en-us")
    wav = OUT / "kokoro.wav"
    sf.write(wav, audio, sr)
    words = transcribe(wav)
    heard = " ".join(w for w, _, _ in words)
    assert match(heard, LINE) >= 0.8, f"heard: {heard!r}"
    return f"{len(audio) / sr:.1f}s audio; {len(words)} words timed; first '{words[0][0]}' @ {words[0][1]:.2f}s"


@check("Chatterbox TTS → faster-whisper")
def chatterbox():
    import torch
    import torchaudio
    from chatterbox.tts import ChatterboxTTS

    device = "mps" if torch.backends.mps.is_available() else "cuda" if torch.cuda.is_available() else "cpu"
    model = ChatterboxTTS.from_pretrained(device=device)
    wav = model.generate(LINE, exaggeration=0.4, cfg_weight=0.5)
    path = OUT / "chatterbox.wav"
    torchaudio.save(str(path), wav.cpu(), model.sr)
    words = transcribe(path)
    heard = " ".join(w for w, _, _ in words)
    assert match(heard, LINE) >= 0.8, f"heard: {heard!r}"
    return f"{device}; {wav.shape[-1] / model.sr:.1f}s audio; chatterbox.wav"


@check("ffmpeg")
def ffmpeg():
    import shutil
    import subprocess

    exe = shutil.which("ffmpeg")
    assert exe, "ffmpeg not on PATH"
    out = subprocess.run([exe, "-hide_banner", "-filters"], capture_output=True, text=True).stdout
    assert " delogo " in out, "ffmpeg lacks the delogo filter"
    return subprocess.run([exe, "-version"], capture_output=True, text=True).stdout.split("\n")[0][:40]


def transcribe(path: Path):
    from faster_whisper import WhisperModel

    model = WhisperModel(os.environ.get("STUDIO_WHISPER", "small.en"), device="cpu", compute_type="int8", download_root=str(CACHE / "whisper"))
    segs, _ = model.transcribe(str(path), word_timestamps=True)
    return [(w.word.strip(), w.start, w.end) for s in segs for w in s.words]


def match(a: str, b: str) -> float:
    norm = lambda s: [w.strip(".,!?'’").lower() for w in s.split()]  # noqa: E731
    x, y = norm(a), norm(b)
    return sum(1 for w in y if w in x) / len(y)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--face", help="a photo with a face, to test Face Mesh")
    ap.add_argument("--full", action="store_true", help="also test Chatterbox (slow on CPU)")
    a = ap.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    ffmpeg()
    cairo_fonts()
    canonical()
    if a.face:
        face_mesh(a.face)
    kokoro_whisper()
    if a.full:
        chatterbox()
    width = max(len(n) for n, _, _ in results)
    for n, ok, d in results:
        print(f"  {'✓' if ok else '✗'} {n.ljust(width)}  {d}")
    print(f"  outputs: {OUT}")
    return 0 if all(ok for _, ok, _ in results) else 1


if __name__ == "__main__":
    sys.exit(main())
