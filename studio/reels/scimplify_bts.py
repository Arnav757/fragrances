"""Scimplify behind-the-scenes lab post: one Gemini shot (watermark removed), no text, logo end card. 10 s.

    python studio/reels/scimplify_bts.py studio/work/scimplify2 --format 16x9   # 1920x1080
    python studio/reels/scimplify_bts.py studio/work/scimplify2 --format 4x5    # 1080x1350
    add --stills 1 7.8 8.3 9.5 to check frames

Inputs: <work>/render/clean.mp4 (src with the sparkle removed by lib/unwatermark.py), <work>/render/amb.wav,
../scimplify/logo_color.png (cut from the supplied logo).
"""
import argparse
import math
import subprocess
from pathlib import Path

import cairo
import cv2
import numpy as np
import soundfile as sf

FPS = 24
SPEED = 1.15            # 9.2 s of footage plays in 8.0 s
FOOT = 8.0
TOTAL = 10.0
BG = (0xF7 / 255, 0xF7 / 255, 0xF7 / 255)
SIZES = {"16x9": (1920, 1080), "4x5": (1080, 1350)}


def clamp(x, a=0.0, b=1.0):
    return max(a, min(b, x))


def prog(t, t0, d):
    return clamp((t - t0) / d)


def e_out(x):
    return 1.0 if x >= 1 else 1 - 2 ** (-10 * x)


def e_io(x):
    if x <= 0:
        return 0.0
    if x >= 1:
        return 1.0
    return 2 ** (20 * x - 10) / 2 if x < 0.5 else (2 - 2 ** (-20 * x + 10)) / 2


def lerp(a, b, u):
    return a + (b - a) * u


