"""Scimplify dark teaser v2 — richer motion, still no text. Builds on scimplify_teaser.py (footage, grade, face
softening, lamp flare) and replaces the overlays and sound.

    python studio/reels/scimplify_teaser_v2.py studio/work/scimplify3                # → render/scimplify_teaser_v2.mp4
    python studio/reels/scimplify_teaser_v2.py studio/work/scimplify3 --stills 0.3 0.9 1.3 4 6.4 6.9 7.3 7.7 8.3 8.7 9.6

Beats
  0.00–0.60  A teal spark draws the logo's open box on black; the lab glows faintly inside it.
  0.60–1.45  We fly through the box into the lab (expo scale), focus resolving.
  1.4–6.0    Glowing dust rises off the bench in the lamp light — far motes small and sharp, near ones soft bokeh,
             thickening as it goes ("something's cooking").
  6.0–7.2    The lab sinks to black while the motes spiral together into one point.
  7.2        Flash.
  7.25–10.0  The point becomes a comet that draws the box (white stroke, teal halo), the box pulses, the wordmark
             is swept on with a light edge while it pulls into focus, ® glints, a last sheen; dust drifts around it.
"""
import argparse
import math
import subprocess
import sys
from pathlib import Path

import cairo
import cv2
import numpy as np
import soundfile as sf

sys.path.insert(0, str(Path(__file__).resolve().parent))
import scimplify_teaser as base  # noqa: E402
from scimplify_teaser import BAR, FPS, H, SQ, SRC_OFF, TEAL, TEAL_LT, W, Teaser, clamp, e_back, e_io, e_out, lerp, prog  # noqa: E402

TOTAL = 10.0
OPEN_DRAW = (0.08, 0.5)
FLY = (0.6, 0.85)
CONV = (6.0, 1.2)
FLASH = 7.2
CARD = 7.25
S0 = 300  # opening box size
WARM = (1.0, 0.72, 0.42)


def e_in(x, p=2.4):
    return clamp(x) ** p


def path_points(path, p):
    L = sum(math.dist(a, b) for a, b in zip(path, path[1:]))
    rem, pts = L * clamp(p), [path[0]]
    for p0, p1 in zip(path, path[1:]):
        d = math.dist(p0, p1)
        u = min(1, rem / d)
        pts.append((lerp(p0[0], p1[0], u), lerp(p0[1], p1[1], u)))
        rem -= d
        if rem <= 0:
            break
    return pts


def comet(ctx, pts, head_r=26, trail=0.32, width=3.0):
    """Glowing head at the end of pts with a fading trail over the last `trail` fraction of the drawn path."""
    if len(pts) < 2:
        return
    seg = [math.dist(pts[i], pts[i + 1]) for i in range(len(pts) - 1)]
    L = sum(seg)
    if L <= 0:
        return
    start = L * (1 - trail)
    acc = 0.0
    ctx.save()
    ctx.set_operator(cairo.OPERATOR_ADD)
    ctx.set_line_cap(cairo.LINE_CAP_ROUND)
    for i, d in enumerate(seg):
        for k in range(8):
            a0 = acc + d * k / 8
            if a0 + d / 8 < start:
                continue
            u = clamp((a0 - start) / max(L - start, 1))
            p0 = (lerp(pts[i][0], pts[i + 1][0], k / 8), lerp(pts[i][1], pts[i + 1][1], k / 8))
            p1 = (lerp(pts[i][0], pts[i + 1][0], (k + 1) / 8), lerp(pts[i][1], pts[i + 1][1], (k + 1) / 8))
            ctx.set_source_rgba(*TEAL_LT, 0.55 * u ** 1.5)
            ctx.set_line_width(width * (1 + 2.2 * u))
            ctx.move_to(*p0)
            ctx.line_to(*p1)
            ctx.stroke()
        acc += d
    hx, hy = pts[-1]
    g = cairo.RadialGradient(hx, hy, 0, hx, hy, head_r)
    g.add_color_stop_rgba(0, 1, 1, 1, 0.95)
    g.add_color_stop_rgba(0.18, *TEAL_LT, 0.8)
    g.add_color_stop_rgba(1, *TEAL, 0)
    ctx.set_source(g)
    ctx.arc(hx, hy, head_r, 0, 2 * math.pi)
    ctx.fill()
    ctx.restore()


