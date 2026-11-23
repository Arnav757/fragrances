"""FORMA 15 s brand ad — light mode, one travelling orange dot, kinetic type, art plates + Arjun cutouts.

    python studio/reels/forma_ad.py studio/work/ad            # render → render/forma_ad.mp4
    python studio/reels/forma_ad.py studio/work/ad --stills 1.0 2.2 5.0   # frames at these times

Inputs in <work>: gfx/claude_ad_kit/assets/*.png (art plates, ribbon cutout), cut/*.png (Arjun RGBA cutouts:
before, after, faceA, faceB, look1), plus ../ep1/ep1_c_location.png, ../ep1/ep1_f_hem.png,
../arjun/assets/img6_after_cafe.png. Timeline snaps to a 145 BPM grid (beat = 0.4138 s).
"""
import argparse
import math
import sys
from pathlib import Path

import cairo
import cv2
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "lib"))
from render import FPS, W, H, Scene, join, render_scene  # noqa: E402

INK = (0x17 / 255, 0x19 / 255, 0x1D / 255)
WHITE = (1, 1, 1)
COBALT = (0x25 / 255, 0x57 / 255, 1.0)
ORANGE = (1.0, 0x4F / 255, 0x2A / 255)
LIME = (0xC7 / 255, 1.0, 0x43 / 255)
ICE = (0xA5 / 255, 0xE8 / 255, 1.0)
OLIVE = (0x70 / 255, 0x82 / 255, 0x38 / 255)
CAMEL = (0xC1 / 255, 0x9A / 255, 0x6B / 255)
FONT = "Inter Tight Heavy"
BEAT = 60 / 145
TOTAL = 15.0


def q(t):  # snap to a frame
    return round(t * FPS) / FPS


def b(n):  # time of beat n, frame-snapped
    return q(n * BEAT)


# ---------------------------------------------------------------- easing
def clamp(x, a=0.0, b_=1.0):
    return max(a, min(b_, x))


def prog(t, t0, d):
    return clamp((t - t0) / d) if d > 0 else float(t >= t0)


def e_out(x):  # expo out
    return 1.0 if x >= 1 else 1 - 2 ** (-10 * x)


def e_in(x):
    return 0.0 if x <= 0 else 2 ** (10 * (x - 1))


def e_io(x):
    if x <= 0:
        return 0.0
    if x >= 1:
        return 1.0
    return 2 ** (20 * x - 10) / 2 if x < 0.5 else (2 - 2 ** (-20 * x + 10)) / 2


def back(x, s=1.70158):  # overshoot out
    x -= 1
    return x * x * ((s + 1) * x + s) + 1


def lerp(a, b_, u):
    return a + (b_ - a) * u


# ---------------------------------------------------------------- images
_KEEP = []


def surf(bgra):
    """BGRA uint8 (straight alpha) → premultiplied cairo surface."""
    a = bgra[..., 3:4].astype(np.float32) / 255
    pm = bgra.astype(np.float32)
    pm[..., :3] *= a
    arr = np.ascontiguousarray(pm.astype(np.uint8))
    s = cairo.ImageSurface.create_for_data(memoryview(arr), cairo.FORMAT_ARGB32, arr.shape[1], arr.shape[0], arr.strides[0])
    _KEEP.append(arr)  # cairo does not own the buffer
    return s


def load(path, max_h=None, erode=0):
    im = cv2.imread(str(path), cv2.IMREAD_UNCHANGED)
    if im.ndim == 2:
        im = cv2.cvtColor(im, cv2.COLOR_GRAY2BGRA)
    if im.shape[2] == 3:
        im = cv2.cvtColor(im, cv2.COLOR_BGR2BGRA)
    if erode:
        a = cv2.erode(im[..., 3], np.ones((erode, erode), np.uint8))
        im[..., 3] = cv2.GaussianBlur(a, (0, 0), 0.8)
    if max_h and im.shape[0] > max_h:
        s = max_h / im.shape[0]
        im = cv2.resize(im, (round(im.shape[1] * s), max_h), interpolation=cv2.INTER_AREA)
    return surf(im)


def draw(ctx, s, cx, cy, scale, alpha=1.0, ax=0.5, ay=0.5):
    """Draw surface s scaled, with its anchor (ax, ay) at (cx, cy)."""
    w, h = s.get_width(), s.get_height()
    if scale <= 1e-4 or alpha <= 0:
        return
    ctx.save()
    ctx.translate(cx, cy)
    ctx.scale(scale, scale)
    ctx.translate(-w * ax, -h * ay)
    ctx.set_source_surface(s, 0, 0)
    ctx.get_source().set_filter(cairo.FILTER_GOOD)
    ctx.paint_with_alpha(alpha)
    ctx.restore()


def cover(ctx, s, rect, zoom=1.0, fx=0.5, fy=0.5, alpha=1.0, radius=0.0):
    """Fill rect=(x,y,w,h) with s (cover fit), zoomed around focus (fx, fy) of the image."""
    x, y, w, h = rect
    if w < 1 or h < 1 or alpha <= 0:
        return
    iw, ih = s.get_width(), s.get_height()
    sc = max(w / iw, h / ih) * zoom
    # keep the focus point where it would sit at zoom 1, clamped so the image always covers the rect
    base = max(w / iw, h / ih)
    px = x + w / 2 + (fx - 0.5) * iw * base
    py = y + h / 2 + (fy - 0.5) * ih * base
    ox = px - fx * iw * sc
    oy = py - fy * ih * sc
    ox = min(x, max(x + w - iw * sc, ox))
    oy = min(y, max(y + h - ih * sc, oy))
    ctx.save()
    rounded(ctx, x, y, w, h, radius)
    ctx.clip()
    ctx.translate(ox, oy)
    ctx.scale(sc, sc)
    ctx.set_source_surface(s, 0, 0)
    ctx.get_source().set_filter(cairo.FILTER_GOOD)
    ctx.paint_with_alpha(alpha)
    ctx.restore()