class Post:
    def __init__(self, work: Path, fmt: str):
        self.W, self.H = SIZES[fmt]
        self.fmt = fmt
        cap = cv2.VideoCapture(str(work / "render" / "clean.mp4"))
        self.frames = []
        while True:
            ok, f = cap.read()
            if not ok:
                break
            self.frames.append(f)
        self.src_fps = 24.0
        logo = cv2.imread(str(work.parent / "scimplify" / "logo_color.png"), cv2.IMREAD_UNCHANGED)
        self.logo = logo
        h, w = logo.shape[:2]
        a = logo[..., 3]
        band = np.zeros((h, w), np.uint8)
        cv2.rectangle(band, (2, 1), (386, 386), 255, -1)
        cv2.rectangle(band, (36, 31), (356, 356), 0, -1)
        band[77:320, 352:] = 0
        nums = np.zeros((h, w), np.uint8)
        nums[38:78, 30:96] = 255
        nums[312:352, 30:60] = 255
        reg = np.zeros((h, w), np.uint8)
        reg[:, 1092:] = 255
        word = (a > 0) & (band == 0) & (nums == 0) & (reg == 0)
        self.parts = {}
        for k, m in (("box", band > 0), ("nums", nums > 0), ("reg", reg > 0), ("word", word)):
            p = logo.copy()
            p[..., 3] = np.where(m, a, 0)
            self.parts[k] = p
        self.box_path = [(369, 73), (369, 18), (19, 18), (19, 369), (369, 369), (369, 323)]

    # ------------------------------------------------------------ footage (frame-blended speed-up, gentle push, crop)
    def footage(self, t):
        s = t * SPEED * self.src_fps
        i = min(int(s), len(self.frames) - 2)
        u = s - i
        f = cv2.addWeighted(self.frames[i], 1 - u, self.frames[i + 1], u, 0) if u > 0.01 else self.frames[i]
        zoom = 1.0 + 0.05 * e_io(prog(t, 6.2, 1.8))  # settle-in push towards the powder
        if self.fmt == "16x9":
            sc = self.W / f.shape[1] * zoom
            cx_src = f.shape[1] / 2 + (0.44 * f.shape[1] - f.shape[1] / 2) * e_io(prog(t, 6.2, 1.8))
        else:
            sc = self.H / f.shape[0] * zoom
            # follow the action: reactor/centre first, drifting to the powder jar on the left-centre at the end
            cx_src = lerp(0.52, 0.43, e_io(prog(t, 3.0, 4.5))) * f.shape[1]
        cy_src = f.shape[0] / 2 + 0.06 * f.shape[0] * e_io(prog(t, 6.2, 1.8))
        M = np.array([[sc, 0, self.W / 2 - cx_src * sc], [0, sc, self.H / 2 - cy_src * sc]], np.float32)
        out = cv2.warpAffine(f, M, (self.W, self.H), flags=cv2.INTER_LANCZOS4, borderMode=cv2.BORDER_REFLECT)
        blur = cv2.GaussianBlur(out, (0, 0), 1.2)
        return cv2.addWeighted(out, 1.3, blur, -0.3, 0)

    # ------------------------------------------------------------ logo
    def logo_frame(self, ctx, k):
        W, H = self.W, self.H
        ctx.set_source_rgb(*BG)
        ctx.paint()
        lh, lw = self.logo.shape[:2]
        sc = (0.6 if self.fmt == "16x9" else 0.8) * W / lw * (1 + 0.02 * e_out(prog(k, 0, 2.0)))
        ox, oy = W / 2 - lw * sc / 2, H / 2 - lh * sc / 2

        def draw(p):
            a = p[..., 3:4].astype(np.float32) / 255
            pm = p.astype(np.float32)
            pm[..., :3] *= a
            arr = np.ascontiguousarray(pm.astype(np.uint8))
            s = cairo.ImageSurface.create_for_data(memoryview(arr), cairo.FORMAT_ARGB32, lw, lh, arr.strides[0])
            ctx.save()
            ctx.translate(ox, oy)
            ctx.scale(sc, sc)
            ctx.set_source_surface(s, 0, 0)
            ctx.get_source().set_filter(cairo.FILTER_GOOD)
            ctx.paint()
            ctx.restore()

        def masked(name, m):
            p = self.parts[name].copy()
            p[..., 3] = (p[..., 3].astype(np.float32) * m).astype(np.uint8)
            draw(p)

        pb = e_io(prog(k, 0.0, 0.7))
        if pb > 0:
            m = np.zeros((lh, lw), np.uint8)
            L = sum(math.dist(a, b) for a, b in zip(self.box_path, self.box_path[1:]))
            rem, pts = L * pb, [self.box_path[0]]
            for p0, p1 in zip(self.box_path, self.box_path[1:]):
                d = math.dist(p0, p1)
                u = min(1, rem / d)
                pts.append((lerp(p0[0], p1[0], u), lerp(p0[1], p1[1], u)))
                rem -= d
                if rem <= 0:
                    break
            cv2.polylines(m, [np.array(pts, np.int32)], False, 255, 44)
            masked("box", m.astype(np.float32) / 255)
        pn = e_out(prog(k, 0.45, 0.35))
        if pn > 0:
            masked("nums", np.full((lh, lw), pn, np.float32))
        pw = e_io(prog(k, 0.3, 0.7))
        if pw > 0:
            xs = np.arange(lw, dtype=np.float32)
            row = np.clip((lerp(-80, lw + 80, pw) - xs) / 80, 0, 1)
            masked("word", np.repeat(row[None, :], lh, 0))
        pr = e_out(prog(k, 0.95, 0.25))
        if pr > 0:
            masked("reg", np.full((lh, lw), pr, np.float32))

    def compose(self, t):
        W, H = self.W, self.H
        s = cairo.ImageSurface(cairo.FORMAT_ARGB32, W, H)
        ctx = cairo.Context(s)
        if t < FOOT:
            f = cv2.cvtColor(self.footage(t), cv2.COLOR_BGR2BGRA)
            np.ndarray((H, W, 4), np.uint8, s.get_data(), strides=(s.get_stride(), 4, 1))[:] = f
            s.mark_dirty()
            u = e_io(prog(t, FOOT - 0.55, 0.55))  # soft fade to the card's light grey
            if u > 0:
                ctx.set_source_rgba(*BG, u)
                ctx.paint()
        else:
            self.logo_frame(ctx, t - FOOT)
        s.flush()
        return s


