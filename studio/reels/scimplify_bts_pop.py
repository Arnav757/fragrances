"""Scimplify BTS lab post, LinkedIn cut (16:9) with motion graphics in the logo's language — still no text.

    python studio/reels/scimplify_bts_pop.py studio/work/scimplify2            # → render/scimplify_bts_linkedin.mp4
    python studio/reels/scimplify_bts_pop.py studio/work/scimplify2 --stills 0.3 0.7 5.8 7.6 8.0 9.4

Beats:
  0.0–1.0  Open through the element tile: the logo's open-sided square draws on white, then scales up and the
           lab shot is revealed through it.
  1.0–5.2  The shot breathes: slow drifting light motes, nothing else.
  5.2–7.4  Lock-on: the same bracket draws around the jar of MREO powder, tracks it (measured from the footage,
           render/jar.json), a scan line passes once, a teal dot pulses at the corner.
  7.4–8.3  The bracket flies to the centre and becomes the logo's box while the shot fades to the card grey.
  8.3–10   Atomic numbers, wordmark wipe, ®, one light sweep across the wordmark.
"""
import argparse
import json
import math
import subprocess
import sys
from pathlib import Path

import cairo
import cv2
import numpy as np
import soundfile as sf

sys.path.insert(0, str(Path(__file__).resolve().parent))
from scimplify_bts import BG, FPS, TOTAL, Post, clamp, e_io, e_out, lerp, prog  # noqa: E402

TEAL = (0x03 / 255, 0xBE / 255, 0xA9 / 255)
DEEP = (0x00 / 255, 0x5F / 255, 0x59 / 255)
OPEN_END, LOCK_T, MORPH_T, MORPH_D = 1.0, 5.2, 7.35, 0.95
CARD_T = MORPH_T + MORPH_D  # logo box fully placed
# open-right square, as in the logo: right side has a gap between 15.7 % and 86.9 % of its height
SQ = [(1.0, 0.157), (1.0, 0.0), (0.0, 0.0), (0.0, 1.0), (1.0, 1.0), (1.0, 0.869)]


def e_back(x, s=1.6):
    x -= 1
    return x * x * ((s + 1) * x + s) + 1


def grad(x0, y0, x1, y1, a=1.0):
    g = cairo.LinearGradient(x0, y0, x1, y1)
    g.add_color_stop_rgba(0, *TEAL, a)
    g.add_color_stop_rgba(1, *DEEP, a)
    return g


def bracket(ctx, x, y, s, p, width, a=1.0):
    """The logo's open-sided square, drawn on to fraction p, outer-aligned to the box (x, y, s)."""
    if p <= 0 or s <= 1:
        return
    pts = [(x + u * s, y + v * s) for u, v in SQ]
    L = sum(math.dist(a_, b_) for a_, b_ in zip(pts, pts[1:]))
    rem = L * clamp(p)
    ctx.save()
    ctx.set_line_width(width)
    ctx.set_line_cap(cairo.LINE_CAP_BUTT)
    ctx.set_line_join(cairo.LINE_JOIN_MITER)
    ctx.set_source(grad(x, y, x + s, y + s, a))
    ctx.move_to(*pts[0])
    for p0, p1 in zip(pts, pts[1:]):
        d = math.dist(p0, p1)
        u = min(1, rem / d)
        ctx.line_to(lerp(p0[0], p1[0], u), lerp(p0[1], p1[1], u))
        rem -= d
        if rem <= 0:
            break
    ctx.stroke()
    ctx.restore()


