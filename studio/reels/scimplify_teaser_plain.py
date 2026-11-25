"""Scimplify teaser, plain cut: the Gemini footage as generated (only the watermark removed — no grade, flare,
grain, letterbox, face softening or overlays), sinking to black into v1's logo animation, with v1's sound.

    python studio/reels/scimplify_teaser_plain.py studio/work/scimplify3     # → render/scimplify_teaser_plain.mp4
"""
import argparse
import subprocess
import sys
from pathlib import Path

import cairo
import cv2
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
import scimplify_teaser as v1  # noqa: E402
from scimplify_teaser import FOOT_END, FPS, H, SRC_OFF, TOTAL, W, Teaser, e_io, prog  # noqa: E402


class Plain(Teaser):
    def footage(self, t):
        s = (t + SRC_OFF) * 24
        i = min(int(s), len(self.frames) - 2)
        u = s - i
        f = cv2.addWeighted(self.frames[i], 1 - u, self.frames[i + 1], u, 0)
        f = cv2.resize(f, (W, H), interpolation=cv2.INTER_LANCZOS4)
        k = e_io(prog(t, 0.0, 0.4)) * (1 - e_io(prog(t, 6.45, 0.95)))  # short fade up, sink to black for the logo
        return (f.astype(np.float32) * k).astype(np.uint8)

    def compose(self, t):
        s = cairo.ImageSurface(cairo.FORMAT_ARGB32, W, H)
        ctx = cairo.Context(s)
        if t < FOOT_END:
            f = cv2.cvtColor(self.footage(t), cv2.COLOR_BGR2BGRA)
            np.ndarray((H, W, 4), np.uint8, s.get_data(), strides=(s.get_stride(), 4, 1))[:] = f
            s.mark_dirty()
            self.ending_dot(ctx, t)
        else:
            self.card(ctx, t - FOOT_END)
        s.flush()
        return s


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("work", type=Path)
    ap.add_argument("--stills", nargs="*", type=float)
    a = ap.parse_args()
    tz = Plain(a.work)
    R = a.work / "render"
    if a.stills is not None:
        for t in a.stills:
            tz.compose(t).write_to_png(str(R / f"plain_{t:05.2f}.png"))
        return
    vid = R / "video_plain.mp4"
    p = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgra", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
                          "-c:v", "libx264", "-preset", "medium", "-crf", "15", "-pix_fmt", "yuv420p", "-an", str(vid)], stdin=subprocess.PIPE)
    for i in range(int(round(TOTAL * FPS))):
        p.stdin.write(bytes(tz.compose(i / FPS).get_data()))
    p.stdin.close()
    assert p.wait() == 0
    wav = R / "audio.wav"
    if not wav.exists():
        v1.audio(a.work, wav)
    out = R / "scimplify_teaser_plain.mp4"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(vid), "-i", str(wav), "-map", "0:v", "-map", "1:a", "-c:v", "copy",
                    "-af", "loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", str(out)], check=True)
    print("done:", out)


if __name__ == "__main__":
    main()