def audio(work: Path, out: Path):
    """Lab room tone (time-matched to the speed-up), a warm low swell into the logo, a soft chime as it lands."""
    SR = 48000
    n = int(TOTAL * SR)
    amb_raw = work / "render" / "amb_fast.wav"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(work / "render" / "amb.wav"), "-af", f"atempo={SPEED}", "-ar", str(SR), "-ac", "1", str(amb_raw)], check=True)
    a, _ = sf.read(amb_raw)
    amb = np.zeros(n)
    m = min(len(a), int(FOOT * SR))
    amb[:m] = a[:m]
    fade = int(0.6 * SR)
    amb[m - fade:m] *= np.linspace(1, 0, fade)
    amb /= max(1e-6, np.abs(amb).max())
    t = np.arange(n) / SR
    # swell: A minor-ish cluster rising from 5.6 s, peaking as the card appears, then decaying under the logo
    sw = np.zeros(n)
    for f, g in ((55.0, 1.0), (110.0, 0.6), (164.81, 0.35), (220.0, 0.25), (261.63, 0.15)):
        sw += g * np.sin(2 * np.pi * f * t + f)
    shape = np.clip((t - 5.6) / 2.4, 0, 1) ** 2 * np.where(t > 8.0, np.exp(-(t - 8.0) / 1.2), 1.0)
    sw *= shape
    # chime on the logo (8.0 s) and a tiny tick as the ® appears
    ch = np.zeros(n)
    for f in (880.0, 1318.5, 1760.0):
        ch += np.sin(2 * np.pi * f * t) * np.where(t >= 8.0, np.exp(-(t - 8.0) / 0.9), 0)
    ch *= np.where(t >= 8.0, np.minimum(1, (t - 8.0) / 0.01), 0)
    tk = np.sin(2 * np.pi * 2600 * t) * np.where(t >= 8.95, np.exp(-(t - 8.95) / 0.015), 0)
    mix = 0.45 * amb + 0.28 * sw / max(1e-6, np.abs(sw).max()) + 0.07 * ch / 3 + 0.05 * tk
    end = int(0.4 * SR)
    mix[-end:] *= np.linspace(1, 0, end)
    mix /= np.abs(mix).max() / 0.9
    sf.write(out, np.stack([mix, mix], 1), SR)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("work", type=Path)
    ap.add_argument("--format", choices=list(SIZES), default="16x9")
    ap.add_argument("--stills", nargs="*", type=float)
    a = ap.parse_args()
    post = Post(a.work, a.format)
    R = a.work / "render"
    if a.stills is not None:
        for t in a.stills:
            post.compose(t).write_to_png(str(R / f"{a.format}_still_{t:05.2f}.png"))
        return
    vid = R / f"{a.format}_video.mp4"
    p = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgra", "-s", f"{post.W}x{post.H}", "-r", str(FPS), "-i", "-",
                          "-c:v", "libx264", "-preset", "medium", "-crf", "16", "-pix_fmt", "yuv420p", "-an", str(vid)], stdin=subprocess.PIPE)
    for i in range(int(TOTAL * FPS)):
        p.stdin.write(bytes(post.compose(i / FPS).get_data()))
    p.stdin.close()
    assert p.wait() == 0
    wav = R / "bts_audio.wav"
    if not wav.exists():
        audio(a.work, wav)
    out = R / f"scimplify_bts_{a.format}.mp4"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(vid), "-i", str(wav), "-map", "0:v", "-map", "1:a", "-c:v", "copy",
                    "-af", "loudnorm=I=-16:TP=-1.5:LRA=9,aresample=48000", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", str(out)], check=True)
    print("done:", out)


if __name__ == "__main__":
    main()