def rounded(ctx, x, y, w, h, r):
    r = min(r, w / 2, h / 2)
    if r <= 0:
        ctx.rectangle(x, y, w, h)
        return
    ctx.new_sub_path()
    ctx.arc(x + w - r, y + r, r, -math.pi / 2, 0)
    ctx.arc(x + w - r, y + h - r, r, 0, math.pi / 2)
    ctx.arc(x + r, y + h - r, r, math.pi / 2, math.pi)
    ctx.arc(x + r, y + r, r, math.pi, 3 * math.pi / 2)
    ctx.close_path()


def dot(ctx, x, y, r, rgb=ORANGE, a=1.0):
    if r <= 0:
        return
    ctx.set_source_rgba(*rgb, a)
    ctx.arc(x, y, r, 0, 2 * math.pi)
    ctx.fill()


def zoom_through(ctx, d, u):
    """Camera move into dot d=(x, y, r): it slides to frame centre while scaling until it covers the frame."""
    z = 1 + (math.hypot(W, H) / 2 / d[2] * 1.05 - 1) * u
    cx, cy = lerp(d[0], W / 2, e_out(u)), lerp(d[1], H / 2, e_out(u))
    ctx.translate(cx, cy)
    ctx.scale(z, z)
    ctx.translate(-d[0], -d[1])


def white(ctx):
    ctx.set_source_rgb(*WHITE)
    ctx.paint()


# ---------------------------------------------------------------- strokes
def bezier_pts(segs, n=40):
    """segs: list of (p0, c1, c2, p1). Returns a polyline."""
    pts = []
    for p0, c1, c2, p1 in segs:
        for i in range(n + (1 if (p0, c1, c2, p1) == segs[-1] else 0)):
            u = i / n
            a = (1 - u) ** 3
            bb = 3 * (1 - u) ** 2 * u
            c = 3 * (1 - u) * u * u
            d = u ** 3
            pts.append((a * p0[0] + bb * c1[0] + c * c2[0] + d * p1[0], a * p0[1] + bb * c1[1] + c * c2[1] + d * p1[1]))
    return pts


def stroke_part(ctx, pts, u0, u1, width, rgb, a=1.0):
    """Stroke the polyline between fractions u0..u1 of its length (round caps)."""
    if u1 <= u0 or len(pts) < 2:
        return
    seg = [math.dist(pts[i], pts[i + 1]) for i in range(len(pts) - 1)]
    L = sum(seg)
    s0, s1 = u0 * L, u1 * L
    acc = 0.0
    out = []
    for i, d in enumerate(seg):
        a0, a1 = acc, acc + d
        if a1 >= s0 and a0 <= s1:
            t0 = clamp((s0 - a0) / d) if d else 0
            t1 = clamp((s1 - a0) / d) if d else 1
            p, qq = pts[i], pts[i + 1]
            pa = (lerp(p[0], qq[0], t0), lerp(p[1], qq[1], t0))
            pb = (lerp(p[0], qq[0], t1), lerp(p[1], qq[1], t1))
            if not out:
                out.append(pa)
            out.append(pb)
        acc = a1
    if len(out) < 2:
        return
    ctx.save()
    ctx.set_line_cap(cairo.LINE_CAP_ROUND)
    ctx.set_line_join(cairo.LINE_JOIN_ROUND)
    ctx.set_line_width(width)
    ctx.set_source_rgba(*rgb, a)
    ctx.move_to(*out[0])
    for p in out[1:]:
        ctx.line_to(*p)
    ctx.stroke()
    ctx.restore()


def point_at(pts, u):
    seg = [math.dist(pts[i], pts[i + 1]) for i in range(len(pts) - 1)]
    s = clamp(u) * sum(seg)
    for i, d in enumerate(seg):
        if s <= d or i == len(seg) - 1:
            k = clamp(s / d) if d else 0
            return (lerp(pts[i][0], pts[i + 1][0], k), lerp(pts[i][1], pts[i + 1][1], k))
        s -= d
    return pts[-1]


