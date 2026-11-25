"""Scimplify — dark "something's cooking" teaser (LinkedIn 16:9). No text; ends on the white logo out of black.

    python studio/reels/scimplify_teaser.py studio/work/scimplify3                 # → render/scimplify_teaser.mp4
    python studio/reels/scimplify_teaser.py studio/work/scimplify3 --stills 0.4 3 4.6 6.8 7.6 8.4 9.3

Inputs: render/clean.mp4 (Gemini shot, sparkle removed), render/track.json (face + lamp positions, 720p),
../scimplify/logo_color.png (alpha used as the white logo's shape).

Look: 2.39:1 letterbox, crushed blacks with teal shadows / amber highlights, halation, vignette, live grain;
the worker's face is softened (tracked) so he stays an anonymous figure; an anamorphic streak rides the lamp.
Beats: fade up from black with a focus pull (0–1.1) · slow drift · a thin teal bracket briefly frames the
bench under the lamp (3.4–5.6) · the image sinks to black around a single teal dot (6.5–7.4) · the dot
draws the logo box, the wordmark lights up, ® · hold.
"""
import argparse
import json
import math
import subprocess
from pathlib import Path

import cairo
import cv2
import numpy as np
import soundfile as sf

W, H, FPS = 1920, 1080, 24
SRC_OFF = 0.55            # footage time = t + SRC_OFF
FOOT_END = 7.4            # cut to the black card
TOTAL = 9.75
BAR = 138                 # 2.39:1 letterbox
TEAL = (0x03 / 255, 0xBE / 255, 0xA9 / 255)
TEAL_LT = (0x5F / 255, 0xE3 / 255, 0xD2 / 255)
SQ = [(1.0, 0.157), (1.0, 0.0), (0.0, 0.0), (0.0, 1.0), (1.0, 1.0), (1.0, 0.869)]


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


def e_back(x, s=1.7):
    x -= 1
    return x * x * ((s + 1) * x + s) + 1


def lerp(a, b, u):
    return a + (b - a) * u


def interp_track(d: dict, t: float, smooth=0.5):
    ks = np.array(sorted(float(k) for k in d))
    vs = np.array([d[f"{k}" if f"{k}" in d else str(k)] if str(k) in d else d[min(d, key=lambda s: abs(float(s) - k))] for k in ks], np.float32)
    # gaussian-weighted average of samples around t → smooth, robust to missed/odd detections
    w = np.exp(-((ks - t) / smooth) ** 2)
    return (vs * w[:, None]).sum(0) / max(w.sum(), 1e-6)