class Motes:
    """Deterministic rising dust: position is a pure function of time, so any frame renders on its own."""

    def __init__(self, n, seed, region, near_frac=0.22):
        r = np.random.default_rng(seed)
        self.n = n
        self.z = np.where(r.random(n) < near_frac, r.uniform(0.7, 1.0, n), r.uniform(0.0, 0.55, n))
        x0, x1, y0, y1 = region
        near = self.z > 0.6
        self.x = np.where(near, r.uniform(-100, W + 100, n), r.uniform(x0, x1, n))
        self.y = np.where(near, r.uniform(y0 - 150, H + 100, n), r.uniform(y0, y1, n))
        self.L = r.uniform(2.6, 4.8, n)
        self.b = r.uniform(0, 5, n)
        self.v = r.uniform(32, 70, n) * (0.7 + 0.8 * self.z)
        self.A = r.uniform(6, 26, n)
        self.f = r.uniform(0.35, 0.9, n)
        self.ph = r.uniform(0, 6.28, n)
        self.warm = r.random(n) < 0.72
        self.gain = r.uniform(0.4, 1.0, n) ** 1.3  # most motes faint, a few bright
        self.lit = None  # optional light-pool function (x, y) -> 0..1
        self.r = np.where(near, r.uniform(7, 17, n), r.uniform(1.2, 2.6, n))

    def state(self, t):
        age = (t + self.b) % self.L
        x = self.x + self.A * np.sin(2 * np.pi * self.f * age + self.ph) + 7 * age
        y = self.y - self.v * age
        a = np.sin(np.pi * age / self.L) ** 1.5
        return x, y, a

    def draw(self, ctx, t, density, conv=0.0, target=None):
        if density <= 0 and conv <= 0:
            return
        x, y, a = self.state(t)
        if conv > 0:
            x6, y6, a6 = self.state(CONV[0])
            joins = (self.z < 0.6) & (a6 > 0.12)
            u = e_in(conv, 2.2)
            ox, oy = x - target[0], y - target[1]
            th = 3.2 * u
            sc = (1 - u) ** 1.5
            cx = target[0] + (ox * math.cos(th) - oy * math.sin(th)) * sc
            cy = target[1] + (ox * math.sin(th) + oy * math.cos(th)) * sc
            x = np.where(joins, cx, x)
            y = np.where(joins, cy, y)
            a = np.where(joins, lerp(a6, 1.0, u), a * (1 - u))
            dens = np.where(joins, 1.0, density * (1 - u))
        else:
            joins = np.zeros(self.n, bool)
            dens = np.full(self.n, density)
        ctx.save()
        ctx.set_operator(cairo.OPERATOR_ADD)
        for i in range(self.n):
            al = a[i] * dens[i] * self.gain[i]
            if self.lit is not None and not joins[i]:
                al *= self.lit(x[i], y[i])
            if al <= 0.01:
                continue
            col = WARM if self.warm[i] and not joins[i] else TEAL_LT
            if conv > 0 and joins[i]:
                col = tuple(lerp(c0, c1, e_in(conv, 1.5)) for c0, c1 in zip(WARM if self.warm[i] else TEAL_LT, TEAL_LT))
            rr = self.r[i] * (1 - 0.5 * e_in(conv)) if joins[i] else self.r[i]
            near = self.z[i] > 0.6
            R = rr * (1.0 if near else 3.2)
            g = cairo.RadialGradient(x[i], y[i], 0, x[i], y[i], R)
            if near:  # soft bokeh disc
                g.add_color_stop_rgba(0, *col, 0.16 * al)
                g.add_color_stop_rgba(0.75, *col, 0.12 * al)
                g.add_color_stop_rgba(1, *col, 0)
            else:     # small bright mote with glow
                g.add_color_stop_rgba(0, 1, 1, 1, 0.85 * al)
                g.add_color_stop_rgba(0.22, *col, 0.7 * al)
                g.add_color_stop_rgba(1, *col, 0)
            ctx.set_source(g)
            ctx.arc(x[i], y[i], R, 0, 2 * math.pi)
            ctx.fill()
        ctx.restore()