# ---------------------------------------------------------------- type
class Type:
    """Heavy grotesk words, laid out per letter so letters can move independently. A trailing '.' or the dot
    of '?' is replaced by the brand's orange dot (measured from the glyph)."""

    def __init__(self):
        self.cache = {}

    def metrics(self, ctx, size):
        if size not in self.cache:
            ctx.save()
            ctx.select_font_face(FONT)
            ctx.set_font_size(size)
            ex = ctx.text_extents(".")
            qx = ctx.text_extents("?")
            fe = ctx.font_extents()
            ctx.restore()
            # period: the glyph's own box; question mark's dot = the bottom square of its box
            self.cache[size] = {
                "dot_r": ex.width / 2,
                "dot_dx": ex.x_bearing + ex.width / 2,
                "dot_dy": ex.y_bearing + ex.height / 2,
                "q_cut": qx.y_bearing + qx.height - ex.height * 1.25,
                "q_dx": qx.x_bearing + qx.width * 0.42,
                "ascent": fe[0],
            }
        return self.cache[size]

    def layout(self, ctx, s, size, track=0.0):
        ctx.save()
        ctx.select_font_face(FONT)
        ctx.set_font_size(size)
        xs, x = [], 0.0
        for i, ch in enumerate(s):
            xs.append(x)
            x += ctx.text_extents(s[: i + 1]).x_advance - ctx.text_extents(s[:i]).x_advance + track
        ctx.restore()
        return xs, x - track

    def word(self, ctx, s, cx, base, size, t, t_in, t_out=None, stagger=0.028, dur=0.42, rgb=INK, track=-0.02,
             from_below=True, dot_pos=None, align="center"):
        """Rise-in per letter inside a line mask; optional rise-out. Returns the orange dot position (or None)."""
        tr = track * size
        xs, width = self.layout(ctx, s, size, tr)
        x0 = cx - width / 2 if align == "center" else cx
        m = self.metrics(ctx, size)
        top, bot = base - m["ascent"] * 1.02, base + size * 0.26
        dotxy = None
        for i, ch in enumerate(s):
            u = e_out(prog(t, t_in + i * stagger, dur))
            v = e_in(prog(t, t_out + i * stagger * 0.6, dur * 0.7)) if t_out is not None else 0.0
            if u <= 0 or v >= 1:
                continue
            dy = (1 - u) * (bot - top) * (1 if from_below else -1) - v * (bot - top)
            x = x0 + xs[i]
            ctx.save()
            ctx.rectangle(x - size, top, size * 3, bot - top)
            ctx.clip()
            ctx.select_font_face(FONT)
            ctx.set_font_size(size)
            if ch == ".":
                dotxy = (x + m["dot_dx"], base + m["dot_dy"] + dy, m["dot_r"])
                if dot_pos is None:
                    dot(ctx, *dotxy)
            elif ch == "?":
                ctx.save()
                ctx.rectangle(x - size, top - size, size * 3, (base + m["q_cut"]) - top + size + dy)
                ctx.clip()
                ctx.set_source_rgb(*rgb)
                ctx.move_to(x, base + dy)
                ctx.show_text(ch)
                ctx.restore()
                dotxy = (x + m["q_dx"], base + m["dot_dy"] + dy, m["dot_r"])
                if dot_pos is None:
                    dot(ctx, *dotxy)
            else:
                ctx.set_source_rgb(*rgb)
                ctx.move_to(x, base + dy)
                ctx.show_text(ch)
            ctx.restore()
        return dotxy

    def dot_of(self, ctx, s, cx, base, size, track=-0.02):
        """Resting position of the orange dot of word s (for routing the travelling dot)."""
        xs, width = self.layout(ctx, s, size, track * size)
        m = self.metrics(ctx, size)
        i = len(s) - 1
        x = cx - width / 2 + xs[i]
        dx = m["q_dx"] if s[i] == "?" else m["dot_dx"]
        return (x + dx, base + m["dot_dy"], m["dot_r"])