class Pop(Post):
    def __init__(self, work: Path):
        super().__init__(work, "16x9")
        # jar of MREO powder, measured by eye from frames (centre x, centre y, square side incl. margin)
        self.track_t = np.array([4.8, 5.5, 6.0, 6.2, 7.0, 7.9])
        self.track = np.array([[1040, 830, 330], [998, 758, 410], [985, 730, 430], [988, 718, 450], [990, 678, 540], [1075, 640, 560]], np.float32)
        rng = np.random.default_rng(3)
        self.motes = rng.uniform([0, 0, 2, 0.15, 0], [1920, 1080, 6, 0.5, 6.28], (36, 5))
        lh, lw = self.logo.shape[:2]
        self.card_sc = 0.6 * self.W / lw
        self.card_o = (self.W / 2 - lw * self.card_sc / 2, self.H / 2 - lh * self.card_sc / 2)

    def jar_box(self, t):
        cx, cy, side = (np.interp(t, self.track_t, self.track[:, j]) for j in range(3))
        return cx - side / 2, cy - side / 2, side

    def logo_box(self, k_scale=1.0):
        """Outer square of the logo box at the end-card placement (logo pixels 2..386)."""
        sc = self.card_sc * k_scale
        lh, lw = self.logo.shape[:2]
        ox, oy = self.W / 2 - lw * sc / 2, self.H / 2 - lh * sc / 2
        return ox + 3 * sc, oy + 2 * sc, 383 * sc, 33 * sc

    # ------------------------------------------------------------ layers
    def motes_layer(self, ctx, t):
        a = prog(t, 1.0, 0.8) * (1 - prog(t, 6.6, 0.8))
        if a <= 0:
            return
        for x, y, r, op, ph in self.motes:
            xx = (x + 22 * t + 14 * math.sin(t * 0.7 + ph)) % 1920
            yy = (y - 16 * t + 10 * math.cos(t * 0.5 + ph)) % 1080
            g = cairo.RadialGradient(xx, yy, 0, xx, yy, r * 3)
            g.add_color_stop_rgba(0, 1, 1, 1, op * a * (0.6 + 0.4 * math.sin(t * 2 + ph)))
            g.add_color_stop_rgba(1, 1, 1, 1, 0)
            ctx.set_source(g)
            ctx.arc(xx, yy, r * 3, 0, 2 * math.pi)
            ctx.fill()

    def opener(self, ctx, t, surf_w_footage):
        """White card with the bracket drawing on; then the footage is revealed inside the growing square."""
        s0 = 240
        draw = e_io(prog(t, 0.05, 0.45))
        grow = e_io(prog(t, 0.45, 0.55))
        s = lerp(s0, 3200, grow)
        x, y = self.W / 2 - s / 2, self.H / 2 - s / 2
        # footage inside the square, white outside
        ctx.set_source_rgb(*BG)
        ctx.paint()
        if grow > 0:
            ctx.save()
            ctx.rectangle(x + 6, y + 6, s - 12, s - 12)
            ctx.clip()
            ctx.set_source_surface(surf_w_footage, 0, 0)
            ctx.paint()
            ctx.restore()
        else:  # a hint of the lab already inside the tile before it opens
            ctx.save()
            ctx.rectangle(x + 6, y + 6, s - 12, s - 12)
            ctx.clip()
            ctx.set_source_surface(surf_w_footage, 0, 0)
            ctx.paint_with_alpha(e_out(prog(t, 0.3, 0.2)))
            ctx.restore()
        bracket(ctx, x, y, s, draw, lerp(12, 40, grow))
        # the dot that starts it
        r = 9 * e_back(prog(t, 0.0, 0.2)) * (1 - prog(t, 0.25, 0.15))
        if r > 0:
            ctx.arc(x + s, y + 0.157 * s, r, 0, 2 * math.pi)
            ctx.set_source_rgb(*TEAL)
            ctx.fill()

    def lock_on(self, ctx, t):
        if t < LOCK_T or t >= MORPH_T + MORPH_D:
            return
        if t < MORPH_T:
            x, y, s = self.jar_box(t)
            p = e_io(prog(t, LOCK_T, 0.6))
            # snap-in: starts 25 % larger and settles
            k = lerp(1.25, 1.0, e_out(prog(t, LOCK_T, 0.5)))
            cx, cy = x + s / 2, y + s / 2
            s *= k
            x, y = cx - s / 2, cy - s / 2
            bracket(ctx, x, y, s, p, 9)
            # scan line once, inside the box
            u = prog(t, LOCK_T + 0.55, 0.7)
            if 0 < u < 1:
                yy = y + 14 + (s - 28) * e_io(u)
                g = cairo.LinearGradient(x, 0, x + s, 0)
                g.add_color_stop_rgba(0, *TEAL, 0)
                g.add_color_stop_rgba(0.5, *TEAL, 0.9)
                g.add_color_stop_rgba(1, *TEAL, 0)
                ctx.set_source(g)
                ctx.rectangle(x + 12, yy - 1.5, s - 24, 3)
                ctx.fill()
                band = cairo.LinearGradient(0, yy - 60, 0, yy)
                band.add_color_stop_rgba(0, *TEAL, 0)
                band.add_color_stop_rgba(1, *TEAL, 0.16)
                ctx.set_source(band)
                ctx.rectangle(x + 12, yy - 60, s - 24, 60)
                ctx.fill()
            # pulse at the open corner
            ph = prog(t, LOCK_T + 0.5, 1.6)
            if ph > 0:
                for d in (0.0, 0.5):
                    q = (ph * 2 + d) % 1
                    ctx.arc(x + s, y + 0.157 * s, 7 + 26 * q, 0, 2 * math.pi)
                    ctx.set_source_rgba(*TEAL, 0.8 * (1 - q))
                    ctx.set_line_width(2.5)
                    ctx.stroke()
                ctx.arc(x + s, y + 0.157 * s, 7, 0, 2 * math.pi)
                ctx.set_source_rgb(*TEAL)
                ctx.fill()
        else:
            u = e_io(prog(t, MORPH_T, MORPH_D))
            x0, y0, s0 = self.jar_box(MORPH_T)
            x1, y1, s1, w1 = self.logo_box()
            # overshoot slightly on size for a settled landing
            k = 1 + 0.05 * math.sin(math.pi * prog(t, MORPH_T + MORPH_D * 0.6, MORPH_D * 0.4))
            s = lerp(s0, s1, u) * k
            x = lerp(x0 + s0 / 2, x1 + s1 / 2, u) - s / 2
            y = lerp(y0 + s0 / 2, y1 + s1 / 2, u) - s / 2
            # stroke centred on the logo's stroke when it lands: offset inward by half the width
            w = lerp(9, w1, u)
            bracket(ctx, x + w / 2 * u, y + w / 2 * u, s - w * u, 1.0, w)

    # ------------------------------------------------------------ frame
    def compose(self, t):
        W, H = self.W, self.H
        s = cairo.ImageSurface(cairo.FORMAT_ARGB32, W, H)
        ctx = cairo.Context(s)
        foot = None
        if t < CARD_T:
            foot = cairo.ImageSurface(cairo.FORMAT_ARGB32, W, H)
            f = cv2.cvtColor(self.footage(min(t, 7.99)), cv2.COLOR_BGR2BGRA)
            np.ndarray((H, W, 4), np.uint8, foot.get_data(), strides=(foot.get_stride(), 4, 1))[:] = f
            foot.mark_dirty()
        if t < OPEN_END:
            self.opener(ctx, t, foot)
        elif t < CARD_T:
            ctx.set_source_surface(foot, 0, 0)
            ctx.paint()
            self.motes_layer(ctx, t)
            fade = e_io(prog(t, MORPH_T + 0.1, MORPH_D * 0.75))
            if fade > 0:
                ctx.set_source_rgba(*BG, fade)
                ctx.paint()
            self.lock_on(ctx, t)
        else:
            self.card(ctx, t - CARD_T)
        s.flush()
        return s

    def card(self, ctx, k):
        """End card from the landed box: numbers, wordmark wipe, ®, one light sweep."""
        W, H = self.W, self.H
        ctx.set_source_rgb(*BG)
        ctx.paint()
        lh, lw = self.logo.shape[:2]
        sc = self.card_sc
        ox, oy = self.card_o

        def draw(p, alpha_mul=None):
            if alpha_mul is not None:
                p = p.copy()
                p[..., 3] = (p[..., 3].astype(np.float32) * alpha_mul).astype(np.uint8)
            a = p[..., 3:4].astype(np.float32) / 255
            pm = p.astype(np.float32)
            pm[..., :3] *= a
            arr = np.ascontiguousarray(pm.astype(np.uint8))
            sf_ = cairo.ImageSurface.create_for_data(memoryview(arr), cairo.FORMAT_ARGB32, lw, lh, arr.strides[0])
            ctx.save()
            ctx.translate(ox, oy)
            ctx.scale(sc, sc)
            ctx.set_source_surface(sf_, 0, 0)
            ctx.get_source().set_filter(cairo.FILTER_GOOD)
            ctx.paint()
            ctx.restore()

        draw(self.parts["box"])
        pn = e_out(prog(k, 0.15, 0.3))
        if pn > 0:
            draw(self.parts["nums"], pn)
        pw = e_io(prog(k, 0.0, 0.6))
        if pw > 0:
            xs = np.arange(lw, dtype=np.float32)
            row = np.clip((lerp(-80, lw + 80, pw) - xs) / 80, 0, 1)
            draw(self.parts["word"], np.repeat(row[None, :], lh, 0))
        pr = e_out(prog(k, 0.6, 0.25))
        if pr > 0:
            draw(self.parts["reg"], pr)
        # one light sweep across the wordmark
        u = prog(k, 0.85, 0.6)
        if 0 < u < 1:
            word = self.parts["word"][..., 3].astype(np.float32) / 255
            xs = np.arange(lw, dtype=np.float32)[None, :]
            ys = np.arange(lh, dtype=np.float32)[:, None]
            band = np.exp(-(((xs + ys * 0.35) - lerp(-150, lw + 150, e_io(u))) / 38) ** 2)
            p = np.zeros((lh, lw, 4), np.uint8)
            p[..., :3] = 255
            p[..., 3] = (word * band * 170).astype(np.uint8)
            draw(p)