class Teaser:
    def __init__(self, work: Path):
        cap = cv2.VideoCapture(str(work / "render" / "clean.mp4"))
        self.frames = []
        while True:
            ok, f = cap.read()
            if not ok:
                break
            self.frames.append(f)
        tr = json.loads((work / "render" / "track.json").read_text())
        self.faces, self.lamps = tr["faces"], tr["lamps"]
        logo = cv2.imread(str(work.parent / "scimplify" / "logo_color.png"), cv2.IMREAD_UNCHANGED)
        a = logo[..., 3]
        h, w = a.shape
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
        self.la = {k: np.where(m, a, 0).astype(np.float32) / 255 for k, m in (("box", band > 0), ("nums", nums > 0), ("reg", reg > 0), ("word", word))}
        self.lw, self.lh = w, h
        self.lsc = 0.5 * W / w
        self.lo = (W / 2 - w * self.lsc / 2, H / 2 - h * self.lsc / 2)
        self.box_path = [(369, 73), (369, 18), (19, 18), (19, 369), (369, 369), (369, 323)]
        yy, xx = np.mgrid[0:H, 0:W]
        r = np.hypot((xx - W / 2) / (W / 2), (yy - H / 2) / (H / 2))
        self.vig = (1 - 0.55 * np.clip(r - 0.35, 0, 1) ** 1.6).astype(np.float32)[..., None]
        self.rng = np.random.default_rng(9)
        # one grain plate per few frames, cycled (cheap, still alive)
        self.grain = [cv2.GaussianBlur(self.rng.normal(0, 1, (H // 2, W // 2)).astype(np.float32), (0, 0), 0.6) for _ in range(8)]
        # grade LUT: crush, gentle S-curve
        x = np.arange(256, dtype=np.float32) / 255
        y = np.clip((x - 0.035) / 0.965, 0, 1)
        y = y ** 1.12
        y = 0.5 + (y - 0.5) * 1.08
        self.lut = (np.clip(y, 0, 1) * 255).astype(np.uint8)

    # ------------------------------------------------------------ footage + grade
    def footage(self, t):
        s = (t + SRC_OFF) * 24
        i = min(int(s), len(self.frames) - 2)
        u = s - i
        f = cv2.addWeighted(self.frames[i], 1 - u, self.frames[i + 1], u, 0)
        src_t = (t + SRC_OFF)
        # soften the face (tracked, 720p coords) so he stays an anonymous figure
        fx, fy, fw, fh = interp_track(self.faces, src_t, 0.45)
        cx, cy = fx + fw / 2, fy + fh * 0.55
        m = np.zeros(f.shape[:2], np.float32)
        cv2.ellipse(m, (int(cx), int(cy)), (int(fw * 1.0), int(fh * 1.25)), 0, 0, 360, 1.0, -1)
        m = cv2.GaussianBlur(m, (0, 0), fw * 0.35)[..., None]
        soft = cv2.GaussianBlur(f, (0, 0), 3.2)
        f = (f * (1 - m) + soft * m).astype(np.uint8)
        # slow push-in on top of the camera move, centred a little left (bench under the lamp)
        z = 1.02 + 0.045 * (t / FOOT_END)
        sc = W / f.shape[1] * z
        cxs, cys = f.shape[1] * 0.47, f.shape[0] * 0.48
        M = np.array([[sc, 0, W / 2 - cxs * sc], [0, sc, H / 2 - cys * sc]], np.float32)
        f = cv2.warpAffine(f, M, (W, H), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REFLECT)
        # focus pull at the open: starts soft, resolves
        blur = 9 * (1 - e_out(prog(t, 0.15, 1.1)))
        if blur > 0.3:
            f = cv2.GaussianBlur(f, (0, 0), blur)
        # grade
        f = cv2.LUT(f, self.lut).astype(np.float32) / 255
        lum = f.mean(2, keepdims=True)
        shadow = np.clip(1 - lum * 2.2, 0, 1)
        high = np.clip((lum - 0.45) * 2, 0, 1)
        f = f + shadow * np.array([0.022, 0.012, -0.004]) * 1.0  # BGR: teal into shadows
        f = f + high * np.array([-0.03, 0.0, 0.035])               # amber into highlights
        # halation: warm bloom from the brightest parts
        hi = np.clip(lum - 0.6, 0, 1) * 2.2
        bloom = cv2.GaussianBlur(hi, (0, 0), 22)[..., None] if hi.ndim == 2 else cv2.GaussianBlur(hi[..., 0], (0, 0), 22)[..., None]
        f = f + bloom * np.array([0.10, 0.28, 0.55]) * 0.55
        f = f * self.vig * 0.92
        g = cv2.resize(self.grain[int(t * FPS) % len(self.grain)], (W, H), interpolation=cv2.INTER_LINEAR)[..., None]
        f = f + g * 0.022 * (0.6 + 0.4 * (1 - lum))
        # fade up / sink to black
        f = f * e_io(prog(t, 0.0, 1.0)) * (1 - e_io(prog(t, 6.45, 0.95)))
        return np.clip(f * 255, 0, 255).astype(np.uint8)

    # ------------------------------------------------------------ overlays
    def flare(self, ctx, t):
        x, y, v = interp_track(self.lamps, t + SRC_OFF, 0.3)
        a = 0.55 * e_io(prog(t, 0.6, 0.8)) * (1 - e_io(prog(t, 6.3, 0.8))) * (0.92 + 0.08 * math.sin(t * 11) * math.sin(t * 3.3))
        if a <= 0:
            return
        z = 1.02 + 0.045 * (t / FOOT_END)
        sc = W / 1280 * z
        X = W / 2 + (x - 1280 * 0.47) * sc
        Y = H / 2 + (y + 6 - 720 * 0.48) * sc
        for width, height, col, al in ((480, 6, (1.0, 0.78, 0.45), 0.28), (300, 2.0, (0.75, 0.95, 1.0), 0.32), (150, 24, (1.0, 0.85, 0.6), 0.16)):
            g = cairo.LinearGradient(X - width, 0, X + width, 0)
            g.add_color_stop_rgba(0, *col, 0)
            g.add_color_stop_rgba(0.5, *col, al * a)
            g.add_color_stop_rgba(1, *col, 0)
            ctx.save()
            ctx.translate(X, Y)
            ctx.scale(1, height / width)
            ctx.arc(0, 0, width, 0, 2 * math.pi)
            ctx.restore()
            ctx.set_source(g)
            ctx.fill()

    def bracket(self, ctx, x, y, s, p, width, a):
        if p <= 0 or a <= 0:
            return
        pts = [(x + u * s, y + v * s) for u, v in SQ]
        L = sum(math.dist(p0, p1) for p0, p1 in zip(pts, pts[1:]))
        rem = L * clamp(p)
        ctx.set_line_width(width)
        ctx.set_source_rgba(*TEAL_LT, a)
        ctx.move_to(*pts[0])
        for p0, p1 in zip(pts, pts[1:]):
            d = math.dist(p0, p1)
            u = min(1, rem / d)
            ctx.line_to(lerp(p0[0], p1[0], u), lerp(p0[1], p1[1], u))
            rem -= d
            if rem <= 0:
                break
        ctx.stroke()

    def frame_the_bench(self, ctx, t):
        """A thin teal bracket briefly frames the bench under the lamp (around the worker's hands), then retracts."""
        t0, t1 = 3.4, 5.6
        if not (t0 <= t <= t1):
            return
        fx, fy, fw, fh = interp_track(self.faces, t + SRC_OFF, 0.45)
        z = 1.02 + 0.045 * (t / FOOT_END)
        sc = W / 1280 * z
        cx = W / 2 + (fx + fw * 0.5 - 1280 * 0.47) * sc
        cy = H / 2 + (fy + fh * 2.3 - 720 * 0.48) * sc  # hands/bench, below the face
        s = 300 * lerp(1.18, 1.0, e_out(prog(t, t0, 0.5)))
        p = e_io(prog(t, t0, 0.55)) - e_io(prog(t, t1 - 0.5, 0.5))
        a = 0.85 * (1 - prog(t, t1 - 0.3, 0.3))
        if p > 0:
            self.bracket(ctx, cx - s / 2, cy - s / 2, s, p if t < t1 - 0.5 else 1.0, 3.0, a * (p if t >= t1 - 0.5 else 1))
        # tiny dot at the open corner, breathing
        q = prog(t, t0 + 0.5, 1.0)
        if 0 < q and t < t1 - 0.3:
            dx, dy = cx + s / 2, cy - s / 2 + 0.157 * s
            ctx.arc(dx, dy, 4.5, 0, 2 * math.pi)
            ctx.set_source_rgba(*TEAL_LT, 0.9)
            ctx.fill()
            for k in (0.0, 0.5):
                w = (q * 1.5 + k) % 1
                ctx.arc(dx, dy, 5 + 20 * w, 0, 2 * math.pi)
                ctx.set_source_rgba(*TEAL_LT, 0.6 * (1 - w))
                ctx.set_line_width(1.5)
                ctx.stroke()

    def letterbox(self, ctx, t):
        ctx.set_source_rgb(0, 0, 0)
        ctx.rectangle(0, 0, W, BAR)
        ctx.rectangle(0, H - BAR, W, BAR)
        ctx.fill()

    # ------------------------------------------------------------ the black card
    def dot_xy(self):
        x0, y0 = self.lo
        return x0 + 369 * self.lsc, y0 + 73 * self.lsc

    def ending_dot(self, ctx, t):
        """As the image sinks, a single teal dot appears where the logo box will start, breathing."""
        a = e_out(prog(t, 6.75, 0.35))
        if a <= 0 or t >= FOOT_END:
            return
        x, y = self.dot_xy()
        r = 7 * e_back(prog(t, 6.75, 0.3))
        g = cairo.RadialGradient(x, y, 0, x, y, 70)
        g.add_color_stop_rgba(0, *TEAL, 0.35 * a)
        g.add_color_stop_rgba(1, *TEAL, 0)
        ctx.set_source(g)
        ctx.arc(x, y, 70, 0, 2 * math.pi)
        ctx.fill()
        ctx.arc(x, y, r, 0, 2 * math.pi)
        ctx.set_source_rgba(*TEAL_LT, a)
        ctx.fill()

    def card(self, ctx, k):
        ctx.set_source_rgb(0, 0, 0)
        ctx.paint()
        lw, lh, sc = self.lw, self.lh, self.lsc
        x0, y0 = self.lo
        # glow behind the logo, swelling once
        gl = e_out(prog(k, 0.0, 0.8)) * (1 - 0.6 * e_io(prog(k, 0.9, 1.2)))
        g = cairo.RadialGradient(W / 2, H / 2, 0, W / 2, H / 2, 760)
        g.add_color_stop_rgba(0, *TEAL, 0.16 * gl)
        g.add_color_stop_rgba(1, *TEAL, 0)
        ctx.set_source(g)
        ctx.paint()

        def paint_alpha(alpha, rgb=(1, 1, 1)):
            a8 = np.ascontiguousarray((np.clip(alpha, 0, 1) * 255).astype(np.uint8))
            stride = cairo.ImageSurface.format_stride_for_width(cairo.FORMAT_A8, lw)
            buf = np.zeros((lh, stride), np.uint8)
            buf[:, :lw] = a8
            s = cairo.ImageSurface.create_for_data(memoryview(buf), cairo.FORMAT_A8, lw, lh, stride)
            ctx.save()
            ctx.translate(x0, y0)
            ctx.scale(sc, sc)
            ctx.set_source_rgb(*rgb)
            ctx.mask_surface(s, 0, 0)
            ctx.restore()

        # box: drawn from the dot along its path; the leading edge glows teal
        pb = e_io(prog(k, 0.0, 0.75))
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
        if len(pts) > 1:
            cv2.polylines(m, [np.array(pts, np.int32)], False, 255, 44)
            paint_alpha(self.la["box"] * m / 255)
            if pb < 1:
                hx, hy = pts[-1]
                X, Y = x0 + hx * sc, y0 + hy * sc
                hg = cairo.RadialGradient(X, Y, 0, X, Y, 40)
                hg.add_color_stop_rgba(0, *TEAL_LT, 0.9)
                hg.add_color_stop_rgba(1, *TEAL, 0)
                ctx.set_source(hg)
                ctx.arc(X, Y, 40, 0, 2 * math.pi)
                ctx.fill()
        pn = e_out(prog(k, 0.6, 0.35))
        if pn > 0:
            paint_alpha(self.la["nums"] * pn)
        # wordmark lights up left→right, slightly blurred edge, like light passing over it
        pw = e_io(prog(k, 0.45, 0.8))
        if pw > 0:
            xs = np.arange(lw, dtype=np.float32)
            row = np.clip((lerp(-120, lw + 120, pw) - xs) / 120, 0, 1)
            paint_alpha(self.la["word"] * row[None, :])
        pr = e_out(prog(k, 1.2, 0.25))
        if pr > 0:
            paint_alpha(self.la["reg"] * pr)
        # final sheen across the wordmark
        u = prog(k, 1.45, 0.65)
        if 0 < u < 1:
            xs = np.arange(lw, dtype=np.float32)[None, :]
            ys = np.arange(lh, dtype=np.float32)[:, None]
            band = np.exp(-(((xs + ys * 0.35) - lerp(-150, lw + 150, e_io(u))) / 40) ** 2)
            paint_alpha(self.la["word"] * band * 0.9, TEAL_LT)

    # ------------------------------------------------------------ compose
    def compose(self, t):
        s = cairo.ImageSurface(cairo.FORMAT_ARGB32, W, H)
        ctx = cairo.Context(s)
        if t < FOOT_END:
            f = cv2.cvtColor(self.footage(t), cv2.COLOR_BGR2BGRA)
            np.ndarray((H, W, 4), np.uint8, s.get_data(), strides=(s.get_stride(), 4, 1))[:] = f
            s.mark_dirty()
            self.flare(ctx, t)
            self.frame_the_bench(ctx, t)
            self.letterbox(ctx, t)
            self.ending_dot(ctx, t)
        else:
            self.card(ctx, t - FOOT_END)
        s.flush()
        return s


def audio(work: Path, out: Path):
    """Room tone, a slow simmer, a low pulse that quickens, a riser, a suck-out, then the hit and a low ring."""
    SR = 48000
    n = int(TOTAL * SR)
    t = np.arange(n) / SR
    rng = np.random.default_rng(21)
    raw = work / "render" / "amb.wav"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", str(SRC_OFF), "-i", str(work / "in" / "src.mp4"), "-vn", "-ac", "1", "-ar", str(SR), str(raw)], check=True)
    a, _ = sf.read(raw)
    amb = np.zeros(n)
    m = min(len(a), int(FOOT_END * SR))
    amb[:m] = a[:m]
    amb /= max(1e-6, np.abs(amb).max())
    amb *= np.clip(t / 1.0, 0, 1) * np.clip((7.2 - t) / 0.8, 0, 1)

    def env(at, att, dec):
        return np.where(t >= at, np.minimum(1, (t - at) / att) * np.exp(-(t - at) / dec), 0)

    def lp(x, alpha):
        y = np.zeros_like(x)
        acc = 0.0
        for i, v in enumerate(x):
            acc += alpha * (v - acc)
            y[i] = acc
        return y

    drone = (np.sin(2 * np.pi * 41.2 * t) + 0.6 * np.sin(2 * np.pi * 61.7 * t + 1) + 0.25 * np.sin(2 * np.pi * 123.5 * t)) / 1.85
    drone *= np.clip(t / 2.0, 0, 1) * (0.5 + 0.5 * np.clip((t - 3) / 4, 0, 1)) * np.clip((7.3 - t) / 0.2, 0, 1)

    # simmer: sparse soft bubble pops (rising sine chirps), denser later
    simmer = np.zeros(n)
    k = 1.6
    while k < 7.1:
        f0 = rng.uniform(380, 900)
        L = int(rng.uniform(0.02, 0.05) * SR)
        tt = np.arange(L) / SR
        chirp = np.sin(2 * np.pi * (f0 * tt + 4000 * tt ** 2)) * np.exp(-tt / 0.012)
        i = int(k * SR)
        simmer[i:i + L] += chirp * rng.uniform(0.3, 1)
        k += rng.uniform(0.05, 0.22) * (1.4 - (k - 1.6) / 6)

    # pulses, quickening into the cut
    pulses = np.zeros(n)
    for at in (1.3, 2.7, 3.9, 4.8, 5.5, 6.0, 6.4, 6.75, 7.02):
        fr = 52 + 30 * np.exp(-np.clip(t - at, 0, None) / 0.04)
        pulses += np.sin(2 * np.pi * np.cumsum(fr) / SR) * env(at, 0.004, 0.22)

    # riser into the cut, then a short suck-out (silence) before the hit
    noise = rng.standard_normal(n)
    riser = lp(noise, 0.08) * np.clip((t - 5.6) / 1.65, 0, 1) ** 2.5 * (t < 7.28)
    hit_t = FOOT_END
    hit_fr = 36 + 34 * np.exp(-np.clip(t - hit_t, 0, None) / 0.07)
    hit = np.sin(2 * np.pi * np.cumsum(hit_fr) / SR) * env(hit_t, 0.003, 0.9)
    hit += lp(noise, 0.04) * env(hit_t, 0.002, 0.35) * 0.8
    ring = sum(g * np.sin(2 * np.pi * f * t) for f, g in ((110.0, 1), (164.81, 0.6), (220.0, 0.35), (659.25, 0.12))) * env(hit_t + 0.05, 0.4, 1.6)
    tick = np.sin(2 * np.pi * 2800 * t) * env(hit_t + 1.2, 0.001, 0.02)
    sheen = sum(np.sin(2 * np.pi * f * t) for f in (1760.0, 2637.0)) * env(hit_t + 1.45, 0.25, 0.5)

    mix = 0.30 * amb + 0.30 * drone + 0.05 * simmer + 0.55 * pulses + 0.20 * riser + 0.9 * hit + 0.12 * ring + 0.05 * tick + 0.025 * sheen
    end = int(0.4 * SR)
    mix[-end:] *= np.linspace(1, 0, end)
    mix /= np.abs(mix).max() / 0.9
    sf.write(out, np.stack([mix, mix], 1), SR)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("work", type=Path)
    ap.add_argument("--stills", nargs="*", type=float)
    a = ap.parse_args()
    tz = Teaser(a.work)
    R = a.work / "render"
    if a.stills is not None:
        for t in a.stills:
            tz.compose(t).write_to_png(str(R / f"t_{t:05.2f}.png"))
        return
    vid = R / "video.mp4"
    p = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgra", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
                          "-c:v", "libx264", "-preset", "medium", "-crf", "15", "-tune", "grain", "-pix_fmt", "yuv420p", "-an", str(vid)], stdin=subprocess.PIPE)
    for i in range(int(round(TOTAL * FPS))):
        p.stdin.write(bytes(tz.compose(i / FPS).get_data()))
    p.stdin.close()
    assert p.wait() == 0
    wav = R / "audio.wav"
    audio(a.work, wav)
    out = R / "scimplify_teaser.mp4"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(vid), "-i", str(wav), "-map", "0:v", "-map", "1:a", "-c:v", "copy",
                    "-af", "loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", str(out)], check=True)
    print("done:", out)


if __name__ == "__main__":
    main()
