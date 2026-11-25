"""Reaction reel: "Why does Sidharth Malhotra's face look so attractive?" — 9:16, ~45 s, generated voice.

    python studio/reels/sid_face.py studio/work/sid                       # → render/sid_face.mp4
    python studio/reels/sid_face.py studio/work/sid --stills 1 5 12 ...

Inputs in <work>:
  img/0*.png          EDSR x3 upscales of the Commons photos (CC BY 3.0, Bollywood Hungama)
  lm01.json           Face Mesh landmarks + hairline row on the ORIGINAL 01 photo (x3 → upscaled coords)
  voice/narration.wav, voice/words.json, voice/lines.json   (lib/voice.py + lib/timeline.py)

Every graphic is anchored to a spoken word and every line is drawn on his measured landmarks.
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

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "lib"))
from render import find_word, rounded  # noqa: E402

W, H, FPS = 1080, 1920, 30
LEAD = 0.35
TAIL = 2.4
ORANGE = (1.0, 0x4F / 255, 0x2A / 255)
WHITE = (1, 1, 1)
INK = (0.06, 0.06, 0.07)
DISPLAY = "Inter Tight Heavy"
SANS = "Inter Tight"
SERIF = "Playfair Display"
MONO = "IBM Plex Mono"
CREDIT = "PHOTOS: BOLLYWOOD HUNGAMA / WIKIMEDIA COMMONS (CC BY 3.0)"
JAW = [234, 93, 132, 58, 172, 136, 150, 149, 176, 148, 152, 377, 400, 378, 379, 365, 397, 288, 361, 323, 454]
BROW_L = [70, 63, 105, 66, 107]
BROW_R = [336, 296, 334, 293, 300]


def clamp(x, a=0.0, b=1.0):
    return max(a, min(b, x))


def prog(t, t0, d):
    return clamp((t - t0) / d) if d > 0 else float(t >= t0)


def e_out(x):
    return 1.0 if x >= 1 else 1 - 2 ** (-10 * x)


def e_in(x):
    return 0.0 if x <= 0 else 2 ** (10 * (x - 1))


def e_io(x):
    if x <= 0:
        return 0.0
    if x >= 1:
        return 1.0
    return 2 ** (20 * x - 10) / 2 if x < 0.5 else (2 - 2 ** (-20 * x + 10)) / 2


def e_back(x, s=1.8):
    x = clamp(x) - 1
    return x * x * ((s + 1) * x + s) + 1


def lerp(a, b, u):
    return a + (b - a) * u


_KEEP = []


def to_surface(bgra):
    arr = np.ascontiguousarray(bgra)
    _KEEP.append(arr)
    return cairo.ImageSurface.create_for_data(memoryview(arr), cairo.FORMAT_ARGB32, arr.shape[1], arr.shape[0], arr.strides[0])


def premul(bgr, alpha):
    a = alpha[..., None].astype(np.float32)
    out = np.dstack([bgr.astype(np.float32) * a, a[..., 0] * 255]).astype(np.uint8)
    return out


class Photo:
    """An upscaled photo with a subject/background split for parallax."""

    def __init__(self, path: Path, seg):
        bgr = cv2.imread(str(path))
        self.h, self.w = bgr.shape[:2]
        self.full = to_surface(cv2.cvtColor(bgr, cv2.COLOR_BGR2BGRA))
        small = cv2.resize(bgr, (512, round(512 * self.h / self.w)))
        m = seg.process(cv2.cvtColor(small, cv2.COLOR_BGR2RGB)).segmentation_mask
        m = cv2.resize(m, (self.w, self.h))
        m = cv2.GaussianBlur(np.clip((m - 0.35) / 0.3, 0, 1), (0, 0), 3)
        self.fg = to_surface(premul(bgr, m))
        bg = cv2.inpaint(cv2.resize(bgr, (self.w // 4, self.h // 4)), (cv2.resize(m, (self.w // 4, self.h // 4)) > 0.3).astype(np.uint8) * 255, 5, cv2.INPAINT_TELEA)
        bg = cv2.GaussianBlur(cv2.resize(bg, (self.w, self.h)), (0, 0), 6)
        bg = (bg.astype(np.float32) * 0.62).astype(np.uint8)  # pushed back: darker, softer
        self.bg = to_surface(cv2.cvtColor(bg, cv2.COLOR_BGR2BGRA))
        g = cv2.cvtColor(cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY), cv2.COLOR_GRAY2BGR)
        self.grey = to_surface(cv2.cvtColor((g * 0.7).astype(np.uint8), cv2.COLOR_BGR2BGRA))


def paint_cam(ctx, surf, iw, ih, cx, cy, s, alpha=1.0, ox=0.0, oy=0.0):
    """Show image point (cx, cy) at canvas centre (+offset) with scale s (canvas px per image px)."""
    ctx.save()
    ctx.translate(W / 2 + ox, H / 2 + oy)
    ctx.scale(s, s)
    ctx.translate(-cx, -cy)
    ctx.set_source_surface(surf, 0, 0)
    ctx.get_source().set_filter(cairo.FILTER_GOOD)
    ctx.paint_with_alpha(alpha)
    ctx.restore()


def cover_scale(iw, ih):
    return max(W / iw, H / ih)


class Reel:
    def __init__(self, work: Path):
        import mediapipe as mp

        self.work = work
        seg = mp.solutions.selfie_segmentation.SelfieSegmentation(model_selection=1)
        names = sorted(p.name for p in (work / "img").glob("0*.png"))
        self.ph = {n[:2]: Photo(work / "img" / n, seg) for n in names}
        d = json.loads((work / "lm01.json").read_text())
        self.L = np.array(d["lm"]) * 3.0
        self.hair = d["hair"] * 3.0
        self.words = json.loads((work / "voice" / "words.json").read_text())
        self.lines = json.loads((work / "voice" / "lines.json").read_text())
        self.narr = sf.info(str(work / "voice" / "narration.wav")).duration
        self.T = LEAD + self.narr + TAIL
        self.Ls = [ln["start"] + LEAD for ln in self.lines]
        rng = np.random.default_rng(4)
        self.grain = [cv2.GaussianBlur(rng.normal(0, 1, (H // 2, W // 2)).astype(np.float32), (0, 0), 0.7) for _ in range(6)]
        yy, xx = np.mgrid[0:H, 0:W]
        r = np.hypot((xx - W / 2) / (W / 2), (yy - H / 2) / (H / 2))
        self.vig = np.clip(r - 0.55, 0, 1) ** 1.6 * 0.75
        # measured facts for the graphics
        L = self.L
        brow = (L[55][1] + L[285][1]) / 2
        base, chin = L[2][1], L[152][1]
        tot = chin - self.hair
        self.thirds = [self.hair, brow, base, chin]
        self.third_pct = [round(100 * (brow - self.hair) / tot), round(100 * (base - brow) / tot), round(100 * (chin - base) / tot)]
        self.jaw_ratio = round(100 * (L[397][0] - L[172][0]) / (L[454][0] - L[234][0]))
        # camera framings on photo 01 (image coords, scale)
        fc = ((L[234][0] + L[454][0]) / 2, (self.hair + chin) / 2)
        self.cam_face = (fc[0], fc[1] + 20, 2.05)
        self.cam_jaw = (fc[0], (L[2][1] + chin) / 2 - 40, 2.25)
        ec = ((L[70][0] + L[300][0]) / 2, (L[105][1] + L[145][1]) / 2)
        self.cam_eyes = (ec[0], ec[1], 3.6)
        self.cam_wide = (self.ph["01"].w / 2, self.ph["01"].h * 0.42, cover_scale(self.ph["01"].w, self.ph["01"].h))
        self.events = []

    # ------------------------------------------------------------ timing helpers
    def w(self, tok, nth=1, after=-1.0):
        return find_word(self.words, tok, nth, after - LEAD if after >= 0 else -1) + LEAD

    def wa(self, tok, sec):
        """First occurrence of tok within line `sec`."""
        return self.w(tok, 1, self.Ls[sec] - 0.05)

    # ------------------------------------------------------------ drawing helpers
    def to_canvas(self, pt, cam, ox=0.0, oy=0.0):
        cx, cy, s = cam
        return (W / 2 + ox + (pt[0] - cx) * s, H / 2 + oy + (pt[1] - cy) * s)

    def text(self, ctx, s, x, y, size, font=DISPLAY, rgb=WHITE, a=1.0, align="c", track=0.0, italic=False, shadow=True):
        ctx.select_font_face(font, cairo.FONT_SLANT_ITALIC if italic else cairo.FONT_SLANT_NORMAL, cairo.FONT_WEIGHT_NORMAL)
        ctx.set_font_size(size)
        widths = [ctx.text_extents(ch).x_advance + track for ch in s] if track else None
        tw = (sum(widths) - track) if track else ctx.text_extents(s).x_advance
        x0 = x - tw / 2 if align == "c" else (x - tw if align == "r" else x)
        for dx, dy, col, al in ([(0, 4, (0, 0, 0), 0.45 * a)] if shadow else []) + [(0, 0, rgb, a)]:
            ctx.set_source_rgba(*col, al)
            if track:
                cx = x0 + dx
                for ch, wd in zip(s, widths):
                    ctx.move_to(cx, y + dy)
                    ctx.show_text(ch)
                    cx += wd
            else:
                ctx.move_to(x0 + dx, y + dy)
                ctx.show_text(s)
        return tw

    def dotted(self, ctx, pts, p, rgb=WHITE, width=5, dash=(2, 13), glow=True):
        """Polyline drawn on to fraction p, round dots, with a soft glow."""
        if p <= 0 or len(pts) < 2:
            return None
        seg = [math.dist(pts[i], pts[i + 1]) for i in range(len(pts) - 1)]
        Ltot = sum(seg)
        rem = Ltot * clamp(p)
        out = [pts[0]]
        for i, d in enumerate(seg):
            u = min(1, rem / d) if d else 1
            out.append((lerp(pts[i][0], pts[i + 1][0], u), lerp(pts[i][1], pts[i + 1][1], u)))
            rem -= d
            if rem <= 0:
                break
        ctx.save()
        ctx.set_line_cap(cairo.LINE_CAP_ROUND)
        ctx.set_line_join(cairo.LINE_JOIN_ROUND)
        if glow:
            ctx.set_source_rgba(*ORANGE, 0.35)
            ctx.set_line_width(width * 3.2)
            ctx.move_to(*out[0])
            for q in out[1:]:
                ctx.line_to(*q)
            ctx.stroke()
        ctx.set_source_rgb(*rgb)
        ctx.set_line_width(width)
        ctx.set_dash(dash)
        ctx.move_to(*out[0])
        for q in out[1:]:
            ctx.line_to(*q)
        ctx.stroke()
        ctx.restore()
        return out[-1]

    def node(self, ctx, x, y, r, a=1.0, rgb=ORANGE):
        if a <= 0:
            return
        ctx.set_source_rgba(*rgb, 0.3 * a)
        ctx.arc(x, y, r * 2.2, 0, 2 * math.pi)
        ctx.fill()
        ctx.set_source_rgba(*rgb, a)
        ctx.arc(x, y, r, 0, 2 * math.pi)
        ctx.fill()
        ctx.set_source_rgba(1, 1, 1, a)
        ctx.arc(x, y, r * 0.45, 0, 2 * math.pi)
        ctx.fill()

    def pill(self, ctx, s, x, y, age, rgb_bg=ORANGE, rgb_fg=WHITE, size=34, anchor="c"):
        """A label pill that pops in (overshoot)."""
        if age < 0:
            return
        k = e_back(prog(age, 0, 0.32), 2.4)
        a = clamp(age / 0.12)
        ctx.select_font_face(DISPLAY)
        ctx.set_font_size(size)
        tw = ctx.text_extents(s).x_advance + 3 * (len(s) - 1)
        pw, ph = tw + size * 1.3, size * 1.75
        bx = x - pw / 2 if anchor == "c" else (x if anchor == "l" else x - pw)
        ctx.save()
        ctx.translate(bx + pw / 2, y)
        ctx.scale(k, k)
        ctx.translate(-(bx + pw / 2), -y)
        rounded(ctx, bx, y - ph / 2, pw, ph, ph / 2)
        ctx.set_source_rgba(*rgb_bg, a)
        ctx.fill()
        self.text(ctx, s, bx + pw / 2, y + size * 0.36, size, rgb=rgb_fg, a=a, track=3, shadow=False)
        ctx.restore()

    def section_title(self, ctx, num, word, t, t0, dur=0.75):
        """Full-screen punch: dims the photo, big orange number, heavy word slides in, then clears."""
        k = t - t0
        if k < 0 or k > dur + 0.25:
            return
        a_in = e_out(prog(k, 0, 0.18))
        a_out = 1 - e_in(prog(k, dur, 0.25))
        a = a_in * a_out
        ctx.set_source_rgba(0, 0, 0, 0.62 * a)
        ctx.paint()
        if k < 0.07:  # flash frame
            ctx.set_source_rgba(1, 1, 1, 0.55 * (1 - k / 0.07))
            ctx.paint()
        y = H * 0.44
        sc = lerp(1.35, 1.0, e_out(prog(k, 0, 0.35)))
        ctx.save()
        ctx.translate(W / 2, y)
        ctx.scale(sc, sc)
        ctx.translate(-W / 2, -y)
        if num:
            self.text(ctx, num, W / 2, y - 40, 190, rgb=ORANGE, a=a)
        dx = (1 - e_out(prog(k, 0.05, 0.4))) * 220
        ctx.save()
        ctx.rectangle(0, y - 10, W, 200)
        ctx.clip()
        self.text(ctx, word, W / 2 + dx, y + 120, 112 if len(word) < 11 else 92, a=a, track=4)
        ctx.restore()
        ctx.restore()

    def whip(self, ctx, draw_a, draw_b, u, direction=1):
        """Horizontal whip pan between two draw callables, u 0..1, with motion-blur streaks."""
        if u <= 0:
            draw_a(0)
            return
        if u >= 1:
            draw_b(0)
            return
        e = e_io(u)
        draw_a(-direction * e * W)
        draw_b(direction * (1 - e) * W)
        # streaks
        ctx.save()
        rng = np.random.default_rng(int(u * 1000))
        for _ in range(26):
            y = rng.uniform(0, H)
            ctx.set_source_rgba(1, 1, 1, 0.05 + 0.1 * math.sin(math.pi * u))
            ctx.rectangle(0, y, W, rng.uniform(2, 9))
            ctx.fill()
        ctx.restore()

    # ------------------------------------------------------------ photo shots
    def shot_parallax(self, ctx, key, k, dur, focus=(0.5, 0.42), push=0.07, ox=0.0, drift=1):
        """Cutaway: background slides slower than the subject; slow push-in."""
        ph = self.ph[key]
        s0 = cover_scale(ph.w, ph.h) * 1.06
        u = clamp(k / max(dur, 0.1))
        s = s0 * (1 + push * u)
        cx, cy = ph.w * focus[0], ph.h * focus[1]
        # keep the frame inside the photo (no black edges), with room for the parallax drift
        hw, hh = W / 2 / s + 40 / s, H / 2 / s + 10 / s
        cx = min(max(cx, hw), ph.w - hw)
        cy = min(max(cy, hh), ph.h - hh)
        paint_cam(ctx, ph.bg, ph.w, ph.h, cx + drift * 18 * u / s, cy, s * 1.0, ox=ox)
        paint_cam(ctx, ph.fg, ph.w, ph.h, cx - drift * 30 * u / s, cy, s * 1.015, ox=ox)

    def shot_face(self, ctx, cam, ox=0.0, grey=False):
        ph = self.ph["01"]
        paint_cam(ctx, ph.grey if grey else ph.full, ph.w, ph.h, cam[0], cam[1], cam[2], ox=ox)

    @staticmethod
    def cam_lerp(a, b, u):
        u = e_io(u)
        # interpolate scale in log space so zooms feel even
        s = math.exp(lerp(math.log(a[2]), math.log(b[2]), u))
        return (lerp(a[0], b[0], u), lerp(a[1], b[1], u), s)

    # ------------------------------------------------------------ scenes
    def frame(self, ctx, t):
        Ls = self.Ls
        ctx.set_source_rgb(0, 0, 0)
        ctx.paint()
        if t < Ls[1]:
            self.sc_hook(ctx, t)
        elif t < Ls[2]:
            self.sc_jaw(ctx, t)
        elif t < Ls[3]:
            self.sc_eyes(ctx, t)
        elif t < Ls[4]:
            self.sc_thirds(ctx, t)
        elif t < Ls[5]:
            self.sc_groom(ctx, t)
        elif t < Ls[6]:
            self.sc_turn(ctx, t)
        else:
            self.sc_end(ctx, t)

    def sc_hook(self, ctx, t):
        t_break = self.wa("Let's", 0) if self._has("Let's") else self.wa("break", 0) - 0.15
        if t < t_break:
            # smile close-up, hard punch-in from the first frame
            ph = self.ph["02"]
            s = cover_scale(ph.w, ph.h) * lerp(1.35, 1.12, e_out(prog(t, 0, 0.6))) * (1 + 0.04 * t / max(t_break, 0.1))
            paint_cam(ctx, ph.full, ph.w, ph.h, ph.w * 0.5, ph.h * 0.36, s)
            if t < 0.1:
                ctx.set_source_rgba(1, 1, 1, 0.6 * (1 - t / 0.1))
                ctx.paint()
            g = cairo.LinearGradient(0, 0, 0, 760)
            g.add_color_stop_rgba(0, 0, 0, 0, 0.75)
            g.add_color_stop_rgba(1, 0, 0, 0, 0)
            ctx.set_source(g)
            ctx.rectangle(0, 0, W, 760)
            ctx.fill()
            # headline words pop as they're said
            rows = [("WHY IS HIS", ["Why", "does"]), ("FACE SO", ["face"]), ("ATTRACTIVE?", ["attractive"])]
            y = 330
            for txt, keys in rows:
                tk = min(self._first(keys, 0) or 99, 99)
                age = t - tk + 0.08
                if age > 0:
                    k = e_back(prog(age, 0, 0.3), 2.2)
                    ctx.save()
                    ctx.translate(W / 2, y - 40)
                    ctx.scale(k, k)
                    ctx.translate(-W / 2, -(y - 40))
                    col = ORANGE if txt.startswith("ATTRACTIVE") else WHITE
                    self.text(ctx, txt, W / 2, y, 118, rgb=col, a=clamp(age / 0.1), track=2)
                    ctx.restore()
                y += 128
            # name tag on "Sidharth"
            tn = self._first(["Sidharth"], 0)
            if tn and t > tn:
                self.pill(ctx, "SIDHARTH MALHOTRA", W / 2, 1180, t - tn, rgb_bg=WHITE, rgb_fg=INK, size=30)
        else:
            # cut to the frontal shot; a face-mesh scan sweeps down
            k = t - t_break
            dur = self.Ls[1] - t_break
            cam = self.cam_lerp(self.cam_wide, self.cam_face, prog(k, 0, 0.9))
            self.shot_face(ctx, cam)
            self.mesh_scan(ctx, cam, prog(k, 0.15, 1.1), fade=1 - prog(k, dur - 0.35, 0.3))
            self.pill(ctx, "BREAKDOWN", W / 2, 300, k - 0.1, size=34)
            self.event("cut → frontal scan", t_break)

    def _has(self, tok):
        try:
            find_word(self.words, tok, 1)
            return True
        except KeyError:
            return False

    def _first(self, toks, sec):
        for tk in toks:
            try:
                return self.wa(tk, sec)
            except KeyError:
                continue
        return None

    def mesh_scan(self, ctx, cam, p, fade=1.0):
        """Face Mesh tessellation revealed by a sweeping scan line."""
        if p <= 0 or fade <= 0:
            return
        import mediapipe as mp

        conns = mp.solutions.face_mesh_connections.FACEMESH_TESSELATION
        L = self.L
        top, bot = min(L[:, 1]) - 30, max(L[:, 1]) + 30
        ys = lerp(top, bot, e_io(p))
        ctx.save()
        ctx.set_line_width(1.1)
        for a, b in conns:
            if L[a][1] > ys and L[b][1] > ys:
                continue
            pa, pb = self.to_canvas(L[a], cam), self.to_canvas(L[b], cam)
            ctx.move_to(*pa)
            ctx.line_to(*pb)
        ctx.set_source_rgba(1, 1, 1, 0.33 * fade)
        ctx.stroke()
        ctx.restore()
        if p < 1:
            yc = self.to_canvas((0, ys), cam)[1]
            g = cairo.LinearGradient(0, yc - 140, 0, yc)
            g.add_color_stop_rgba(0, *ORANGE, 0)
            g.add_color_stop_rgba(1, *ORANGE, 0.28 * fade)
            ctx.set_source(g)
            ctx.rectangle(0, yc - 140, W, 140)
            ctx.fill()
            ctx.set_source_rgba(1, 0.75, 0.6, 0.95 * fade)
            ctx.rectangle(0, yc - 2, W, 4)
            ctx.fill()

    # 01 JAWLINE
    def sc_jaw(self, ctx, t):
        s0, s1 = self.Ls[1], self.Ls[2]
        t_title = s0
        t_jaw = self._first(["jaw", "His"], 1)
        t_angle = self._first(["angle", "sharp"], 1)
        t_ear = self._first(["ear"], 1)
        t_out = self._first(["outline", "strong"], 1)
        cut_at = t_out + 0.55 if t_out else s1 - 1.0
        if t < cut_at:
            cam = self.cam_lerp(self.cam_face, self.cam_jaw, prog(t, s0 + 0.3, 1.2))
            self.shot_face(ctx, cam)
            L = self.L
            left = [L[i] for i in JAW[: JAW.index(152) + 1]]
            right = [L[i] for i in JAW[JAW.index(152):][::-1]]
            t_draw = t_ear - 0.25 if t_ear else (t_jaw or s0) + 0.9
            p = prog(t, t_draw, 1.0)
            for side in (left, right):
                pts = [self.to_canvas(q, cam) for q in side]
                end = self.dotted(ctx, pts, e_io(p), width=6)
                if end and p < 1:
                    self.node(ctx, *end, 9)
            # gonion nodes + angle arcs on "angle"
            if t_angle:
                for g_i, a_i, b_i in ((172, 132, 148), (397, 361, 377)):
                    age = t - t_angle
                    if age > 0:
                        gx, gy = self.to_canvas(L[g_i], cam)
                        self.node(ctx, gx, gy, 10 * e_back(prog(age, 0, 0.3)))
                        ax, ay = self.to_canvas(L[a_i], cam)
                        bx, by = self.to_canvas(L[b_i], cam)
                        a1 = math.atan2(ay - gy, ax - gx)
                        a2 = math.atan2(by - gy, bx - gx)
                        if g_i == 397:
                            a1, a2 = a2, a1
                        ctx.set_source_rgba(*ORANGE, 0.95)
                        ctx.set_line_width(4)
                        ctx.arc(gx, gy, 46, a1, a1 + (a2 - a1 + (2 * math.pi if a2 < a1 else 0)) * e_out(prog(age, 0.05, 0.4)))
                        ctx.stroke()
                self.event("jaw angle arcs", t_angle)
            # jaw width vs face width on "strong outline"
            if t_out:
                age = t - t_out
                if age > 0:
                    y1 = self.to_canvas(L[172], cam)[1] + 4
                    x0, x1 = self.to_canvas(L[172], cam)[0], self.to_canvas(L[397], cam)[0]
                    pw = e_out(prog(age, 0, 0.35))
                    mid = (x0 + x1) / 2
                    ctx.set_source_rgb(*ORANGE)
                    ctx.rectangle(mid - (mid - x0) * pw, y1 - 3, (x1 - x0) * pw, 6)
                    ctx.fill()
                    self.pill(ctx, f"JAW WIDTH {self.jaw_ratio}% OF FACE", W / 2, 1300, age - 0.15, size=30)
            self.pill(ctx, "JAWLINE", W / 2, 300, t - (t_draw + 0.1), size=40)
            self.section_title(ctx, "01", "JAWLINE", t, t_title)
        else:
            k = t - cut_at
            self.whip(ctx, lambda ox: self.shot_face(ctx, self.cam_jaw, ox), lambda ox: self.shot_parallax(ctx, "03", k, s1 - cut_at, (0.5, 0.3), ox=ox), prog(k, 0, 0.28))
            self.event("whip → cutaway (jaw)", cut_at)

    # 02 EYE AREA
    def sc_eyes(self, ctx, t):
        s0, s1 = self.Ls[2], self.Ls[3]
        t_brows = self._first(["brows"], 2)
        t_low = self._first(["low"], 2)
        t_straight = self._first(["straight"], 2)
        t_calm = self._first(["calm", "intense"], 2)
        cut_at = (t_calm + 0.25) if t_calm else s1 - 1.0
        L = self.L
        if t < cut_at:
            cam = self.cam_lerp(self.cam_face, self.cam_eyes, prog(t, s0 + 0.25, 1.0))
            self.shot_face(ctx, cam)
            # spotlight box around the eye band
            x0, y0 = self.to_canvas((L[70][0] - 25, L[105][1] - 30), cam)
            x1, y1 = self.to_canvas((L[300][0] + 25, L[145][1] + 30), cam)
            ap = e_out(prog(t, s0 + 0.9, 0.4))
            if ap > 0:
                ctx.save()
                ctx.rectangle(0, 0, W, H)
                ctx.rectangle(x0, y0, x1 - x0, y1 - y0)
                ctx.set_fill_rule(cairo.FILL_RULE_EVEN_ODD)
                ctx.set_source_rgba(0, 0, 0, 0.55 * ap)
                ctx.fill()
                ctx.restore()
                cl = 50
                ctx.set_source_rgba(1, 1, 1, ap)
                ctx.set_line_width(5)
                for (cx, cy, dx, dy) in ((x0, y0, 1, 1), (x1, y0, -1, 1), (x0, y1, 1, -1), (x1, y1, -1, -1)):
                    ctx.move_to(cx + dx * cl, cy)
                    ctx.line_to(cx, cy)
                    ctx.line_to(cx, cy + dy * cl)
                ctx.stroke()
            # straight line along each brow (fit), drawn on "straight" (fallback "brows")
            ts = t_straight or t_brows
            if ts:
                p = e_io(prog(t, ts - 0.1, 0.55))
                for ids in (BROW_L, BROW_R):
                    pts = np.array([L[i] for i in ids])
                    m, c = np.polyfit(pts[:, 0], pts[:, 1], 1)
                    xa, xb = pts[:, 0].min() - 25, pts[:, 0].max() + 25
                    a_ = self.to_canvas((xa, m * xa + c), cam)
                    b_ = self.to_canvas((xb, m * xb + c), cam)
                    self.dotted(ctx, [a_, b_], p, width=6, dash=(14, 10))
                self.event("brow lines on 'straight'", ts)
            # low-set: brow → lid gap brackets on "low"
            if t_low:
                age = t - t_low
                if age > 0:
                    for bi, ei in ((105, 159), (334, 386)):
                        bx, by = self.to_canvas((L[bi][0], L[bi][1] + 6), cam)
                        _, ey = self.to_canvas(L[ei], cam)
                        pp = e_out(prog(age, 0, 0.35))
                        ctx.set_source_rgb(*ORANGE)
                        ctx.set_line_width(4)
                        ctx.move_to(bx - 14, by)
                        ctx.line_to(bx + 14, by)
                        ctx.move_to(bx, by)
                        ctx.line_to(bx, lerp(by, ey, pp))
                        ctx.move_to(bx - 14, lerp(by, ey, pp))
                        ctx.line_to(bx + 14, lerp(by, ey, pp))
                        ctx.stroke()
                    self.pill(ctx, "LOW-SET", W / 2 - 190, y1 + 90, age, size=32)
                    self.event("brow gap brackets on 'low'", t_low)
            if ts:
                self.pill(ctx, "STRAIGHT", W / 2 + 190, y1 + 90, t - ts, size=32, rgb_bg=WHITE, rgb_fg=INK)
            self.section_title(ctx, "02", "EYE AREA", t, s0)
        else:
            k = t - cut_at
            self.whip(ctx, lambda ox: self.shot_face(ctx, self.cam_eyes, ox), lambda ox: self.shot_parallax(ctx, "08", k, s1 - cut_at, (0.5, 0.26), ox=ox, drift=-1), prog(k, 0, 0.28), direction=-1)
            self.pill(ctx, "CALM · INTENSE", W / 2, 1300, k - 0.25, size=34)
            self.event("whip → cutaway (eyes)", cut_at)

    # 03 FACIAL THIRDS
    def sc_thirds(self, ctx, t):
        s0, s1 = self.Ls[3], self.Ls[4]
        keys = [self._first(["Forehead"], 3), self._first(["mid-face", "mid", "midface"], 3), self._first(["lower"], 3)]
        t_nothing = self._first(["nothing"], 3)
        cut_at = (t_nothing + 1.1) if t_nothing else s1 - 0.8
        if t < cut_at:
            cam = self.cam_lerp(self.cam_jaw, self.cam_face, prog(t, s0, 0.8))
            self.shot_face(ctx, cam)
            ys = [self.to_canvas((0, y), cam)[1] for y in self.thirds]
            xl, xr = 120, W - 190
            first = keys[0] or s0 + 1.2
            # the four guide lines draw in as the thirds are named
            line_t = [first - 0.3, first - 0.15] + [(keys[i] or first + 0.6 * i) - 0.1 for i in (1, 2)]
            for i, y in enumerate(ys):
                p = e_io(prog(t, line_t[i], 0.45))
                self.dotted(ctx, [(xl, y), (xr, y)], p, width=4, dash=(10, 10), glow=False)
            # bands: tint + bracket + percentage counting up
            cols = [(1, 0.31, 0.16), (1, 0.55, 0.3), (1, 0.31, 0.16)]
            pulse = 0.0
            if t_nothing:
                pulse = 0.5 + 0.5 * math.sin(max(0, t - t_nothing) * 9) if t > t_nothing else 0
            for i in range(3):
                tk = keys[i] or first + 0.6 * i
                age = t - tk
                if age <= 0:
                    continue
                y0, y1 = ys[i], ys[i + 1]
                a = e_out(prog(age, 0, 0.3))
                ctx.set_source_rgba(*cols[i], (0.16 + 0.12 * pulse) * a)
                ctx.rectangle(xl, y0, xr - xl, y1 - y0)
                ctx.fill()
                bx = xr + 18
                ctx.set_source_rgba(1, 1, 1, a)
                ctx.set_line_width(4)
                ctx.move_to(bx, y0 + 6)
                ctx.line_to(bx + 16, y0 + 6)
                ctx.line_to(bx + 16, y1 - 6)
                ctx.line_to(bx, y1 - 6)
                ctx.stroke()
                pct = round(self.third_pct[i] * e_out(prog(age, 0, 0.5)))
                self.text(ctx, f"{pct}%", bx + 30, (y0 + y1) / 2 + 14, 40, align="l", a=a)
                self.text(ctx, ["FOREHEAD", "MID-FACE", "LOWER FACE"][i], xl + 14, y0 + 44, 28, font=DISPLAY, align="l", a=a, track=2)
                self.event(f"third {i + 1} on its word", tk)
            if t_nothing:
                self.pill(ctx, "≈ 1/3 · 1/3 · 1/3", W / 2, 1330, t - t_nothing, size=38)
            self.section_title(ctx, "03", "FACIAL THIRDS", t, s0)
        else:
            k = t - cut_at
            self.whip(ctx, lambda ox: self.shot_face(ctx, self.cam_face, ox), lambda ox: self.shot_parallax(ctx, "04", k, s1 - cut_at, (0.5, 0.3), ox=ox), prog(k, 0, 0.28))
            self.event("whip → cutaway (thirds)", cut_at)

    # GROOMING
    def sc_groom(self, ctx, t):
        s0, s1 = self.Ls[4], self.Ls[5]
        t_g = self._first(["grooming"], 4)
        tk = {k: self._first([k], 4) for k in ("skin", "brows", "beard")}
        t_every = self._first(["every", "feature"], 4)
        L = self.L
        if t_every is None or t < t_every:
            cam = self.cam_lerp(self.cam_wide, self.cam_face, prog(t, s0, 1.0))
            self.shot_face(ctx, cam)
            spots = {"skin": (L[50], "l"), "brows": (L[105], "l"), "beard": (L[175], "r")}
            ylab = {"skin": 1180, "brows": 560, "beard": 1430}
            for key, (pt, side) in spots.items():
                tt = tk[key]
                if not tt or t < tt:
                    continue
                age = t - tt
                px, py = self.to_canvas(pt, cam)
                lx = 150 if side == "l" else W - 150
                ly = ylab[key]
                self.node(ctx, px, py, 11 * e_back(prog(age, 0, 0.3)))
                pp = e_out(prog(age, 0.05, 0.3))
                ctx.set_source_rgba(1, 1, 1, 0.9)
                ctx.set_line_width(3)
                ctx.move_to(px, py)
                ctx.line_to(lerp(px, lx, pp), lerp(py, ly, pp))
                ctx.stroke()
                self.pill(ctx, key.upper(), lx, ly, age - 0.2, size=40, anchor="l" if side == "l" else "r")
                self.event(f"label {key.upper()}", tt)
            self.section_title(ctx, "", "GROOMING", t, t_g or s0 + 0.8, dur=0.9)
            if t_g and t >= t_g - 0.2:
                pass
            # opening line of the section: "But the real secret is…" — kicker
            if t < (t_g or s0 + 0.8):
                self.pill(ctx, "THE REAL SECRET", W / 2, 300, t - s0 - 0.05, size=40)
        else:
            # "make every feature stand out more": rapid-fire cutaways on the beat
            k = t - t_every
            seq = ["07", "05", "06", "03"]
            dur = (s1 - t_every) / len(seq)
            i = min(len(seq) - 1, int(k / dur))
            kk = k - i * dur
            self.shot_parallax(ctx, seq[i], kk, dur, (0.5, 0.3), push=0.12, drift=1 if i % 2 else -1)
            if kk < 0.06:
                ctx.set_source_rgba(1, 1, 1, 0.45 * (1 - kk / 0.06))
                ctx.paint()
            if seq[i] == "07":
                self.pill(ctx, "THE BEARD FRAMES THE JAW", W / 2, 1300, kk - 0.05, size=30)
            self.event("montage cut", t_every + i * dur)

    # TURN
    def sc_turn(self, ctx, t):
        s0, s1 = self.Ls[5], self.Ls[6]
        t_but = self._first(["but", "But"], 5) or (s0 + s1) / 2
        t_framed = self._first(["framed"], 5)
        if t < t_but:
            # "You can't change your bones": desaturated, full mesh (the 'bones')
            self.shot_face(ctx, self.cam_face, grey=True)
            self.mesh_scan(ctx, self.cam_face, 1.0, fade=e_out(prog(t, s0, 0.3)))
            self.pill(ctx, "BONES: FIXED", W / 2, 300, t - s0 - 0.2, rgb_bg=WHITE, rgb_fg=INK, size=36)
        else:
            k = t - t_but
            cam = self.cam_lerp(self.cam_face, self.cam_wide, prog(k, 0, 1.2))
            ph = self.ph["01"]
            self.shot_face(ctx, cam)
            paint_cam(ctx, ph.grey, ph.w, ph.h, cam[0], cam[1], cam[2], alpha=1 - e_out(prog(k, 0, 0.6)))
            # orange frame brackets snap around his face on "framed"
            tf = t_framed or t_but + 0.8
            age = t - tf
            if age > -0.4:
                L = self.L
                x0, y0 = self.to_canvas((L[234][0] - 40, self.hair - 40), cam)
                x1, y1 = self.to_canvas((L[454][0] + 40, L[152][1] + 50), cam)
                k2 = e_back(prog(age + 0.4, 0, 0.45), 1.6)
                cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
                hw, hh = (x1 - x0) / 2 * lerp(1.6, 1.0, k2), (y1 - y0) / 2 * lerp(1.6, 1.0, k2)
                cl = 70
                ctx.set_source_rgba(*ORANGE, clamp(k2 * 1.5))
                ctx.set_line_width(9)
                for sx, sy in ((-1, -1), (1, -1), (-1, 1), (1, 1)):
                    X, Y = cx + sx * hw, cy + sy * hh
                    ctx.move_to(X - sx * cl, Y)
                    ctx.line_to(X, Y)
                    ctx.line_to(X, Y - sy * cl)
                ctx.stroke()
                self.event("frame brackets on 'framed'", tf)
            self.pill(ctx, "FRAMING: YOURS TO CHANGE", W / 2, 300, t - t_but - 0.1, size=32)

    # END
    def sc_end(self, ctx, t):
        s0 = self.Ls[6]
        k = t - s0
        # blurred background of the hook photo
        ph = self.ph["02"]
        paint_cam(ctx, ph.bg, ph.w, ph.h, ph.w / 2, ph.h * 0.4, cover_scale(ph.w, ph.h) * 1.1)
        ctx.set_source_rgba(0, 0, 0, 0.45)
        ctx.paint()
        if k < 0.07:
            ctx.set_source_rgba(1, 1, 1, 0.5 * (1 - k / 0.07))
            ctx.paint()
        # three mystery cards: who's next?
        cw, chh, gap = 250, 340, 34
        for i in range(3):
            age = k - 0.1 - i * 0.12
            if age < 0:
                continue
            a = e_out(prog(age, 0, 0.3))
            x = W / 2 - (3 * cw + 2 * gap) / 2 + i * (cw + gap)
            y = 640 + (1 - e_back(prog(age, 0, 0.45))) * 120
            rounded(ctx, x, y, cw, chh, 26)
            ctx.set_source_rgba(1, 1, 1, 0.1 * a)
            ctx.fill_preserve()
            ctx.set_source_rgba(1, 1, 1, 0.8 * a)
            ctx.set_line_width(3)
            ctx.stroke()
            q = 1 + 0.06 * math.sin(k * 6 + i)
            ctx.save()
            ctx.translate(x + cw / 2, y + chh / 2)
            ctx.scale(q, q)
            ctx.translate(-(x + cw / 2), -(y + chh / 2))
            self.text(ctx, "?", x + cw / 2, y + chh / 2 + 70, 200, rgb=ORANGE if i == 1 else WHITE, a=a)
            ctx.restore()
        self.text(ctx, "WHO'S NEXT?", W / 2, 470, 120, a=e_out(prog(k, 0, 0.3)), track=3)
        t_comment = self._first(["Comment"], 6) or s0 + 1.4
        age = t - t_comment
        if age > 0:
            self.pill(ctx, "COMMENT BELOW", W / 2, 1150, age, size=46)
            # bouncing arrow
            by = 1290 + 18 * abs(math.sin(age * 5))
            ctx.set_source_rgb(1, 1, 1)
            ctx.move_to(W / 2 - 34, by)
            ctx.line_to(W / 2 + 34, by)
            ctx.line_to(W / 2, by + 44)
            ctx.close_path()
            ctx.fill()
        if k > 1.0:
            self.text(ctx, "FOLLOW FOR PART 2", W / 2, 1450, 34, font=MONO, a=0.85 * e_out(prog(k, 1.0, 0.4)), track=3)

    # ------------------------------------------------------------ overlays across the reel
    def caption(self, ctx, t):
        """Word-by-word captions: italic serif, words appear as spoken, the current word in orange."""
        chunks = self.chunks
        cur = None
        for c in chunks:
            if c[0]["s"] <= t < c[-1]["n"]:
                cur = c
        if not cur:
            return
        ctx.select_font_face(SERIF, cairo.FONT_SLANT_ITALIC, cairo.FONT_WEIGHT_BOLD)
        size = 66
        ctx.set_font_size(size)
        widths = [ctx.text_extents(w_["w"] + " ").x_advance for w_ in cur]
        x = W / 2 - (sum(widths) - ctx.text_extents(" ").x_advance) / 2
        y = 1520
        for w_, wd in zip(cur, widths):
            age = t - w_["s"]
            if age < 0:
                break
            k = e_back(prog(age, 0, 0.18), 2.0)
            active = w_["s"] <= t < w_["e"] + 0.05
            ctx.save()
            ctx.translate(x + wd / 2, y)
            ctx.scale(k, k)
            ctx.translate(-(x + wd / 2), -y)
            for r, al in ((7, 0.06), (4, 0.08), (2, 0.1)):
                for j in range(12):
                    ang = j * math.pi / 6
                    ctx.set_source_rgba(0, 0, 0, al)
                    ctx.move_to(x + r * math.cos(ang), y + 2 + r * math.sin(ang))
                    ctx.show_text(w_["w"])
            ctx.set_source_rgb(*(ORANGE if active else WHITE))
            ctx.move_to(x, y)
            ctx.show_text(w_["w"])
            ctx.restore()
            x += wd

    def build_chunks(self):
        ws = [{"w": x["word"].strip(), "s": x["start"] + LEAD, "e": x["end"] + LEAD} for x in self.words]
        chunks, cur = [], []
        for i, w_ in enumerate(ws):
            cur.append(w_)
            nxt = ws[i + 1] if i + 1 < len(ws) else None
            brk = w_["w"].endswith((".", ",", "?", "!")) or len(cur) >= 3 or nxt is None or (nxt["s"] - w_["e"] > 0.35)
            if brk:
                end = nxt["s"] if nxt and nxt["s"] - w_["e"] < 0.35 else w_["e"] + 0.3
                for c in cur:
                    c["n"] = end
                chunks.append(cur)
                cur = []
        self.chunks = chunks

    def credit(self, ctx, t):
        if t > self.Ls[6]:
            return
        ctx.select_font_face(MONO)
        ctx.set_font_size(17)
        ex = ctx.text_extents(CREDIT)
        ctx.set_source_rgba(1, 1, 1, 0.55)
        ctx.move_to(W / 2 - ex.x_advance / 2, 170)
        ctx.show_text(CREDIT)

    def finish(self, s, t):
        """Grain + vignette over everything (cheap, numpy)."""
        buf = np.ndarray((H, W, 4), np.uint8, s.get_data(), strides=(s.get_stride(), 4, 1))
        f = buf[..., :3].astype(np.float32)
        g = cv2.resize(self.grain[int(t * FPS) % len(self.grain)], (W, H), interpolation=cv2.INTER_LINEAR)[..., None]
        f = f * (1 - self.vig[..., None]) + g * 5.5
        buf[..., :3] = np.clip(f, 0, 255).astype(np.uint8)
        s.mark_dirty()

    def event(self, name, t):
        if not any(e["name"] == name for e in self.events):
            self.events.append({"name": name, "t": round(t, 3)})

    def compose(self, t):
        s = cairo.ImageSurface(cairo.FORMAT_ARGB32, W, H)
        ctx = cairo.Context(s)
        self.frame(ctx, t)
        self.credit(ctx, t)
        self.caption(ctx, t)
        s.flush()
        self.finish(s, t)
        return s


# ------------------------------------------------------------ sound
def build_audio(reel: Reel, out: Path):
    SR = 48000
    n = int(reel.T * SR)
    t = np.arange(n) / SR
    rng = np.random.default_rng(12)
    narr, sr = sf.read(str(reel.work / "voice" / "narration.wav"), dtype="float32")
    if sr != SR:
        from scipy.signal import resample_poly

        narr = resample_poly(narr, SR, sr)
    voice = np.zeros(n)
    i0 = int(LEAD * SR)
    voice[i0:i0 + len(narr)] = narr[: n - i0]

    def env(at, a, d):
        return np.where(t >= at, np.minimum(1, (t - at) / a) * np.exp(-(t - at) / d), 0)

    # music: 100 bpm minimal beat, Am – F – C – G
    bpm = 100
    beat = 60 / bpm
    music = np.zeros(n)
    end_music = reel.T - 0.3
    roots = [55.0, 43.65, 65.41, 49.0]
    k = 0
    tb = 0.0
    while tb < end_music:
        bar = int(tb / (4 * beat))
        root = roots[bar % 4]
        idx = int(tb * SR)
        L_ = int(0.45 * SR)
        tt = np.arange(L_) / SR
        if k % 4 in (0, 2):  # kick
            fr = 48 + 60 * np.exp(-tt / 0.03)
            seg = np.sin(2 * np.pi * np.cumsum(fr) / SR) * np.exp(-tt / 0.16)
            music[idx:idx + L_] += 0.9 * seg[: max(0, n - idx)]
        if k % 4 in (1, 3):  # clap
            cl = rng.standard_normal(int(0.2 * SR)) * np.exp(-np.arange(int(0.2 * SR)) / SR / 0.05)
            music[idx:idx + len(cl)] += 0.22 * cl[: max(0, n - idx)]
        # hats on the 8ths
        for off in (0, beat / 2):
            j = int((tb + off) * SR)
            hl = int(0.05 * SR)
            hh = np.diff(np.concatenate([[0], rng.standard_normal(hl)])) * np.exp(-np.arange(hl) / SR / 0.012)
            music[j:j + hl] += 0.06 * hh[: max(0, n - j)]
        # sub bass on 1 and the "and" of 3
        for off in (0, beat * 2.5):
            j = int((tb + off) * SR) if k % 4 == 0 else -1
            if j >= 0:
                bl = int(beat * 1.2 * SR)
                bt = np.arange(bl) / SR
                music[j:j + bl] += 0.35 * np.tanh(2 * np.sin(2 * np.pi * root * bt)) * np.exp(-bt / 0.35)[: max(0, n - j)][:bl] if j + bl <= n else 0
        tb += beat
        k += 1
    # pad
    for b in range(int(end_music / (4 * beat)) + 1):
        st = b * 4 * beat
        r = roots[b % 4] * 4
        seg_n = int(4 * beat * SR)
        j = int(st * SR)
        tt = np.arange(seg_n) / SR
        pad = sum(np.sin(2 * np.pi * f * tt) for f in (r, r * 1.189, r * 1.498)) / 3
        pad *= np.minimum(1, tt / 0.3) * np.minimum(1, (4 * beat - tt) / 0.3)
        music[j:j + seg_n] += 0.06 * pad[: max(0, n - j)]
    # duck the music under the voice
    venv = np.abs(voice)
    k_ = int(0.08 * SR)
    venv = np.convolve(venv, np.ones(k_) / k_, mode="same")
    duck = 1 - 0.65 * np.clip(venv / (np.percentile(venv[venv > 0], 70) + 1e-6), 0, 1)
    music *= duck
    music *= np.clip((reel.T - 0.5 - t) / 1.0, 0, 1)

    # sound effects from the visual events and section starts
    sfx = np.zeros(n)
    noise = rng.standard_normal(n)

    def whoosh(at, length=0.35, g=0.5):
        i0, i1 = int(max(0, at - length * 0.6) * SR), min(n, int((at + length * 0.4) * SR))
        if i1 <= i0:
            return
        seg = noise[i0:i1].copy()
        acc = 0.0
        a = np.linspace(0.02, 0.35, i1 - i0)
        for i in range(len(seg)):
            acc += a[i] * (seg[i] - acc)
            seg[i] = acc
        seg *= np.sin(np.linspace(0, np.pi, len(seg)))
        sfx[i0:i1] += g * seg / (np.abs(seg).max() + 1e-6)

    def pop(at, f=900, g=0.25):
        sfx[:] += g * np.sin(2 * np.pi * (f * (t - at) + 900 * np.clip(t - at, 0, None) ** 2)) * env(at, 0.002, 0.05)

    def hit(at, g=0.6):
        fr = 42 + 50 * np.exp(-np.clip(t - at, 0, None) / 0.05)
        sfx[:] += g * np.sin(2 * np.pi * np.cumsum(fr) / SR) * env(at, 0.002, 0.4)

    whoosh(0.0, 0.3, 0.4)
    hit(0.02, 0.7)
    for i in (1, 2, 3):
        whoosh(reel.Ls[i], 0.4, 0.55)
        hit(reel.Ls[i] + 0.02, 0.45)
    for e in reel.events:
        nm = e["name"]
        if nm.startswith("whip") or nm.startswith("montage") or nm.startswith("cut"):
            whoosh(e["t"] + 0.12, 0.3, 0.45)
        else:
            pop(e["t"], 700 + 300 * (hash(nm) % 3), 0.18)
    hit(reel.Ls[5], 0.4)
    hit(reel.Ls[6], 0.6)
    whoosh(reel.Ls[6], 0.4, 0.5)

    mix = voice * 1.0 + music * 0.16 + sfx * 0.22
    mix /= np.abs(mix).max() / 0.92
    sf.write(out, np.stack([mix, mix], 1), SR)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("work", type=Path)
    ap.add_argument("--stills", nargs="*", type=float)
    a = ap.parse_args()
    reel = Reel(a.work)
    reel.build_chunks()
    R = a.work / "render"
    print("sections:", [round(x, 2) for x in reel.Ls], "total", round(reel.T, 2), "thirds%", reel.third_pct, "jaw%", reel.jaw_ratio)
    if a.stills is not None:
        for t in a.stills:
            reel.compose(t).write_to_png(str(R / f"s_{t:05.2f}.png"))
        return
    vid = R / "video.mp4"
    p = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgra", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
                          "-c:v", "libx264", "-preset", "medium", "-crf", "17", "-pix_fmt", "yuv420p", "-an", str(vid)], stdin=subprocess.PIPE)
    for i in range(int(round(reel.T * FPS))):
        p.stdin.write(bytes(reel.compose(i / FPS).get_data()))
    p.stdin.close()
    assert p.wait() == 0
    (R / "events.json").write_text(json.dumps(reel.events, indent=1))
    wav = R / "audio.wav"
    build_audio(reel, wav)
    out = R / "sid_face.mp4"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(vid), "-i", str(wav), "-map", "0:v", "-map", "1:a", "-c:v", "copy",
                    "-af", "loudnorm=I=-14:TP=-1.5:LRA=9,aresample=48000", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", str(out)], check=True)
    print("done:", out)


if __name__ == "__main__":
    main()