def audio(work: Path, out: Path):
    SR = 48000
    n = int(TOTAL * SR)
    t = np.arange(n) / SR
    rng = np.random.default_rng(5)
    from scimplify_bts import SPEED
    amb_raw = work / "render" / "amb_fast.wav"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(work / "render" / "amb.wav"), "-af", f"atempo={SPEED}", "-ar", str(SR), "-ac", "1", str(amb_raw)], check=True)
    a, _ = sf.read(amb_raw)
    amb = np.zeros(n)
    m = min(len(a), int(7.99 * SR))
    amb[:m] = a[:m]
    amb *= np.clip((t - 0.35) / 0.5, 0, 1) * np.clip((MORPH_T + 0.7 - t) / 0.7, 0, 1)
    amb /= max(1e-6, np.abs(amb).max())

    def env(at, a_, d):
        return np.where(t >= at, np.minimum(1, (t - at) / a_) * np.exp(-(t - at) / d), 0)

    def tone(fs, at, a_, d):
        return sum(np.sin(2 * np.pi * f * t) for f in fs) / len(fs) * env(at, a_, d)

    def whoosh(at, length, g):
        x = rng.standard_normal(n)
        y = np.zeros(n)
        i0, i1 = int(at * SR), min(n, int((at + length) * SR))
        acc = 0.0
        for i in range(i0, i1):
            c = 0.01 + 0.3 * ((i - i0) / (i1 - i0))
            acc += c * (x[i] - acc)
            y[i] = acc
        y[i0:i1] *= np.linspace(0, 1, i1 - i0) ** 2
        return g * y

    def thump(at, g):
        fr = 45 + 40 * np.exp(-np.clip(t - at, 0, None) / 0.05)
        ph = 2 * np.pi * np.cumsum(fr) / SR
        return g * np.sin(ph) * env(at, 0.003, 0.35)

    # low drone under the shot, swelling into the morph
    drone = (np.sin(2 * np.pi * 55 * t) + 0.5 * np.sin(2 * np.pi * 82.41 * t) + 0.3 * np.sin(2 * np.pi * 110 * t)) / 1.8
    drone *= np.clip((t - 0.9) / 2.5, 0, 1) * (0.35 + 0.65 * np.clip((t - 5.0) / 3.0, 0, 1)) * np.where(t > CARD_T, np.exp(-(t - CARD_T) / 0.9), 1)
    mix = 0.42 * amb + 0.22 * drone
    mix += tone([1760.0], 0.02, 0.002, 0.08) * 0.10            # dot pop
    mix += whoosh(0.35, 0.6, 0.35)                              # tile opens
    mix += thump(0.95, 0.35)
    mix += tone([2637.0, 3520.0], LOCK_T + 0.05, 0.002, 0.05) * 0.10   # lock-on ticks
    mix += tone([2637.0, 3520.0], LOCK_T + 0.25, 0.002, 0.05) * 0.10
    mix += tone([1318.5], LOCK_T + 0.55, 0.01, 0.6) * 0.05      # scan
    mix += whoosh(MORPH_T, MORPH_D, 0.4)                        # fly to centre
    mix += thump(CARD_T, 0.5)
    mix += tone([440.0, 659.25, 880.0, 1318.5], CARD_T, 0.005, 1.2) * 0.16   # logo chime
    mix += tone([3136.0], CARD_T + 0.85, 0.002, 0.3) * 0.05     # light sweep glint
    end = int(0.35 * SR)
    mix[-end:] *= np.linspace(1, 0, end)
    mix /= np.abs(mix).max() / 0.9
    sf.write(out, np.stack([mix, mix], 1), SR)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("work", type=Path)
    ap.add_argument("--stills", nargs="*", type=float)
    a = ap.parse_args()
    pop = Pop(a.work)
    R = a.work / "render"
    if a.stills is not None:
        for t in a.stills:
            pop.compose(t).write_to_png(str(R / f"pop_{t:05.2f}.png"))
        return
    vid = R / "pop_video.mp4"
    p = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgra", "-s", f"{pop.W}x{pop.H}", "-r", str(FPS), "-i", "-",
                          "-c:v", "libx264", "-preset", "medium", "-crf", "16", "-pix_fmt", "yuv420p", "-an", str(vid)], stdin=subprocess.PIPE)
    for i in range(int(TOTAL * FPS)):
        p.stdin.write(bytes(pop.compose(i / FPS).get_data()))
    p.stdin.close()
    assert p.wait() == 0
    wav = R / "pop_audio.wav"
    audio(a.work, wav)
    out = R / "scimplify_bts_linkedin.mp4"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(vid), "-i", str(wav), "-map", "0:v", "-map", "1:a", "-c:v", "copy",
                    "-af", "loudnorm=I=-16:TP=-1.5:LRA=9,aresample=48000", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", str(out)], check=True)
    print("done:", out)


if __name__ == "__main__":
    main()
