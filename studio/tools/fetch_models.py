"""Download the models the studio needs into ~/.cache/forma-studio (once).

- Kokoro v0.19 ONNX + voices (fast backup narrator; v0.19 matches kokoro-onnx 0.3.x, which keeps numpy<2 for MediaPipe/Chatterbox)
- MediaPipe canonical face model (.obj) + its UV texture map, for placing overlays on real faces
- faster-whisper model for word timestamps (STUDIO_WHISPER, default small.en)
Chatterbox weights download from Hugging Face on first use (ChatterboxTTS.from_pretrained).
"""
import os
import sys
import urllib.request
from pathlib import Path

CACHE = Path(os.environ.get("STUDIO_CACHE", Path.home() / ".cache" / "forma-studio"))
FILES = {
    "kokoro-v0_19.onnx": "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files/kokoro-v0_19.onnx",
    "voices.json": "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files/voices.json",
    "canonical_face_model.obj": "https://raw.githubusercontent.com/google-ai-edge/mediapipe/v0.10.14/mediapipe/modules/face_geometry/data/canonical_face_model.obj",
    "canonical_face_model_uv_visualization.png": "https://raw.githubusercontent.com/google-ai-edge/mediapipe/v0.10.14/mediapipe/modules/face_geometry/data/canonical_face_model_uv_visualization.png",
}


def fetch(name: str, url: str) -> None:
    dest = CACHE / name
    if dest.exists() and dest.stat().st_size > 0:
        print(f"  ✓ {name} (cached)")
        return
    tmp = dest.with_suffix(dest.suffix + ".part")
    print(f"  ↓ {name}")
    urllib.request.urlretrieve(url, tmp)
    tmp.rename(dest)


def main() -> int:
    CACHE.mkdir(parents=True, exist_ok=True)
    for n, u in FILES.items():
        fetch(n, u)
    from faster_whisper import WhisperModel  # noqa: PLC0415

    name = os.environ.get("STUDIO_WHISPER", "small.en")
    print(f"  ↓ faster-whisper {name}")
    WhisperModel(name, device="cpu", compute_type="int8", download_root=str(CACHE / "whisper"))
    print(f"  ✓ models in {CACHE}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