# ---------------------------------------------------------------- the film
class Ad:
    def __init__(self, work: Path):
        A = work / "gfx" / "claude_ad_kit" / "assets"
        P = lambda n: load(A / f"{n}.png")  # noqa: E731
        self.paper, self.flower, self.arch = P("01_paper_studio"), P("02_glass_ribbon_flower"), P("03_idea_architecture")
        self.ribbon = load(A / "04_cobalt_orange_ribbon_cutout.png", max_h=700)
        self.glass, self.paint, self.maker, self.kinetic = P("05_glass_flower"), P("06_paint_action"), P("07_maker_portrait"), P("08_kinetic_installation")
        C = work / "cut"
        self.before = load(C / "before.png", max_h=1700, erode=3)
        self.after = load(C / "after.png", max_h=1700, erode=3)
        self.faceA = load(C / "faceA.png", max_h=1300, erode=5)
        self.faceB = load(C / "faceB.png", max_h=1300, erode=5)
        self.look1 = load(C / "look1.png", max_h=1500, erode=3)
        self.location = load(work.parent / "ep1" / "ep1_c_location.png", max_h=1920)
        self.hem = load(work.parent / "ep1" / "ep1_f_hem.png", max_h=1920)
        self.cafe = load(work.parent / "arjun" / "assets" / "img6_after_cafe.png")
        O, C2 = work / "outfits", work / "cut2"
        self.flat, self.plinth, self.swatch, self.hem2 = (load(O / f) for f in ("B1_paper_flatlay.png", "B2_sculptural_plinth.png", "B3_fabric_swatches.png", "B4_hem_macro.png"))
        self.look = {k: load(C2 / f"{k}.png", max_h=1500, erode=3) for k in ("A1", "A2", "A3", "A4", "A5", "A6")}
        self.plate = {k: load(O / f) for k, f in (("A2", "A2_office.png"), ("A4", "A4_wedding.png"))}
        self.T = Type()
        # section starts on the 145 BPM grid
        self.S = {"A": 0.0, "C": b(3), "D": b(6), "E": b(8), "F": b(10), "G": b(13), "H": b(16), "I": b(19),
                  "J": b(23), "K": b(28), "L": b(31), "END": TOTAL}
        # endcard mark geometry (forma_endcard_light.svg: translate(389 760) scale(.86))
        self.mk = (389, 760, 0.86)
        mx, my, ms = self.mk
        self.logo_dot = (mx + 281 * ms, my + 414 * ms, 50 * ms)

    # ------------------------------------------------------------ helpers
    def person(self, ctx, s, cx, feet_y, height, alpha=1.0):
        sc = height / s.get_height()
        draw(ctx, s, cx, feet_y, sc, alpha, ax=0.5, ay=1.0)

    def F(self, ctx, t0, t, alpha=1.0):
        """The F builds: stem rises, top bar runs right, middle bar runs right (forma_mark_primary geometry)."""
        mx, my, ms = self.mk
        u1, u2, u3 = (e_out(prog(t, t0 + d, 0.32)) for d in (0.0, 0.1, 0.18))
        ctx.save()
        ctx.translate(mx, my)
        ctx.scale(ms, ms)
        ctx.set_source_rgba(*INK, alpha)
        if u1 > 0:
            ctx.rectangle(0, 463 - 463 * u1, 109, 463 * u1)
        if u2 > 0:
            ctx.rectangle(0, 0, 109 + 243 * u2, 93)
        if u3 > 0:
            ctx.rectangle(0, 182, 109 + 197 * u3, 93)
        ctx.fill()
        ctx.restore()

    # ------------------------------------------------------------ frame
    def frame(self, ctx, t):
        S = self.S
        if t < S["C"]:
            self.sec_A(ctx, t)
        elif t < S["D"]:
            self.sec_C(ctx, t)
        elif t < S["E"]:
            self.sec_D(ctx, t)
        elif t < S["F"]:
            self.sec_E(ctx, t)
        elif t < S["G"]:
            self.sec_F(ctx, t)
        elif t < S["H"]:
            self.sec_G(ctx, t)
        elif t < S["I"]:
            self.sec_H(ctx, t)
        elif t < S["J"]:
            self.sec_I(ctx, t)
        elif t < S["K"]:
            self.sec_J(ctx, t)
        elif t < S["L"]:
            self.sec_K(ctx, t)
        else:
            self.sec_L(ctx, t)

    # A: dot, cobalt line, ONE FRAME., zoom through the period
    def sec_A(self, ctx, t):
        white(ctx)
        T = self.T
        end = self.S["C"]
        size = 236
        d_end = T.dot_of(ctx, "FRAME.", W / 2, 1090, size)
        t_zoom = end - 0.30
        zoom = e_in(prog(t, t_zoom, 0.30))
        ctx.save()
        if zoom > 0:  # zoom into the period dot; it glides to centre as it grows, so orange fills the frame
            zoom_through(ctx, d_end, zoom)
        # cobalt line drawn from the dot, then retracts as the type lands
        line = bezier_pts([((540, 960), (520, 700), (900, 640), (820, 380)), ((820, 380), (760, 200), (380, 260), (260, -80))])
        u_head = e_out(prog(t, 0.08, 0.55))
        u_tail = e_io(prog(t, 0.55, 0.45))
        stroke_part(ctx, line, u_tail, u_head, 30, COBALT)
        T.word(ctx, "ONE", W / 2, 860, size, t, 0.42, stagger=0.035)
        T.word(ctx, "FRAME.", W / 2, 1090, size, t, 0.52, stagger=0.035, dot_pos=True)
        # the travelling dot: pops at centre, then slides into the period
        pop = back(prog(t, 0.0, 0.22))
        mv = e_io(prog(t, 0.55, 0.42))
        x = lerp(540, d_end[0], mv)
        y = lerp(960, d_end[1], mv)
        r = lerp(34, d_end[2], mv) * pop
        dot(ctx, x, y, r)
        ctx.restore()

    # C: Arjun before → after. Shoulder/ankle marks, then a cobalt paint sweep reveals the after.
    def sec_C(self, ctx, t):
        t0 = self.S["C"]
        white(ctx)
        k = t - t0
        # the orange fill shrinks back to a dot that lands on his chest
        feet, ht, cx = 1830, 1560, 540
        sweep0 = t0 + 0.62
        u = e_io(prog(t, sweep0, 0.42))
        # diagonal sweep line from bottom-left to top-right
        def region(p):
            # half-plane behind the sweep: points with x - y*0.55 < s
            s = lerp(-1200, 1700, p)
            ctx.move_to(-200, -200)
            ctx.line_to(s + 0.55 * -200, -200)
            ctx.line_to(s + 0.55 * 2200, 2200)
            ctx.line_to(-200, 2200)
            ctx.close_path()
            return s
        zoom_in = 1.06 - 0.06 * e_out(prog(t, t0, 0.5))
        self.person(ctx, self.before, cx, feet, ht * zoom_in)
        if u > 0:
            ctx.save()
            s = region(u)
            ctx.clip()
            white(ctx)
            self.person(ctx, self.after, cx, feet, ht * zoom_in)
            ctx.restore()
            if u < 1:  # the brush band riding the edge
                for off, wdt, col, a in ((-60, 120, COBALT, 1.0), (40, 26, LIME, 1.0)):
                    ctx.save()
                    ctx.set_source_rgba(*col, a)
                    ctx.set_line_width(wdt)
                    ctx.set_line_cap(cairo.LINE_CAP_ROUND)
                    ctx.move_to(s + off + 0.55 * -200, -200)
                    ctx.line_to(s + off + 0.55 * 2200, 2200)
                    ctx.stroke()
                    ctx.restore()
        # painted measure marks: shoulders (cobalt) and the narrow ankles (orange) on the before
        before_on = 1 - prog(t, sweep0 + 0.05, 0.2)
        if before_on > 0:
            sh_y, sh = 545, (300, 780)
            p = e_out(prog(t, t0 + 0.12, 0.35))
            ctx.save()
            ctx.set_line_cap(cairo.LINE_CAP_ROUND)
            ctx.set_source_rgba(*COBALT, before_on)
            ctx.set_line_width(14)
            mid = (sh[0] + sh[1]) / 2
            ctx.move_to(mid - (mid - sh[0]) * p, sh_y)
            ctx.line_to(mid + (sh[1] - mid) * p, sh_y)
            ctx.stroke()
            p2 = e_out(prog(t, t0 + 0.3, 0.35))
            ctx.set_source_rgba(*ORANGE, before_on)
            ctx.set_line_width(8)
            for x0, x1 in ((300, 440), (780, 630)):
                ctx.move_to(x0, sh_y)
                ctx.line_to(lerp(x0, x1, p2), lerp(sh_y, 1710, p2))
            ctx.stroke()
            ctx.restore()
        # after: straight long leg lines in ink
        if u >= 1:
            p3 = e_out(prog(t, sweep0 + 0.42, 0.3))
            ctx.save()
            ctx.set_source_rgb(*INK)
            ctx.set_line_width(6)
            ctx.set_line_cap(cairo.LINE_CAP_ROUND)
            for x in (300, 780):
                ctx.move_to(x, 545)
                ctx.line_to(x, lerp(545, 1800, p3))
            ctx.stroke()
            ctx.restore()
        # orange → dot at chest (the zoom from A lands here)
        shrink = e_out(prog(t, t0, 0.32))
        chest = (540, 760)
        if shrink < 1:
            R = lerp(1500, 22, shrink)
            dot(ctx, lerp(W / 2, chest[0], shrink), lerp(H / 2, chest[1], shrink), R)
        else:
            dot(ctx, *chest, 22 * (1 - e_in(prog(t, sweep0 + 0.6, 0.2))))

    # D: WHAT FITS? — then zoom through the ? dot
    def sec_D(self, ctx, t):
        t0, end = self.S["D"], self.S["E"]
        white(ctx)
        size = 250
        dq = self.T.dot_of(ctx, "FITS?", W / 2, 1100, size)
        zoom = e_in(prog(t, end - 0.28, 0.28))
        ctx.save()
        if zoom > 0:
            zoom_through(ctx, dq, zoom)
        # WHAT snaps in at a larger scale, then settles
        sc = lerp(1.25, 1.0, e_out(prog(t, t0, 0.35)))
        ctx.save()
        ctx.translate(W / 2, 860)
        ctx.scale(sc, sc)
        ctx.translate(-W / 2, -860)
        self.T.word(ctx, "WHAT", W / 2, 860, size, t, t0, stagger=0.02, dur=0.3)
        ctx.restore()
        self.T.word(ctx, "FITS?", W / 2, 1100, size, t, t0 + 0.16, stagger=0.03, dot_pos=True)
        # the dot drops in from the chest position into the ? dot
        u = back(prog(t, t0 + 0.2, 0.36), 2.2)
        dot(ctx, dq[0], lerp(-60, dq[1], e_out(prog(t, t0 + 0.2, 0.3))), dq[2] * clamp(u, 0, 1.3))
        ctx.restore()

    # E: match-cut out of orange into the glass flower; then a push into the paint plate
    def sec_E(self, ctx, t):
        t0, end = self.S["E"], self.S["F"]
        k = t - t0
        cut2 = t0 + 0.42
        if t < cut2:
            z = lerp(4.2, 1.06, e_out(prog(t, t0, 0.42)))
            cover(ctx, self.flower, (0, 0, W, H), zoom=z, fx=0.695, fy=0.314)
            o = 1 - prog(t, t0, 0.1)
            if o > 0:
                ctx.set_source_rgba(*ORANGE, o)
                ctx.paint()
        else:
            # lateral push: paint plate slides in from the right over the flower
            p = e_out(prog(t, cut2, 0.3))
            cover(ctx, self.flower, (0, 0, W, H), zoom=1.06 + 0.04 * prog(t, t0, end - t0), fx=0.695, fy=0.314)
            x = lerp(W, 0, p)
            ctx.save()
            ctx.rectangle(x, 0, W, H)
            ctx.clip()
            cover(ctx, self.paint, (x, 0, W, H), zoom=1.12 - 0.06 * p, fx=0.55, fy=0.55)
            ctx.restore()
            if p < 1:
                ctx.set_source_rgb(*COBALT)
                ctx.rectangle(x - 18, 0, 18, H)
                ctx.fill()

    # F: YOUR COLOURS. — face on an ice disc, 3D swatch orbit, olive paint-over
    def sec_F(self, ctx, t):
        t0, end = self.S["F"], self.S["G"]
        if t - t0 < 0.23:  # fabric-swatch flash, then the colour disc
            cover(ctx, self.swatch, (0, 0, W, H), zoom=1.25 - 0.15 * e_out(prog(t, t0, 0.23)), fx=0.5, fy=0.5)
            return
        t0 += 0.23
        white(ctx)
        k = t - t0
        cx, cy, R = 540, 930, 330
        rin = back(prog(t, t0, 0.38), 1.4)
        # orbit swatches (3D ring), back half first
        sw = [ORANGE, COBALT, LIME, OLIVE, CAMEL, ICE]
        ang0 = -1.2 + k * 2.4
        tilt = math.radians(-14)
        items = []
        for i, col in enumerate(sw):
            th = ang0 + i * 2 * math.pi / len(sw)
            ex, ey = math.cos(th) * 470, math.sin(th) * 120
            x = cx + ex * math.cos(tilt) - ey * math.sin(tilt)
            y = cy + ex * math.sin(tilt) + ey * math.cos(tilt)
            depth = math.sin(th)
            items.append((depth, x, y, col))
        grow = e_out(prog(t, t0 + 0.12, 0.4))
        ctx.save()
        ctx.set_source_rgba(*INK, 0.85 * grow)
        ctx.set_line_width(3)
        ctx.translate(cx, cy)
        ctx.rotate(tilt)
        ctx.scale(1, 120 / 470)
        ctx.arc(0, 0, 470 * grow, 0, 2 * math.pi)
        ctx.restore()
        ctx.stroke()
        for depth, x, y, col in sorted(items):
            if depth < 0:
                dot(ctx, x, y, 44 * (1 + 0.3 * depth) * grow, col)
        # disc + face
        ctx.save()
        ctx.arc(cx, cy, R * rin, 0, 2 * math.pi)
        ctx.clip()
        ctx.set_source_rgb(*ICE)
        ctx.paint()
        sc = 1.0
        self.person(ctx, self.faceA, cx, cy + R + 140, 1180 * sc)
        p = e_io(prog(t, t0 + 0.55, 0.38))
        if p > 0:  # olive paint wipe rises from the bottom of the disc
            yv = lerp(cy + R + 20, cy - R - 20, p)
            ctx.save()
            ctx.rectangle(0, yv, W, H)
            ctx.clip()
            ctx.set_source_rgb(*ICE)
            ctx.paint()
            self.person(ctx, self.faceB, cx, cy + R + 140, 1180 * sc)
            ctx.restore()
            if p < 1:
                ctx.set_source_rgb(*OLIVE)
                ctx.rectangle(0, yv - 14, W, 28)
                ctx.fill()
        ctx.restore()
        for depth, x, y, col in sorted(items):
            if depth >= 0:
                dot(ctx, x, y, 44 * (1 + 0.3 * depth) * grow, col)
        T = self.T
        out = end - 0.2
        T.word(ctx, "YOUR", W / 2, 440, 200, t, t0 + 0.06, t_out=out, stagger=0.03, dur=0.36)
        T.word(ctx, "COLOURS.", W / 2, 1600, 168, t, t0 + 0.14, t_out=out, stagger=0.026, dur=0.36)

    # G: three windows at different scales lock into a grid
    def sec_G(self, ctx, t):
        t0 = self.S["G"]
        white(ctx)
        self.grid(ctx, t, t0, [self.flat, self.kinetic, self.glass], [(0.5, 0.5), (0.5, 0.45), (0.5, 0.5)], swap=None)
        # MANY LOOKS. starts tracking in at the end of G and lands in H
        self.many(ctx, t)

    def grid_rects(self):
        g = 26
        x0, y0, w, h = 90, 300, 900, 1180
        lw = (w - g) * 0.56
        rw = w - g - lw
        rh = (h - g) / 2
        return [(x0, y0, lw, h), (x0 + lw + g, y0, rw, rh), (x0 + lw + g, y0 + rh + g, rw, rh)]

    def grid(self, ctx, t, t0, imgs, foci, swap):
        rects = self.grid_rects()
        starts = [(90, 300, 900, 1180), (700, -400, 340, 300), (1100, 1500, 380, 420)]
        lands = [t0 + 0.0, t0 + 0.2, t0 + 0.38]
        for i, (r, st) in enumerate(zip(rects, starts)):
            u = e_out(prog(t, lands[i], 0.42))
            if u <= 0:
                continue
            rr = tuple(lerp(a, b_, u) for a, b_, in zip(st, r))
            rad = lerp(0 if i == 0 else 40, 36, u)
            cover(ctx, imgs[i], rr, zoom=lerp(1.25, 1.0, u), fx=foci[i][0], fy=foci[i][1], radius=rad)
            if swap and swap[i]:
                s_img, s_t, s_focus, s_bg = swap[i]
                p = e_io(prog(t, s_t, 0.34))
                if p > 0:  # circle wipe from the window's centre
                    x, y, w, h = rr
                    ctx.save()
                    rounded(ctx, x, y, w, h, rad)
                    ctx.clip()
                    ctx.arc(x + w / 2, y + h / 2, p * math.hypot(w, h) / 2 + 1, 0, 2 * math.pi)
                    ctx.clip()
                    if s_bg is not None:
                        ctx.set_source_rgb(*s_bg)
                        ctx.paint()
                        self.person(ctx, s_img, x + w / 2, y + h + 30, h * 1.02)
                    else:
                        cover(ctx, s_img, rr, zoom=1.0, fx=s_focus[0], fy=s_focus[1], radius=rad)
                    ctx.restore()
                    if p < 1:
                        dot(ctx, x + w / 2, y + h / 2, 16 * (1 - p) + 4)

    def many(self, ctx, t):
        tH = self.S["H"]
        t_in = tH - 0.18
        if t < t_in:
            return
        u = e_out(prog(t, t_in, 0.6))
        size = 132
        track = lerp(0.5, -0.02, u)
        a = clamp(u * 2)
        xs, width = self.T.layout(ctx, "MANY LOOKS.", size, track * size)
        x0 = W / 2 - width / 2
        ctx.save()
        ctx.select_font_face(FONT)
        ctx.set_font_size(size)
        m = self.T.metrics(ctx, size)
        for i, ch in enumerate("MANY LOOKS."):
            x = x0 + xs[i]
            if ch == ".":
                dot(ctx, x + m["dot_dx"], 1690 + m["dot_dy"], m["dot_r"], ORANGE, a)
                continue
            ctx.set_source_rgba(*INK, a)
            ctx.move_to(x, 1690)
            ctx.show_text(ch)
        ctx.restore()

    # H: the windows become Arjun's looks; the ribbon loops across; orbit marks turn once
    def sec_H(self, ctx, t):
        t0 = self.S["H"]
        white(ctx)
        sw = [(self.look["A1"], t0 + 0.05, None, ICE), (self.look["A3"], t0 + 0.2, None, LIME), (self.look["A5"], t0 + 0.35, None, ORANGE)]
        self.grid(ctx, t, self.S["G"], [self.flat, self.kinetic, self.glass], [(0.5, 0.5), (0.5, 0.45), (0.5, 0.5)], swap=sw)
        # orbit marks around the grid centre
        o = e_out(prog(t, t0 + 0.1, 0.5)) * (1 - prog(t, self.S["I"] - 0.25, 0.25))
        if o > 0:
            ctx.save()
            ctx.set_source_rgba(*INK, 0.85 * o)
            ctx.set_line_width(3)
            for rot in (-31, 42):
                ctx.save()
                ctx.translate(540, 890)
                ctx.rotate(math.radians(rot + 40 * (t - t0)))
                ctx.scale(1, 148 / 360)
                ctx.arc(0, 0, 360 * o, 0, 2 * math.pi)
                ctx.restore()
                ctx.stroke()
            ctx.restore()
        # ribbon swoops across
        p = prog(t, t0 + 0.05, 1.0)
        if 0 < p < 1:
            pts = bezier_pts([((-500, 1300), (200, 1500), (700, 300), (1600, 500))])
            x, y = point_at(pts, e_io(p))
            ctx.save()
            ctx.translate(x, y)
            ctx.rotate(lerp(-0.5, 0.4, p))
            draw(ctx, self.ribbon, 0, 0, 0.9)
            ctx.restore()
        self.many(ctx, t)

    # I: rapid crops on half-beats, paint marks crossing the edges
    def sec_I(self, ctx, t):
        t0, end = self.S["I"], self.S["J"]
        white(ctx)
        hb = BEAT / 2
        seq = [
            ("full", self.glass, (0.5, 0.45), 1.35),
            ("card", "A2", LIME, None),
            ("full", self.hem2, (0.5, 0.6), 1.15),
            ("full", self.paper, (0.45, 0.4), 1.6),
            ("card", "A4", COBALT, None),
            ("full", self.arch, (0.55, 0.45), 1.2),
            ("small3", None, None, None),
            ("full", self.plinth, (0.5, 0.42), 1.35),
        ]
        i = min(len(seq) - 1, int((t - t0) / hb))
        k = (t - t0) - i * hb
        kind, im, foc, z = seq[i]
        if kind in ("card", "small3"):  # strokes pass behind the cards
            self.marks(ctx, t, t0)
        if kind == "full":
            cover(ctx, im, (0, 0, W, H), zoom=z * (1 - 0.06 * e_out(prog(k, 0, hb))), fx=foc[0], fy=foc[1])
        elif kind == "card":
            u = e_out(prog(k, 0, 0.16))
            w, h = lerp(560, 680, u), lerp(800, 980, u)
            x, y = 540 - w / 2, 960 - h / 2
            ctx.save()
            rounded(ctx, x, y, w, h, 36)
            ctx.clip()
            ctx.set_source_rgb(*foc)
            ctx.paint()
            self.person(ctx, self.look[im], 540, y + h + 18, h * 0.97)
            ctx.restore()
        elif kind == "win":
            u = e_out(prog(k, 0, 0.16))
            w, h = lerp(520, 640, u), lerp(700, 860, u)
            cover(ctx, im, (540 - w / 2, 960 - h / 2, w, h), zoom=1.1 - 0.1 * u, fx=foc[0], fy=foc[1], radius=30)
        else:  # three small windows at once
            for j, (key, col) in enumerate((("A6", ICE), ("A1", LIME), ("A3", ORANGE))):
                u = e_out(prog(k, j * 0.04, 0.16))
                w, h = 300 * u, 460 * u
                if w < 2:
                    continue
                x, y = 90 + j * 320 + (300 - w) / 2, 730 + (460 - h) / 2 + (j - 1) * 70
                ctx.save()
                rounded(ctx, x, y, w, h, 24)
                ctx.clip()
                ctx.set_source_rgb(*col)
                ctx.paint()
                self.person(ctx, self.look[key], x + w / 2, y + h + 10, h * 0.97)
                ctx.restore()
        if kind not in ("card", "small3"):
            self.marks(ctx, t, t0)

    def marks(self, ctx, t, t0):
        # paint marks (paint_reveal paths), drawn across the cuts
        segs = [
            ([((-90, 1120), (95, 930), (212, 1005), (322, 836)), ((322, 836), (432, 667), (495, 480), (668, 544)), ((668, 544), (841, 608), (860, 739), (1170, 360))], COBALT, 34, 0.0),
            ([((-70, 1240), (165, 1125), (241, 1260), (405, 1090)), ((405, 1090), (569, 920), (626, 860), (799, 928)), ((799, 928), (972, 996), (996, 1064), (1150, 930))], ORANGE, 17, 0.13),
            ([((196, 1640), (354, 1474), (574, 1552), (644, 1376))], LIME, 26, 0.25),
        ]
        for sg, col, wd, d in segs:
            pts = bezier_pts(sg)
            head = e_out(prog(t, t0 + 0.25 + d, 0.6))
            tail = e_io(prog(t, t0 + 1.05 + d, 0.55))
            stroke_part(ctx, pts, tail, head, wd, col)

    # J: MAKE IT YOURS. — the finished look as hero
    def sec_J(self, ctx, t):
        t0, end = self.S["J"], self.S["K"]
        white(ctx)
        u = e_out(prog(t, t0, 0.5))
        # orbit ring behind him
        o = e_out(prog(t, t0 + 0.1, 0.6))
        ctx.save()
        ctx.set_source_rgba(*COBALT, 1)
        ctx.set_line_width(10)
        ctx.arc(540, 1240, 400 * o, -math.pi / 2, -math.pi / 2 + 2 * math.pi * o)
        ctx.stroke()
        ctx.restore()
        ph = lerp(1080, 1160, u) + 25 * prog(t, t0, end - t0)
        self.person(ctx, self.after, 540, 1870, ph)
        sw = e_io(prog(t, t0 + 1.05, 0.38))  # paint wipe rises to the olive look, then back
        sb = e_io(prog(t, t0 + 1.6, 0.3))
        if sw > 0 and sb < 1:
            y_top = lerp(1900, 640, sw)
            y_bot = lerp(1900, 640, sb)
            ctx.save()
            ctx.rectangle(0, y_top, W, max(0, y_bot - y_top) if sb > 0 else H)
            ctx.clip()
            white(ctx)
            ctx.set_source_rgb(*LIME)
            ctx.arc(540, 1240, 400, 0, 2 * math.pi)
            ctx.fill()
            self.person(ctx, self.look["A4"], 540, 1880, ph * 1.02)
            ctx.restore()
            for yy, live in ((y_top, sw < 1), (y_bot, 0 < sb < 1)):
                if live:
                    ctx.set_source_rgb(*COBALT)
                    ctx.rectangle(0, yy - 12, W, 24)
                    ctx.fill()
        T = self.T
        out = end - 0.3
        T.word(ctx, "MAKE IT", W / 2, 360, 190, t, t0 + 0.1, t_out=out, stagger=0.03, dur=0.38)
        d = T.word(ctx, "YOURS.", W / 2, 570, 190, t, t0 + 0.22, t_out=out, stagger=0.03, dur=0.38)
        # a small lime underline paints under YOURS
        p = e_out(prog(t, t0 + 0.6, 0.35)) * (1 - prog(t, out, 0.2))
        if p > 0:
            stroke_part(ctx, bezier_pts([((250, 625), (400, 615), (650, 630), (790, 615))]), 0, p, 18, LIME)
        self._dot_J = d

    # K: a final orange brush stroke closes into a point at the logo's dot
    def sec_K(self, ctx, t):
        t0, end = self.S["K"], self.S["L"]
        white(ctx)
        # Arjun drops away
        fall = e_in(prog(t, t0, 0.3))
        if fall < 1:
            self.person(ctx, self.after, 540, 1870 + 1300 * fall, 1185, 1 - fall)
        pts = bezier_pts([((-80, 1500), (300, 1700), (500, 400), (900, 700)), ((900, 700), (1150, 900), (800, 1250), self.logo_dot[:2])])
        head = e_out(prog(t, t0 + 0.12, 0.6))
        tail = e_io(prog(t, t0 + 0.45, 0.6))
        stroke_part(ctx, pts, tail, head, 70, ORANGE)
        settle = prog(t, t0 + 0.9, 0.2)
        if settle > 0:
            dot(ctx, *self.logo_dot[:2], self.logo_dot[2] * back(settle, 2.0))

    # L: the F resolves around the dot, then holds
    def sec_L(self, ctx, t):
        t0 = self.S["L"]
        white(ctx)
        self.F(ctx, t0, t)
        dot(ctx, *self.logo_dot)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("work", type=Path)
    ap.add_argument("--stills", nargs="*", type=float)
    a = ap.parse_args()
    ad = Ad(a.work)
    out = a.work / "render"
    out.mkdir(parents=True, exist_ok=True)
    if a.stills is not None:
        s = cairo.ImageSurface(cairo.FORMAT_ARGB32, W, H)
        for t in a.stills:
            ctx = cairo.Context(s)
            ad.frame(ctx, t)
            s.write_to_png(str(out / f"still_{t:05.2f}.png"))
        print("stills:", out)
        return
    keys = list(ad.S)
    scenes = []
    for i, (k0, k1) in enumerate(zip(keys, keys[1:])):
        s0, s1 = ad.S[k0], ad.S[k1]
        scenes.append(Scene(f"{i:02d}_{k0}", s0, s1 - s0, lambda ctx, t, T, s0=s0: ad.frame(ctx, s0 + t)))
    files = [render_scene(s, out / "scenes") for s in scenes]
    audio = a.work / "render" / "music.wav"
    join(files, audio if audio.exists() else None, out / "forma_ad.mp4")
    print("done:", out / "forma_ad.mp4", " sections:", {k: round(v, 3) for k, v in ad.S.items()})


if __name__ == "__main__":
    main()