class TeaserV2(Teaser):
    def __init__(self, work: Path):
        super().__init__(work)
        self.fade_in, self.focus, self.sink, self.push_len = (0.12, 0.6), (0.25, 1.5), (5.9, 1.25), 7.4
        self.motes = Motes(150, 4, (380, 1350, 560, 760))
        # dust is only visible where the lamp light falls: a pool around the lamp and down onto the bench
        self.motes.lit = lambda x, y: 0.16 + 1.1 * math.exp(-((x - 640) / 360) ** 2 - ((y - 520) / 240) ** 2)
        self.logo_motes = Motes(40, 8, (W / 2 - 520, W / 2 + 520, H / 2 + 80, H / 2 + 260), near_frac=0.1)
        # word alpha at a few blur levels (logo px) for the focus pull
        self.word_blur = [(s, cv2.GaussianBlur(self.la["word"], (0, 0), s) if s else self.la["word"]) for s in (0, 1.5, 3, 6, 10)]
        self.box_shape = self.la["box"]

    def target(self):
        return self.dot_xy()

    # ------------------------------------------------------------ opening
    def opening(self, ctx, t, foot):
        cx, cy = W / 2, H / 2
        grow = e_in(prog(t, *FLY), 3.0)
        s = S0 * math.exp(math.log(16) * grow)
        x, y = cx - s / 2, cy - s / 2
        ctx.set_source_rgb(0, 0, 0)
        ctx.paint()
        inner = 0.04 * s
        ctx.save()
        ctx.rectangle(x + inner, y + inner, s - 2 * inner, s - 2 * inner)
        ctx.clip()
        ctx.set_source_surface(foot, 0, 0)
        ctx.paint_with_alpha(lerp(0.75, 1.0, grow))
        ctx.restore()
        p = e_io(prog(t, *OPEN_DRAW))
        path = [(x + u * s, y + v * s) for u, v in SQ]
        pts = path_points(path, p)
        if len(pts) > 1:
            w = lerp(2.5, 26, grow)
            fade = 1 - e_in(grow, 1.6)  # the frame dissolves as it passes the camera
            ctx.save()
            ctx.set_line_width(w + 10)
            ctx.set_source_rgba(*TEAL, 0.25 * fade)
            ctx.move_to(*pts[0])
            for q in pts[1:]:
                ctx.line_to(*q)
            ctx.stroke()
            ctx.set_line_width(w)
            ctx.set_source_rgba(1, 1, 1, 0.95 * fade)
            ctx.move_to(*pts[0])
            for q in pts[1:]:
                ctx.line_to(*q)
            ctx.stroke()
            ctx.restore()
            if p < 1:
                comet(ctx, pts, 22, 0.35, 2.5)
        # the spark that starts it
        r = 8 * e_back(prog(t, 0.0, 0.18))
        if t < OPEN_DRAW[0] + 0.1:
            g = cairo.RadialGradient(path[0][0], path[0][1], 0, path[0][0], path[0][1], 40)
            g.add_color_stop_rgba(0, 1, 1, 1, 0.9)
            g.add_color_stop_rgba(0.3, *TEAL_LT, 0.6)
            g.add_color_stop_rgba(1, *TEAL, 0)
            ctx.set_source(g)
            ctx.arc(path[0][0], path[0][1], 40 * r / 8, 0, 2 * math.pi)
            ctx.fill()

    def density(self, t):
        return 0.65 * e_io(prog(t, 1.3, 2.4)) + 0.35 * e_io(prog(t, 3.9, 2.0))

    # ------------------------------------------------------------ card
    def card2(self, ctx, k):
        ctx.set_source_rgb(0, 0, 0)
        ctx.paint()
        lw, lh = self.lw, self.lh
        z = 1 + 0.025 * e_out(prog(k, 0.9, 2.0))  # slow settle-in
        ctx.save()
        ctx.translate(W / 2, H / 2)
        ctx.scale(z, z)
        ctx.translate(-W / 2, -H / 2)
        x0, y0, sc = self.lo[0], self.lo[1], self.lsc
        gl = e_out(prog(k, 0.0, 0.9)) * (0.75 + 0.25 * math.sin(k * 2.2))
        g = cairo.RadialGradient(W / 2, H / 2, 0, W / 2, H / 2, 820)
        g.add_color_stop_rgba(0, *TEAL, 0.17 * gl)
        g.add_color_stop_rgba(1, *TEAL, 0)
        ctx.set_source(g)
        ctx.paint()
        self.logo_motes.draw(ctx, k + 3.0, 0.55 * e_io(prog(k, 0.6, 1.0)))

        def paint_alpha(alpha, rgb=(1, 1, 1), add=False):
            a8 = (np.clip(alpha, 0, 1) * 255).astype(np.uint8)
            stride = cairo.ImageSurface.format_stride_for_width(cairo.FORMAT_A8, lw)
            buf = np.zeros((lh, stride), np.uint8)
            buf[:, :lw] = a8
            s = cairo.ImageSurface.create_for_data(memoryview(buf), cairo.FORMAT_A8, lw, lh, stride)
            ctx.save()
            if add:
                ctx.set_operator(cairo.OPERATOR_ADD)
            ctx.translate(x0, y0)
            ctx.scale(sc, sc)
            ctx.set_source_rgb(*rgb)
            ctx.mask_surface(s, 0, 0)
            ctx.restore()

        # flash at the merge point
        fx, fy = self.target()
        fl = prog(k, -0.05, 0.45)
        if 0 < fl < 1:
            for R, al in ((260 * e_out(fl), 0.5 * (1 - fl)), (60, 0.9 * (1 - fl) ** 2)):
                fg = cairo.RadialGradient(fx, fy, 0, fx, fy, max(R, 1))
                fg.add_color_stop_rgba(0, 1, 1, 1, al)
                fg.add_color_stop_rgba(0.3, *TEAL_LT, al * 0.6)
                fg.add_color_stop_rgba(1, *TEAL, 0)
                ctx.set_source(fg)
                ctx.arc(fx, fy, max(R, 1), 0, 2 * math.pi)
                ctx.fill()
            ctx.set_source_rgba(*TEAL_LT, 0.7 * (1 - fl))
            ctx.set_line_width(2)
            ctx.arc(fx, fy, 30 + 320 * e_out(fl), 0, 2 * math.pi)
            ctx.stroke()

        # comet draws the box; halo is a blurred copy of what's drawn
        pb = e_io(prog(k, 0.12, 0.8))
        pts = path_points(self.box_path, pb)
        m = np.zeros((lh, lw), np.uint8)
        if len(pts) > 1:
            cv2.polylines(m, [np.array(pts, np.int32)], False, 255, 44)
        drawn = self.box_shape * (m / 255.0)
        if drawn.any():
            paint_alpha(cv2.GaussianBlur(drawn, (0, 0), 14) * lerp(1.3, 0.55, e_io(prog(k, 0.9, 0.8))), TEAL, add=True)
            paint_alpha(drawn)
        if 0 < pb < 1:
            comet(ctx, [(x0 + px * sc, y0 + py * sc) for px, py in pts], 30, 0.3, 3)
        elif pb <= 0:  # the merged point waiting
            r = 7 + 2 * math.sin(k * 30)
            ctx.arc(fx, fy, r, 0, 2 * math.pi)
            ctx.set_source_rgb(*TEAL_LT)
            ctx.fill()
        # box complete: pulse ring in the box's own shape
        pr = prog(k, 0.92, 0.5)
        if 0 < pr < 1:
            bx, by, bs = x0 + 19 * sc, y0 + 18 * sc, 350 * sc
            S = bs * (1 + 0.7 * e_out(pr))
            cx, cy = bx + bs / 2, by + bs / 2
            ctx.save()
            ctx.set_line_width(3)
            ctx.set_source_rgba(*TEAL_LT, 0.5 * (1 - pr) ** 2)
            path = [(cx - S / 2 + u * S, cy - S / 2 + v * S) for u, v in SQ]
            ctx.move_to(*path[0])
            for q in path[1:]:
                ctx.line_to(*q)
            ctx.stroke()
            ctx.restore()
        pn = e_out(prog(k, 0.95, 0.35))
        if pn > 0:
            paint_alpha(self.la["nums"] * pn)
        # wordmark: swept on with a light edge while pulling into focus
        sw = prog(k, 0.9, 0.75)
        if sw > 0:
            sig = 10 * (1 - e_out(prog(k, 0.9, 1.0)))
            lv = [s for s, _ in self.word_blur]
            j = min(len(lv) - 2, max(0, int(np.searchsorted(lv, sig)) - 1))
            u = clamp((sig - lv[j]) / (lv[j + 1] - lv[j]))
            word = self.word_blur[j][1] * (1 - u) + self.word_blur[j + 1][1] * u
            edge = lerp(-160, lw + 240, e_io(sw))
            xs = np.arange(lw, dtype=np.float32)[None, :]
            reveal = np.clip((edge - xs) / 160, 0, 1)
            paint_alpha(word * reveal)
            if sw < 1:
                light = self.la["word"] * np.exp(-((xs - edge + 40) / 34) ** 2)
                paint_alpha(cv2.GaussianBlur(light, (0, 0), 6) * 1.6, TEAL_LT, add=True)
                paint_alpha(light * 0.8, (1, 1, 1), add=True)
        rg = prog(k, 1.6, 0.25)
        if rg > 0:
            paint_alpha(self.la["reg"] * e_out(rg))
            gk = prog(k, 1.62, 0.45)
            if gk < 1:  # glint
                gx, gy = x0 + 1112 * sc, y0 + 120 * sc
                ctx.save()
                ctx.set_operator(cairo.OPERATOR_ADD)
                for ang, L_ in ((0, 70), (math.pi / 2, 70), (math.pi / 4, 26), (-math.pi / 4, 26)):
                    ctx.save()
                    ctx.translate(gx, gy)
                    ctx.rotate(ang)
                    lg = cairo.LinearGradient(-L_, 0, L_, 0)
                    a = math.sin(math.pi * gk)
                    lg.add_color_stop_rgba(0, 1, 1, 1, 0)
                    lg.add_color_stop_rgba(0.5, 1, 1, 1, 0.9 * a)
                    lg.add_color_stop_rgba(1, 1, 1, 1, 0)
                    ctx.set_source(lg)
                    ctx.rectangle(-L_, -1.2, 2 * L_, 2.4)
                    ctx.fill()
                    ctx.restore()
                ctx.restore()
        # last sheen
        u = prog(k, 1.95, 0.65)
        if 0 < u < 1:
            xs = np.arange(lw, dtype=np.float32)[None, :]
            ys = np.arange(lh, dtype=np.float32)[:, None]
            band = np.exp(-(((xs + ys * 0.35) - lerp(-150, lw + 150, e_io(u))) / 40) ** 2)
            paint_alpha(self.la["word"] * band * 0.9, TEAL_LT, add=True)
        ctx.restore()

    # ------------------------------------------------------------ compose
    def compose(self, t):
        s = cairo.ImageSurface(cairo.FORMAT_ARGB32, W, H)
        ctx = cairo.Context(s)
        if t < CARD:
            foot = cairo.ImageSurface(cairo.FORMAT_ARGB32, W, H)
            f = cv2.cvtColor(self.footage(t), cv2.COLOR_BGR2BGRA)
            np.ndarray((H, W, 4), np.uint8, foot.get_data(), strides=(foot.get_stride(), 4, 1))[:] = f
            foot.mark_dirty()
            if t < FLY[0] + FLY[1]:
                self.opening(ctx, t, foot)
            else:
                ctx.set_source_surface(foot, 0, 0)
                ctx.paint()
            if t < FLY[0] + FLY[1]:  # during the opening the lab (and its flare) only exists inside the box
                sz = S0 * math.exp(math.log(16) * e_in(prog(t, *FLY), 3.0))
                ctx.save()
                ctx.rectangle(W / 2 - sz / 2, H / 2 - sz / 2, sz, sz)
                ctx.clip()
                self.flare(ctx, t)
                ctx.restore()
            else:
                self.flare(ctx, t)
            conv = prog(t, *CONV)
            self.motes.draw(ctx, t, self.density(t), conv, self.target())
            bar = BAR * e_out(prog(t, FLY[0] + FLY[1] - 0.25, 0.6))
            if bar > 0.5:
                ctx.set_source_rgb(0, 0, 0)
                ctx.rectangle(0, 0, W, bar)
                ctx.rectangle(0, H - bar, W, bar)
                ctx.fill()
            if t > FLASH - 0.12:  # the point brightening just before the flash
                fx, fy = self.target()
                a = prog(t, FLASH - 0.12, 0.12)
                g = cairo.RadialGradient(fx, fy, 0, fx, fy, 50)
                g.add_color_stop_rgba(0, 1, 1, 1, a)
                g.add_color_stop_rgba(1, *TEAL, 0)
                ctx.set_source(g)
                ctx.arc(fx, fy, 50, 0, 2 * math.pi)
                ctx.fill()
        else:
            self.card2(ctx, t - CARD)
        s.flush()
        return s


def audio(work: Path, out: Path):
    SR = 48000
    n = int(TOTAL * SR)
    t = np.arange(n) / SR
    rng = np.random.default_rng(33)
    raw = work / "render" / "amb.wav"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", str(SRC_OFF), "-i", str(work / "in" / "src.mp4"), "-vn", "-ac", "1", "-ar", str(SR), str(raw)], check=True)
    a, _ = sf.read(raw)
    amb = np.zeros(n)
    m = min(len(a), int(CARD * SR))
    amb[:m] = a[:m]
    amb /= max(1e-6, np.abs(amb).max())
    amb *= np.clip((t - 0.9) / 0.8, 0, 1) * np.clip((6.9 - t) / 0.9, 0, 1)

    def env(at, att, dec):
        return np.where(t >= at, np.minimum(1, (t - at) / att) * np.exp(-(t - at) / dec), 0)

    def lp(x, alpha):
        y = np.zeros_like(x)
        acc = 0.0
        if np.isscalar(alpha):
            alpha = np.full(len(x), alpha)
        for i, v in enumerate(x):
            acc += alpha[i] * (v - acc)
            y[i] = acc
        return y

    noise = rng.standard_normal(n)

    def sweep(t0, t1, a0, a1, g):  # filtered-noise sweep (zips, whooshes, risers)
        y = np.zeros(n)
        i0, i1 = int(t0 * SR), int(t1 * SR)
        alpha = np.linspace(a0, a1, i1 - i0)
        seg = lp(noise[i0:i1], alpha)
        seg -= lp(seg, 0.02)
        y[i0:i1] = seg * np.sin(np.linspace(0, np.pi, i1 - i0)) ** 0.8
        return g * y / max(1e-6, np.abs(y).max())

    def boom(at, g, f0=38, f1=36):
        fr = f0 + f1 * np.exp(-np.clip(t - at, 0, None) / 0.06)
        return g * np.sin(2 * np.pi * np.cumsum(fr) / SR) * env(at, 0.003, 0.7)

    def bell(fs, at, dec, g):
        return g * sum(np.sin(2 * np.pi * f * t + i) for i, f in enumerate(fs)) / len(fs) * env(at, 0.004, dec)

    mix = np.zeros(n)
    mix += bell([2637.0], 0.0, 0.12, 0.10)                       # spark
    mix += sweep(OPEN_DRAW[0], OPEN_DRAW[0] + OPEN_DRAW[1], 0.05, 0.35, 0.10)  # box zip
    mix += sweep(FLY[0] - 0.2, FLY[0] + FLY[1], 0.01, 0.25, 0.38)   # fly-through whoosh
    mix += boom(FLY[0] + FLY[1] - 0.02, 0.45)
    mix += 0.28 * amb
    drone = (np.sin(2 * np.pi * 41.2 * t) + 0.6 * np.sin(2 * np.pi * 61.7 * t + 1) + 0.25 * np.sin(2 * np.pi * 123.5 * t)) / 1.85
    mix += 0.26 * drone * np.clip((t - 1.2) / 2.0, 0, 1) * (0.5 + 0.5 * np.clip((t - 3) / 3, 0, 1)) * np.clip((7.15 - t) / 0.15, 0, 1)
    # mote glitter: faint high blips, density following the visuals
    k = 1.5
    while k < 6.0:
        f0 = rng.uniform(2500, 5200)
        L = int(0.06 * SR)
        tt = np.arange(L) / SR
        i = int(k * SR)
        mix[i:i + L] += 0.018 * np.sin(2 * np.pi * f0 * tt) * np.exp(-tt / 0.02)
        dens = 0.65 * clamp((k - 1.3) / 2.4) + 0.35 * clamp((k - 3.9) / 2.0)
        k += rng.uniform(0.05, 0.25) / max(dens, 0.25)
    # simmer bubbles
    k = 1.8
    while k < 5.9:
        f0 = rng.uniform(380, 900)
        L = int(rng.uniform(0.02, 0.05) * SR)
        tt = np.arange(L) / SR
        i = int(k * SR)
        mix[i:i + L] += 0.04 * np.sin(2 * np.pi * (f0 * tt + 4000 * tt ** 2)) * np.exp(-tt / 0.012) * rng.uniform(0.3, 1)
        k += rng.uniform(0.07, 0.25)
    # heartbeat quickening
    for at in (1.5, 2.8, 3.9, 4.75, 5.4, 5.85):
        mix += boom(at, 0.30, 52, 30) * np.exp(-np.clip(t - at, 0, None) / 0.2)
    # convergence: swirling riser + rising glide, then a hair of silence
    mix += sweep(CONV[0], FLASH - 0.04, 0.01, 0.4, 0.30)
    gl = np.where((t >= CONV[0]) & (t < FLASH - 0.04), np.sin(2 * np.pi * np.cumsum(180 + 900 * clamp_arr((t - CONV[0]) / (FLASH - CONV[0])) ** 2) / SR), 0)
    mix += 0.05 * gl * clamp_arr((t - CONV[0]) / (FLASH - CONV[0]))
    # flash: hit + crack + shimmer
    mix += boom(FLASH, 0.95)
    mix += 0.35 * lp(noise, 0.5) * env(FLASH, 0.001, 0.06)
    mix += bell([1318.5, 1760.0, 2637.0], FLASH, 1.0, 0.10)
    # card
    mix += sweep(CARD + 0.12, CARD + 0.92, 0.08, 0.45, 0.10)      # comet zip around the box
    mix += boom(CARD + 0.92, 0.35, 60, 30)                        # box closes
    mix += bell([880.0, 1318.5], CARD + 0.92, 0.9, 0.06)
    mix += sweep(CARD + 0.9, CARD + 1.65, 0.05, 0.3, 0.07)        # word sweep
    mix += bell([3520.0], CARD + 1.62, 0.25, 0.06)                # ® glint
    mix += bell([1760.0, 2637.0], CARD + 1.95, 0.6, 0.03)         # sheen
    ring = sum(g * np.sin(2 * np.pi * f * t) for f, g in ((110.0, 1), (164.81, 0.6), (220.0, 0.35))) * env(FLASH + 0.05, 0.5, 1.8)
    mix += 0.12 * ring
    end = int(0.45 * SR)
    mix[-end:] *= np.linspace(1, 0, end)
    mix /= np.abs(mix).max() / 0.9
    sf.write(out, np.stack([mix, mix], 1), SR)


def clamp_arr(x):
    return np.clip(x, 0, 1)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("work", type=Path)
    ap.add_argument("--stills", nargs="*", type=float)
    a = ap.parse_args()
    tz = TeaserV2(a.work)
    R = a.work / "render"
    if a.stills is not None:
        for t in a.stills:
            tz.compose(t).write_to_png(str(R / f"v2_{t:05.2f}.png"))
        return
    vid = R / "video_v2.mp4"
    p = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgra", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
                          "-c:v", "libx264", "-preset", "medium", "-crf", "15", "-tune", "grain", "-pix_fmt", "yuv420p", "-an", str(vid)], stdin=subprocess.PIPE)
    for i in range(int(round(TOTAL * FPS))):
        p.stdin.write(bytes(tz.compose(i / FPS).get_data()))
    p.stdin.close()
    assert p.wait() == 0
    wav = R / "audio_v2.wav"
    audio(a.work, wav)
    out = R / "scimplify_teaser_v2.mp4"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(vid), "-i", str(wav), "-map", "0:v", "-map", "1:a", "-c:v", "copy",
                    "-af", "loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", str(out)], check=True)
    print("done:", out)


if __name__ == "__main__":
    main()
