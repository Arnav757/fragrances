"""Reaction reel: "Why is Salman Khan so cool?" — 9:16, archive footage + photos, generated voice, FORMA styling.

    python studio/reels/salman_clips.py studio/work/salman              # cut + face-track the footage first
    python studio/reels/salman_cool.py studio/work/salman               # → render/salman_cool.mp4
    python studio/reels/salman_cool.py studio/work/salman --stills 1 5 ...

Inputs in <work>: img/01..08.png (photos, borders cropped), clips/*.mp4 + *.json (salman_clips.py),
voice/narration.wav, voice/words.json, voice/lines.json.
Built on srk_face.Reel / sid_face.Reel (brand panels, captions, pills, stripe wipes, logo). New here: footage playback
with face tracks, time-echo crowd, text behind the subject, freeze frames, a swagger trap/strings score.
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
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "lib"))
import sid_face as base  # noqa: E402
import srk_face as srk  # noqa: E402
from render import rounded  # noqa: E402
from sid_face import (COBALT, DISPLAY, FPS, H, ICE, INK, LEAD, LIME, MONO, ORANGE, WHITE, W, Photo, clamp,  # noqa: E402
                      cover_scale, e_back, e_in, e_io, e_out, lerp, paint_cam, prog)

TAIL = 5.4
PURPLE = (0x7A / 255, 0x3B / 255, 1.0)      # neon violet, pulled from the night-party footage
VIOLET_INK = (0.09, 0.05, 0.17)
CREDIT = "FOOTAGE & PHOTOS: PRESS ARCHIVE · FAN EDIT"


class Vid:
    """Sequential-friendly frame reader for a prepared clip (1080x1920 or wide), with its face track."""

    def __init__(self, path: Path):
        self.cap = cv2.VideoCapture(str(path))
        meta = json.loads(path.with_suffix(".json").read_text())
        self.fps, self.track = meta["fps"], meta["track"]
        self.n = int(self.cap.get(cv2.CAP_PROP_FRAME_COUNT)) or meta["n"]
        self.n = min(self.n, len(self.track))
        self.last, self.frame = -1, None

    def get(self, i):
        i = int(min(max(i, 0), self.n - 1))
        if i == self.last:
            return self.frame
        if i != self.last + 1:
            self.cap.set(cv2.CAP_PROP_POS_FRAMES, i)
        ok, f = self.cap.read()
        if not ok:
            return self.frame
        self.last, self.frame = i, f
        return f

    def at(self, k, speed=1.0):
        i = k * self.fps * speed
        return int(min(max(i, 0), self.n - 1))


class Reel(srk.Reel):
    def __init__(self, work: Path):  # noqa: C901
        import mediapipe as mp

        self.work = work
        seg = mp.solutions.selfie_segmentation.SelfieSegmentation(model_selection=1)
        self.seg_v = mp.solutions.selfie_segmentation.SelfieSegmentation(model_selection=0)
        self.ph = {p.stem: Photo(p, seg) for p in sorted((work / "img").glob("0*.png"))}
        self.v = {p.stem: Vid(p) for p in sorted((work / "clips").glob("*.mp4")) if p.stem != "crowd"}
        self.words = json.loads((work / "voice" / "words.json").read_text())
        self.lines = json.loads((work / "voice" / "lines.json").read_text())
        self.narr = sf.info(str(work / "voice" / "narration.wav")).duration
        self.T = LEAD + self.narr + TAIL
        self.Ls = [ln["start"] + LEAD for ln in self.lines]
        self.t_logo = LEAD + self.narr + 1.9
        rng = np.random.default_rng(4)
        self.grain = [cv2.GaussianBlur(rng.normal(0, 1, (H // 2, W // 2)).astype(np.float32), (0, 0), 0.7) for _ in range(6)]
        yy, xx = np.mgrid[0:H, 0:W]
        r = np.hypot((xx - W / 2) / (W / 2), (yy - H / 2) / (H / 2))
        self.vig = np.clip(r - 0.6, 0, 1) ** 1.6 * 0.5
        self.events = []
        self._in_end = False
        # the crowd clip lives in memory (wide band + echo needs neighbouring frames)
        cap = cv2.VideoCapture(str(work / "clips" / "crowd.mp4"))
        cm = json.loads((work / "clips" / "crowd.json").read_text())
        self.band_h = 600
        sc = self.band_h / 740
        self.crowd, ok = [], True
        while ok:
            ok, f = cap.read()
            if ok:
                self.crowd.append(cv2.resize(f, (int(1920 * sc), self.band_h), interpolation=cv2.INTER_AREA))
        self.crowd_track = [(x * sc, y * sc) for x, y in cm["track"]][: len(self.crowd)]
        self.crowd_fps = cm["fps"]
        self._mask_cache = {}
        self.cam_wide = (0.0, 0.0, 1.0)  # placeholder: the base end card wipes up over shot_face_end()

    def stripe_wipe(self, ctx, draw_a, draw_b, u, cols=(PURPLE, ORANGE, LIME)):
        cols = tuple(PURPLE if c == COBALT else c for c in cols)
        srk.Reel.stripe_wipe(self, ctx, draw_a, draw_b, u, cols=cols)

    def haze(self, ctx, t):
        """Purple light leak drifting in from a corner (screen blend: leaves the white panels white)."""
        x = W * (0.85 + 0.1 * math.sin(t * 0.35))
        y = H * (0.12 + 0.06 * math.cos(t * 0.27))
        g = cairo.RadialGradient(x, y, 0, x, y, 850)
        g.add_color_stop_rgba(0, *PURPLE, 0.22)
        g.add_color_stop_rgba(0.55, *PURPLE, 0.06)
        g.add_color_stop_rgba(1, *PURPLE, 0)
        ctx.save()
        ctx.set_operator(cairo.OPERATOR_SCREEN)
        ctx.set_source(g)
        ctx.paint()
        g2 = cairo.RadialGradient(W * 0.1, H * 0.92, 0, W * 0.1, H * 0.92, 800)
        g2.add_color_stop_rgba(0, *PURPLE, 0.12)
        g2.add_color_stop_rgba(1, *PURPLE, 0)
        ctx.set_source(g2)
        ctx.paint()
        ctx.restore()

    # ------------------------------------------------------------ footage helpers
    def vid(self, ctx, name, k, speed=1.0, zoom=1.0, ox=0.0, oy=0.0, freeze=None, grey=False, alpha=1.0):
        """Draw a 9:16 clip full-frame; zoom pivots on his tracked face. freeze=k_hold holds that moment."""
        v = self.v[name]
        kk = min(k, freeze) if freeze is not None else k
        i = v.at(kk, speed)
        f = v.get(i)
        if grey:
            g = cv2.cvtColor(f, cv2.COLOR_BGR2GRAY)
            f = cv2.cvtColor((g * 0.75).astype(np.uint8), cv2.COLOR_GRAY2BGR)
        s = base.to_surface(cv2.cvtColor(f, cv2.COLOR_BGR2BGRA))
        fx, fy = v.track[i]
        fx, fy = fx, fy if 0 < fy < H else H * 0.35
        ctx.save()
        ctx.translate(fx + ox, fy + oy)
        ctx.scale(zoom, zoom)
        ctx.translate(-fx, -fy)
        ctx.set_source_surface(s, 0, 0)
        ctx.get_source().set_filter(cairo.FILTER_GOOD)
        ctx.paint_with_alpha(alpha)
        ctx.restore()
        base._KEEP.clear()
        return f, i

    def subject_mask(self, f, key):
        if key in self._mask_cache:
            return self._mask_cache[key]
        small = cv2.resize(f, (288, 512))
        m = self.seg_v.process(cv2.cvtColor(small, cv2.COLOR_BGR2RGB)).segmentation_mask
        m = cv2.resize(m, (f.shape[1], f.shape[0]))
        m = cv2.GaussianBlur(np.clip((m - 0.3) / 0.35, 0, 1), (0, 0), 2.5)
        self._mask_cache = {key: m}
        return m

    def behind_text(self, ctx, f, mask, word, y, size, rgb, k, zoom=1.0, pivot=(W / 2, H / 2), track=4):
        """Big type sandwiched between the frame and the subject cut out of it."""
        ctx.save()
        ctx.translate(W / 2, y - size * 0.35)
        sc = lerp(1.35, 1.0, e_out(k))
        ctx.scale(sc, sc)
        ctx.translate(-W / 2, -(y - size * 0.35))
        self.text(ctx, word, W / 2, y, size, rgb=rgb, a=clamp(k * 3), track=track, shadow=False)
        ctx.restore()
        fg = base.to_surface(base.premul(f, mask))
        ctx.save()
        ctx.translate(*pivot)
        ctx.scale(zoom, zoom)
        ctx.translate(-pivot[0], -pivot[1])
        ctx.set_source_surface(fg, 0, 0)
        ctx.paint()
        ctx.restore()
        base._KEEP.clear()

    def flash(self, ctx, k, d=0.1, a=0.6):
        if 0 <= k < d:
            ctx.set_source_rgba(1, 1, 1, a * (1 - k / d))
            ctx.paint()

    def headline(self, ctx, rows, t, y0=300, size=100, step=128):
        """Editorial stacked boxes; each row pops on its word. rows: (text, time, bg)."""
        y = y0
        for txt, tk, bgc in rows:
            age = t - (tk if tk is not None else 99) + 0.08
            if age > 0:
                k = e_back(prog(age, 0, 0.3), 2.2)
                ctx.save()
                ctx.translate(W / 2, y - 40)
                ctx.scale(k, k)
                ctx.translate(-W / 2, -(y - 40))
                ctx.select_font_face(DISPLAY)
                ctx.set_font_size(size)
                tw = ctx.text_extents(txt).x_advance + 2 * (len(txt) - 1)
                bw = (tw + 60) * e_out(prog(age, 0, 0.22))
                ctx.set_source_rgba(*bgc, clamp(age / 0.08))
                ctx.rectangle(W / 2 - (tw + 60) / 2, y - size * 0.9, bw, size * 1.14)
                ctx.fill()
                if bw > tw * 0.6:
                    fg = INK if bgc in (WHITE, LIME, ICE) else WHITE
                    self.text(ctx, txt, W / 2, y, size, rgb=fg, a=clamp((bw - tw * 0.6) / (tw * 0.4)), track=2, shadow=False)
                ctx.restore()
            y += step

    def stamp(self, ctx, word, x, y, age, rgb=ORANGE, size=62, rot=-8):
        st = e_back(prog(age, 0, 0.35), 2.5)
        if st <= 0:
            return
        ctx.save()
        ctx.translate(x, y)
        ctx.rotate(math.radians(rot))
        ctx.scale(lerp(1.8, 1, st), lerp(1.8, 1, st))
        ctx.select_font_face(DISPLAY)
        ctx.set_font_size(size)
        tw = ctx.text_extents(word).x_advance + 3 * (len(word) - 1)
        rounded(ctx, -tw / 2 - 34, -size * 0.95, tw + 68, size * 1.6, 18)
        ctx.set_source_rgba(*rgb, clamp(st * 2))
        ctx.set_line_width(8)
        ctx.stroke()
        self.text(ctx, word, 0, size * 0.35, size, rgb=rgb, a=clamp(st * 2), track=3, shadow=False)
        ctx.restore()
        if age < 0.05:
            self.event(f"stamp {word}", 0)

    def grad_top(self, ctx, h=900, a=0.6):
        g = cairo.LinearGradient(0, 0, 0, h)
        g.add_color_stop_rgba(0, 0, 0, 0, a)
        g.add_color_stop_rgba(1, 0, 0, 0, 0)
        ctx.set_source(g)
        ctx.rectangle(0, 0, W, h)
        ctx.fill()

    def photo(self, ctx, key, k, dur, focus=(0.5, 0.4), push=0.08, drift=1):
        self.shot_parallax(ctx, key, k, dur, focus, push=push, drift=drift)

    # ------------------------------------------------------------ scenes
    def frame(self, ctx, t):
        Ls = self.Ls
        self._in_end = Ls[7] <= t < self.t_logo
        ctx.set_source_rgb(0, 0, 0)
        ctx.paint()
        scenes = [self.sc_hook, self.sc_who, self.sc_calm, self.sc_uniform, self.sc_phys, self.sc_secret, self.sc_turn]
        for i, fn in enumerate(scenes):
            if t < Ls[i + 1]:
                fn(ctx, t)
                return
        if t < self.t_logo:
            self.sc_end(ctx, t)
        else:
            self.sc_logo(ctx, t)

    # HOOK
    def sc_hook(self, ctx, t):
        s1 = self.Ls[1]
        t_that = self.t_(["That's", "That"], 0, s1 - 1.8) - 0.04
        if t < t_that:
            ph = self.ph["01"]
            u = prog(t, 0, t_that)
            s = cover_scale(ph.w, ph.h) * lerp(1.18, 1.05, e_out(u))
            paint_cam(ctx, ph.full, ph.w, ph.h, ph.w * 0.42, ph.h * 0.36, s)
            # light sweep across the half face
            if t < 1.2:
                x = lerp(-300, W + 300, e_io(prog(t, 0.05, 1.1)))
                g = cairo.LinearGradient(x - 220, 0, x + 220, 0)
                g.add_color_stop_rgba(0, 1, 0.8, 0.6, 0)
                g.add_color_stop_rgba(0.5, 1, 0.85, 0.7, 0.22)
                g.add_color_stop_rgba(1, 1, 0.8, 0.6, 0)
                ctx.set_source(g)
                ctx.paint()
            ctx.set_source_rgba(0, 0, 0, 1 - e_out(prog(t, 0, 0.35)))
            ctx.paint()
            self.grad_top(ctx)
            self.headline(ctx, [("HE DOESN'T", self._first(["doesn't", "Khan"], 0), WHITE), ("TRY", self._first(["try"], 0), WHITE),
                                ("TO BE COOL.", self._first(["cool"], 0), ORANGE)], t)
            tn = self._first(["Salman"], 0)
            if tn is not None and t > tn:
                self.pill(ctx, "SALMAN KHAN", W / 2, 1240, t - tn, rgb_bg=INK, size=34)
        else:
            k = t - t_that
            self.vid(ctx, "phone", k + 0.4, speed=0.9, zoom=lerp(1.25, 1.06, e_out(prog(k, 0, 0.5))))
            self.flash(ctx, k, 0.12, 0.7)
            self.grad_top(ctx, 800, 0.55)
            t_is = self._first(["is", "he"], 0)
            if t_is is not None and t_is < t_that:
                t_is = None
            self.headline(ctx, [("THAT'S WHY", t_that + 0.05, WHITE), ("HE IS.", t_is or t_that + 0.8, ORANGE)], t, y0=330, size=112, step=142)
            self.event("cut → phone (drop)", t_that)

    # WHO IS HE — eras
    def sc_who(self, ctx, t):
        s0, s1 = self.Ls[1], self.Ls[2]
        t_90 = self.t_(["nineties", "The"], 1, s0 + 0.9)
        t_heart = self.t_(["heartthrob"], 1, t_90 + 0.5)
        t_radhe = self.t_(["Radhe", "haircut"], 1, t_heart + 0.9)
        t_copied = self.t_(["copied", "generation"], 1, t_radhe + 1.2)
        t_and = self.t_(["And", "then"], 1, s1 - 2.0)
        t_bhai = self.t_(["Bhai"], 1, t_and + 1.0)
        shots = [("05", s0, (0.45, 0.4)), ("07", t_heart + 0.15, (0.55, 0.25)), ("06", t_radhe - 0.1, (0.55, 0.35))]
        if t < t_and - 0.05:
            cur = 0
            for i, sh in enumerate(shots):
                if t >= sh[1]:
                    cur = i
            key, st, foc = shots[cur]
            nxt = shots[cur + 1][1] if cur + 1 < len(shots) else t_and
            k = t - st
            prev = shots[cur - 1] if cur else None
            if prev is not None and k < 0.32:
                self.stripe_wipe(ctx, lambda ox: self.photo(ctx, prev[0], t - prev[1], st - prev[1], prev[2]),
                                 lambda ox: self.photo(ctx, key, k, nxt - st, foc), prog(k, 0, 0.32),
                                 cols=[(LIME, ORANGE, COBALT), (ORANGE, COBALT, LIME)][cur % 2])
                self.event(f"wipe era {cur}", st)
            else:
                self.photo(ctx, key, k if cur else t - s0, nxt - st, foc, drift=-1 if cur % 2 else 1)
            self.pill(ctx, "WHO IS HE?", W / 2, 300, t - s0 - 0.05, rgb_bg=WHITE, rgb_fg=INK, size=40)
            # era index top-right
            self.text(ctx, f"ERA {min(cur + 1, 3):02d}", W - 60, 230, 26, font=MONO, align="r", a=0.85, track=2)
            if cur <= 1:
                self.pill(ctx, "THE 90s HEARTTHROB", W / 2, 1300, t - t_heart, rgb_bg=ORANGE, size=40)
            else:
                self.pill(ctx, "THE RADHE CUT", W / 2, 1300, t - t_radhe - 0.1, rgb_bg=LIME, rgb_fg=INK, size=42)
                self.stamp(ctx, "COPIED", W - 250, 1060, t - t_copied, rgb=WHITE)
                if 0 < t - t_copied < 0.05:
                    self.event("stamp copied", t_copied)
        else:
            # the wave — giant BHAI behind him
            k = t - t_and + 0.05
            v = self.v["wave"]
            f, i = self.vid(ctx, "wave", 0.95 + k * 0.55, speed=1.0, zoom=1.04)
            self.flash(ctx, k, 0.1, 0.5)
            kb = prog(t, t_bhai - 0.08, 0.3)
            if kb > 0:
                # BHAI slams in over his chest: violet fill, white outline, a quick RGB-split on impact
                y, size = 1300, 300
                sc = lerp(1.6, 1.0, e_out(kb))
                split = 18 * (1 - e_out(prog(t, t_bhai, 0.35)))
                ctx.save()
                ctx.translate(W / 2, y - size * 0.35)
                ctx.scale(sc, sc)
                ctx.translate(-W / 2, -(y - size * 0.35))
                if split > 0.5:
                    self.text(ctx, "BHAI", W / 2 - split, y, size, rgb=ORANGE, a=0.6 * clamp(kb * 3), track=10, shadow=False)
                    self.text(ctx, "BHAI", W / 2 + split, y, size, rgb=LIME, a=0.5 * clamp(kb * 3), track=10, shadow=False)
                ctx.select_font_face(DISPLAY)
                ctx.set_font_size(size)
                widths = [ctx.text_extents(ch).x_advance + 10 for ch in "BHAI"]
                x = W / 2 - (sum(widths) - 10) / 2
                for ch, wd in zip("BHAI", widths):
                    ctx.move_to(x, y)
                    ctx.text_path(ch)
                    x += wd
                ctx.set_source_rgba(1, 1, 1, clamp(kb * 3))
                ctx.set_line_width(14)
                ctx.set_line_join(cairo.LINE_JOIN_ROUND)
                ctx.stroke_preserve()
                ctx.set_source_rgba(*PURPLE, clamp(kb * 3))
                ctx.fill()
                ctx.restore()
                self.event("BHAI slam", t_bhai)
            self.grad_top(ctx, 500, 0.35)

    # 01 THE CALM — crowd echo
    def crowd_frame(self, k, speed=0.8, echo=0.0):
        n = len(self.crowd)
        i = int(min(max(k * self.crowd_fps * speed, 0), n - 1))
        cur = self.crowd[i].astype(np.float32)
        if echo <= 0:
            return cur.astype(np.uint8), i
        acc, wsum = cur.copy(), 1.0
        for j in range(1, 9):
            wj = echo * (0.82 ** j)
            acc += self.crowd[max(0, i - 2 * j)].astype(np.float32) * wj
            wsum += wj
        trail = acc / wsum
        hx, hy = self.crowd_track[i]
        h_, w_ = cur.shape[:2]
        yy, xx = np.ogrid[0:h_, 0:w_]
        m = np.clip(1.6 - np.hypot((xx - hx) / 150, (yy - hy - 120) / 300), 0, 1)[..., None]
        out = trail * (1 - m) + cur * m
        return np.clip(out, 0, 255).astype(np.uint8), i

    def sc_calm(self, ctx, t):
        s0, s1 = self.Ls[2], self.Ls[3]
        t_watch = self.t_(["Watch", "crowd"], 2, s0 + 1.3)
        t_rush = self.t_(["rushing", "Everyone"], 2, t_watch + 1.4)
        t_isnt = self.t_(["isn't", "He"], 2, s1 - 0.8)
        if t < t_isnt - 0.05:
            k = t - s0
            echo = 2.2 * e_io(prog(t, t_rush - 0.6, 0.6))
            f, i = self.crowd_frame(k + 0.2, 0.8, echo)
            hx, hy = self.crowd_track[i]
            bw = f.shape[1]
            x0 = int(min(max(hx - W / 2, 0), bw - W))
            band = np.ascontiguousarray(f[:, x0:x0 + W])
            # blurred fill behind the band
            bg = cv2.GaussianBlur(cv2.resize(band, (W // 8, self.band_h // 8)), (0, 0), 3)
            bg = cv2.resize(bg, (W, H)) * 0.45
            sb = base.to_surface(cv2.cvtColor(bg.astype(np.uint8), cv2.COLOR_BGR2BGRA))
            ctx.set_source_surface(sb, 0, 0)
            ctx.paint()
            by = (H - self.band_h) / 2 + 40
            sf_ = base.to_surface(cv2.cvtColor(band, cv2.COLOR_BGR2BGRA))
            ctx.set_source_surface(sf_, 0, by)
            ctx.paint()
            base._KEEP.clear()
            ctx.set_source_rgb(*PURPLE)
            ctx.rectangle(0, by - 8, W * e_out(prog(t, s0 + 0.9, 0.5)), 8)
            ctx.rectangle(W - W * e_out(prog(t, s0 + 0.95, 0.5)), by + self.band_h, W, 8)
            ctx.fill()
            # ring on him from "Watch"
            px, py = hx - x0, by + hy
            if t > t_watch - 0.1:
                kk = e_back(prog(t, t_watch - 0.1, 0.45), 1.6)
                r = lerp(260, 120, kk)
                ctx.set_source_rgba(*ORANGE, clamp(kk * 1.5))
                ctx.set_line_width(6)
                ctx.set_dash((4, 12), -t * 40)
                ctx.set_line_cap(cairo.LINE_CAP_ROUND)
                ctx.arc(px, py, r, 0, 2 * math.pi)
                ctx.stroke()
                ctx.set_dash(())
                self.pill(ctx, "HIM", px, py - r - 40, t - t_watch, rgb_bg=ORANGE, size=30)
                self.event("ring on him", t_watch)
            if t > t_rush - 0.1:
                self.pill(ctx, "EVERYONE: RUSHING", W / 2, by + self.band_h + 90, t - t_rush, rgb_bg=WHITE, rgb_fg=INK, size=38)
                self.event("echo + rushing", t_rush)
            self.section_title(ctx, "01", "THE CALM", t, s0, dur=0.85)
        else:
            k = t - t_isnt + 0.05
            hold = 0.35
            self.vid(ctx, "phone2", k + 0.6, speed=0.8, zoom=lerp(1.0, 1.12, e_out(prog(k, hold, 0.6))), freeze=hold)
            self.flash(ctx, k - hold, 0.14, 0.85)
            if k > hold:
                self.headline(ctx, [("HE ISN'T.", t_isnt + hold, ORANGE)], t, y0=380, size=128)
                self.text(ctx, "FREEZE", W - 60, 230, 26, font=MONO, align="r", a=0.85, track=3)
                self.event("freeze on 'He isn't'", t_isnt + hold)

    # 02 THE UNIFORM — three cards
    def card(self, ctx, x, y, w, h, rot, age, draw, label, lab_bg, lab_fg):
        k = e_back(prog(age, 0, 0.45), 1.7)
        if k <= 0:
            return
        ctx.save()
        ctx.translate(x + w / 2, y + h / 2 + (1 - k) * 600)
        ctx.rotate(math.radians(rot) * (2 - k))
        ctx.translate(-w / 2, -h / 2)
        rounded(ctx, -8, -8, w + 16, h + 16, 30)
        ctx.set_source_rgb(1, 1, 1)
        ctx.fill()
        rounded(ctx, 0, 0, w, h, 24)
        ctx.clip()
        ctx.scale(w / W, h / H)
        draw()
        ctx.restore()
        self.pill(ctx, label, x + w / 2, y + h + 70, age - 0.2, rgb_bg=lab_bg, rgb_fg=lab_fg, size=30)

    def sc_uniform(self, ctx, t):
        s0, s1 = self.Ls[3], self.Ls[4]
        t_white = self.t_(["white", "shirt"], 3, s0 + 1.4)
        t_black = self.t_(["black", "tee"], 3, t_white + 0.8)
        t_glass = self.t_(["glasses", "dark"], 3, t_black + 0.8)
        t_same = self.t_(["same", "The"], 3, t_glass + 0.9)
        t_dec = self.t_(["decades"], 3, t_same + 0.8)
        t_his = self.t_(["became", "his"], 3, s1 - 0.9)
        if t < t_same - 0.05:
            ctx.set_source_rgb(*VIOLET_INK)
            ctx.paint()
            g = cairo.RadialGradient(W / 2, 800, 0, W / 2, 800, 900)
            g.add_color_stop_rgba(0, *PURPLE, 0.35)
            g.add_color_stop_rgba(1, *PURPLE, 0)
            ctx.set_source(g)
            ctx.paint()
            # faint brand grid
            ctx.set_source_rgba(1, 1, 1, 0.05)
            ctx.set_line_width(2)
            for gx in range(0, W, 90):
                ctx.move_to(gx, 0)
                ctx.line_to(gx, H)
            ctx.stroke()
            cw, chh = 284, 505
            xs = [W / 2 - cw * 1.5 - 26, W / 2 - cw / 2, W / 2 + cw / 2 + 26]
            ys = [560, 520, 560]

            def d_white():
                self.vid(ctx, "white", t - t_white + 0.1, speed=0.8)

            def d_black():
                self.vid(ctx, "blacktee", t - t_black + 0.3, speed=0.8)

            def d_glass():
                ph = self.ph["08"]
                paint_cam(ctx, ph.full, ph.w, ph.h, ph.w * 0.55, ph.h * 0.36, cover_scale(ph.w, ph.h) * 1.1 * (1 + 0.03 * (t - t_glass)))

            self.card(ctx, xs[0], ys[0], cw, chh, -5, t - t_white, d_white, "WHITE SHIRT", WHITE, INK)
            self.card(ctx, xs[1], ys[1], cw, chh, 2, t - t_black, d_black, "BLACK TEE", ORANGE, WHITE)
            self.card(ctx, xs[2], ys[2], cw, chh, 6, t - t_glass, d_glass, "DARK GLASSES", LIME, INK)
            for nm, tt in (("white card", t_white), ("black card", t_black), ("glasses card", t_glass)):
                if t > tt:
                    self.event(nm, tt)
            self.section_title(ctx, "02", "THE UNIFORM", t, s0, dur=0.85)
        elif t < t_his - 0.05:
            k = t - t_same + 0.05
            self.stripe_wipe(ctx, lambda ox: (ctx.set_source_rgb(*VIOLET_INK), ctx.paint()),
                             lambda ox: self.photo(ctx, "04", k, t_his - t_same, (0.5, 0.3), push=0.1), prog(k, 0, 0.32))
            self.event("wipe → decades", t_same)
            self.stamp(ctx, "DECADES", W / 2, 1250, t - t_dec, rgb=ORANGE, size=80, rot=-6)
            self.pill(ctx, "SAME PIECES", W / 2, 300, k - 0.25, rgb_bg=WHITE, rgb_fg=INK, size=38)
        else:
            k = t - t_his + 0.05
            self.vid(ctx, "tee2", k + 0.1, speed=0.85, zoom=lerp(1.15, 1.03, e_out(prog(k, 0, 0.6))))
            self.flash(ctx, k, 0.1, 0.5)
            self.stamp(ctx, "SIGNATURE", W / 2, 1250, k - 0.25, rgb=LIME, size=78, rot=-5)
            self.event("cut → signature", t_his)

    # 03 THE PHYSIQUE
    def sc_phys(self, ctx, t):
        s0, s1 = self.Ls[4], self.Ls[5]
        t_shirt = self.t_(["shirtless", "made"], 4, s0 + 1.4)
        t_genre = self.t_(["genre"], 4, t_shirt + 0.8)
        t_sixty = self.t_(["sixty", "at"], 4, t_genre + 0.7)
        t_train = self.t_(["training", "still"], 4, s1 - 0.6)
        if t < t_sixty - 0.1:
            k = t - s0
            self.photo(ctx, "02", k, t_sixty - s0, (0.5, 0.32), push=0.1)
            self.grad_top(ctx, 600, 0.45)
            if t > t_shirt:
                self.pill(ctx, "THE SHIRTLESS HERO", W / 2, 300, t - t_shirt, rgb_bg=ORANGE, size=40)
                self.event("shirtless pill", t_shirt)
            self.stamp(ctx, "A GENRE", W - 270, 1250, t - t_genre, rgb=WHITE, size=70)
            self.section_title(ctx, "03", "THE PHYSIQUE", t, s0, dur=0.85)
        else:
            k = t - t_sixty + 0.1
            ph = self.ph["03"]
            self.stripe_wipe(ctx, lambda ox: self.photo(ctx, "02", t - s0, t_sixty - s0, (0.5, 0.32), push=0.1),
                             lambda ox: None, prog(k, 0, 0.3)) if k < 0.3 else None
            if k >= 0.3 or True:
                ctx.save()
                if k < 0.3:
                    ctx.rectangle(0, 0, lerp(-500, W + 900, e_io(prog(k, 0, 0.3))) - 300, H)
                    ctx.clip()
                s = cover_scale(ph.w, ph.h) * (1.02 + 0.04 * k)
                cx, cy = ph.w * 0.5, ph.h * 0.30
                paint_cam(ctx, ph.bg, ph.w, ph.h, cx, cy, s)
                n = round(60 * e_out(prog(k, 0.1, 0.8)))
                self.text(ctx, str(n), W / 2, 720, 560, rgb=ORANGE, a=clamp(k / 0.15), track=-10, shadow=False)
                paint_cam(ctx, ph.fg, ph.w, ph.h, cx, cy, s)
                ctx.restore()
            self.pill(ctx, "AGE", W / 2, 300, k - 0.15, rgb_bg=WHITE, rgb_fg=INK, size=36)
            if t > t_train - 0.05:
                self.pill(ctx, "STILL TRAINING", W / 2, 1320, t - t_train, rgb_bg=LIME, rgb_fg=INK, size=46)
                self.event("still training", t_train)
            self.event("60 behind him", t_sixty)

    # THE REAL SECRET — the grin
    def sc_secret(self, ctx, t):
        s0, s1 = self.Ls[5], self.Ls[6]
        t_secret = self.t_(["secret"], 5, s0 + 0.6)
        t_appr = self.t_(["approval"], 5, s0 + 2.2)
        t_grin = self.t_(["grin", "That"], 5, t_appr + 0.6)
        t_knows = self.t_(["knows", "already"], 5, t_grin + 0.9)
        t_ends = self.t_(["ends"], 5, s1 - 0.5)
        panel_end = t_secret + 1.05
        if t < panel_end:
            self.photo(ctx, "01", t - s0, panel_end - s0, (0.42, 0.36), push=0.05)
            self.pill(ctx, "THE REAL SECRET", W / 2, 300, t - s0 - 0.05, rgb_bg=INK, size=40)
            self.section_title(ctx, "", "THE GRIN", t, t_secret - 0.1, dur=0.95, kicker="THE REAL SECRET")
            return
        shots = [("grin", panel_end, 0.0), ("glow", t_grin - 0.08, 0.2), ("laugh", t_knows - 0.1, 0.1)]
        cur = 0
        for i, sh in enumerate(shots):
            if t >= sh[1]:
                cur = i
        name, st, off = shots[cur]
        k = t - st
        hold = (t_ends + 0.25 - st) if name == "laugh" else None
        if cur and k < 0.3:
            pn, pst, poff = shots[cur - 1]
            self.stripe_wipe(ctx, lambda ox: self.vid(ctx, pn, t - pst + poff, speed=0.85),
                             lambda ox: self.vid(ctx, name, k + off, speed=0.85), prog(k, 0, 0.3),
                             cols=[(ORANGE, LIME, COBALT), (COBALT, ORANGE, LIME)][cur % 2])
            self.event(f"wipe grin {cur}", st)
        else:
            self.vid(ctx, name, k + off, speed=0.85, zoom=1.04 + 0.02 * k, freeze=hold)
        self.grad_top(ctx, 600, 0.4)
        if t > t_appr - 0.05:
            self.pill(ctx, "NOT ASKING FOR APPROVAL", W / 2, 300, t - t_appr, rgb_bg=WHITE, rgb_fg=INK, size=36)
            self.event("approval pill", t_appr)
        if name == "laugh" and t > t_ends + 0.2:
            kk = e_back(prog(t, t_ends + 0.2, 0.45), 1.6)
            self.brackets(ctx, 160, 420, 920, 1480, kk)
            self.flash(ctx, t - t_ends - 0.2, 0.12, 0.6)
            self.pill(ctx, "ALREADY KNOWS", W / 2, 1560, t - t_ends - 0.35, rgb_bg=ORANGE, size=40)
            self.event("freeze + brackets", t_ends + 0.2)

    # TURN
    def sc_turn(self, ctx, t):
        s0, s1 = self.Ls[6], self.Ls[7]
        t_but = self.t_(["But", "but"], 6, (s0 + s1) / 2)
        t_calm = self.t_(["calm"], 6, s1 - 0.4)
        if t < t_but - 0.05:
            ph = self.ph["06"]
            s = cover_scale(ph.w, ph.h) * (1.05 + 0.04 * (t - s0))
            paint_cam(ctx, ph.grey, ph.w, ph.h, ph.w * 0.55, ph.h * 0.45, s)
            self.pill(ctx, "BHAI: ONE OF ONE", W / 2, 300, t - s0 - 0.15, rgb_bg=WHITE, rgb_fg=INK, size=38)
        else:
            k = t - t_but + 0.05
            self.whip(ctx, lambda ox: paint_cam(ctx, self.ph["06"].grey, self.ph["06"].w, self.ph["06"].h, self.ph["06"].w * 0.55, self.ph["06"].h * 0.45,
                                                cover_scale(self.ph["06"].w, self.ph["06"].h) * 1.1, ox=ox),
                      lambda ox: self.vid(ctx, "sip", k + 0.1, speed=0.8, ox=ox), prog(k, 0, 0.28))
            self.event("whip → calm", t_but)
            age = t - t_calm
            if age > -0.35:
                self.brackets(ctx, 160, 380, 920, 1500, e_back(prog(age + 0.35, 0, 0.45), 1.6))
                self.event("calm brackets", t_calm)
            self.pill(ctx, "THE CALM: YOURS", W / 2, 300, k - 0.15, rgb_bg=ORANGE, size=40)

    # END — who's next (sid_face end card, re-indexed to line 7)
    def sc_end(self, ctx, t):
        Ls = list(self.Ls)
        saved = self.Ls
        self.Ls = Ls[1:] + [Ls[-1]]  # base reads Ls[6] as the end-card start and line 6 for "Comment"
        ice = base.ICE
        base.ICE = PURPLE                # the first mystery card goes violet
        try:
            base.Reel.sc_end(self, ctx, t)
        finally:
            self.Ls = saved
            base.ICE = ice

    def shot_face_end(self, ctx, cam):
        self.vid(ctx, "sip", 3.0, speed=0.8)

    def _first(self, toks, sec):
        # sid_face.Reel.wa uses self.Ls[sec]; keep that working while sc_end temporarily shifts Ls
        return base.Reel._first(self, toks, sec)

    # ------------------------------------------------------------ overlays
    def credit(self, ctx, t):
        if t > self.Ls[7]:
            return
        ctx.select_font_face(MONO)
        ctx.set_font_size(17)
        ex = ctx.text_extents(CREDIT)
        ctx.set_source_rgba(1, 1, 1, 0.55)
        ctx.move_to(W / 2 - ex.x_advance / 2, 170)
        ctx.show_text(CREDIT)

    def caption(self, ctx, t):
        if t >= self.Ls[7] - 0.05:
            return  # the end card says it in type
        srk.Reel.caption(self, ctx, t)

    def compose(self, t):
        s = cairo.ImageSurface(cairo.FORMAT_ARGB32, W, H)
        ctx = cairo.Context(s)
        self.frame(ctx, t)
        self.haze(ctx, t)
        self.credit(ctx, t)
        self.caption(ctx, t)
        s.flush()
        if t < self.Ls[7]:
            buf = np.ndarray((H, W, 4), np.uint8, s.get_data(), strides=(s.get_stride(), 4, 1))
            light = buf[96:142, 52:90, :3].mean() > 170
            self.mark(ctx, 52, 96, 46, dark=light, a=0.95)
            s.flush()
        self.finish(s, t)
        base._KEEP.clear()
        return s


# ------------------------------------------------------------ sound: swagger score (trap drums, 808, dark strings, plucks)
def build_audio(reel: Reel, out: Path):
    from scipy.signal import butter, lfilter

    SR = 48000
    n = int(reel.T * SR)
    t = np.arange(n) / SR
    rng = np.random.default_rng(23)

    vtmp = out.parent / "voice_fx.wav"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(reel.work / "voice" / "narration.wav"), "-af",
                    "highpass=f=75,lowpass=f=15000,equalizer=f=220:t=q:w=1.2:g=-1.5,equalizer=f=3200:t=q:w=1.1:g=2.2,"
                    "deesser=i=0.35,acompressor=threshold=-21dB:ratio=3:attack=6:release=90:makeup=2,aresample=48000",
                    "-ac", "1", str(vtmp)], check=True)
    narr, _ = sf.read(str(vtmp), dtype="float64")
    voice = np.zeros(n)
    i0 = int(LEAD * SR)
    voice[i0:i0 + len(narr)] = narr[: n - i0]

    def place(buf, at, seg, g=1.0):
        j = int(at * SR)
        if j >= n or j + len(seg) <= 0:
            return
        a = max(0, -j)
        m = min(len(seg), n - j)
        buf[j + a:j + m] += g * seg[a:m]

    bpm = 86
    beat = 60 / bpm
    bar = 4 * beat
    t_drop = reel.t_("That's", 0, reel.Ls[1] - 1.8) - 0.04 if False else None
    try:
        t_drop = base.Reel._first(reel, ["That's", "That"], 0) - 0.04
    except Exception:
        t_drop = reel.Ls[1] - 1.8
    end_music = reel.t_logo + 0.05
    # grid anchored so a downbeat lands on the drop
    grid0 = t_drop - math.ceil(t_drop / bar) * bar
    chords = [(146.83, 174.61, 220.0), (116.54, 146.83, 174.61), (98.0, 116.54, 146.83), (110.0, 138.59, 164.81)]  # Dm Bb Gm A
    roots = [36.71, 29.14, 24.5 * 2, 27.5]  # D1 Bb0 G1 A0 (808 notes)
    music = np.zeros(n)
    drums = np.zeros(n)

    # strings: detuned saws, slow low-pass, whole reel (quiet before the drop)
    b_lp, a_lp = butter(2, 1200 / (SR / 2))
    b = 0
    while grid0 + b * bar < end_music:
        st = grid0 + b * bar
        L_ = int((bar + 0.4) * SR)
        tt = np.arange(L_) / SR
        sig = np.zeros(L_)
        for f in chords[b % 4]:
            for det in (-0.15, 0.0, 0.13):
                ph = (f * (1 + det / 100) * tt + rng.uniform()) % 1.0
                sig += 2 * ph - 1
        sig = lfilter(b_lp, a_lp, sig) / 9
        sig *= np.minimum(1, tt / 0.4) * np.minimum(1, np.maximum(0, bar + 0.4 - tt) / 0.4)
        place(music, st, sig, 0.5 if st >= t_drop - 0.1 else 0.3)
        b += 1

    def kick808(f0, g=1.0, dec=0.9):
        L_ = int(1.4 * SR)
        tt = np.arange(L_) / SR
        f = f0 + 140 * np.exp(-tt / 0.03)
        return g * np.tanh(2.2 * np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt / dec))

    def clap():
        L_ = int(0.35 * SR)
        tt = np.arange(L_) / SR
        nz = lfilter(*butter(2, [900 / (SR / 2), 6000 / (SR / 2)], "band"), rng.standard_normal(L_))
        envl = np.exp(-tt / 0.09)
        for d in (0.0, 0.011, 0.023):
            envl += 0.6 * np.exp(-np.maximum(tt - d, 0) / 0.006) * (tt >= d)
        return nz * envl * 0.5

    def hat(open_=False):
        L_ = int((0.25 if open_ else 0.05) * SR)
        tt = np.arange(L_) / SR
        nz = lfilter(*butter(2, 7000 / (SR / 2), "high"), rng.standard_normal(L_))
        return nz * np.exp(-tt / (0.08 if open_ else 0.012))

    CL, HC, HO = clap(), hat(), hat(True)
    b = 0
    while grid0 + b * bar < end_music - 0.1:
        st = grid0 + b * bar
        if st >= t_drop - 0.01:
            root = roots[b % 4]
            for off, g in ((0.0, 1.0), (1.5 * beat, 0.7), (2.75 * beat, 0.8)):
                place(drums, st + off, kick808(root * 2 if off else root * 2, g, 0.7 if off else 1.0), 0.55)
            place(drums, st + 2 * beat, CL, 0.75)
            # hats: 8ths, a 16th/32nd roll at the end of every 2nd bar
            for e in range(8):
                place(drums, st + e * beat / 2, HC, 0.22 if e % 2 else 0.3)
            if b % 2 == 1:
                for r in range(6):
                    place(drums, st + 3.5 * beat + r * beat / 12, HC, 0.16 + 0.02 * r)
            place(drums, st + 3 * beat + beat / 2, HO, 0.12)
        b += 1

    # dark pluck motif (D phrygian) on the drop, each section title and the end card
    motif = [(0, 293.66), (0.5, 311.13), (1.0, 349.23), (1.5, 311.13), (2.0, 293.66), (3.0, 220.0)]
    for start in [t_drop] + [reel.Ls[i] + 0.05 for i in (2, 3, 4, 5)] + [reel.Ls[7] + 0.1]:
        for off, f in motif:
            place(music, start + off * beat / 2, srk.ks_pluck(f, 1.0, SR, 0.996, 0.55, seed=int(f * 7)), 0.22)

    # sub drone before the drop
    L_ = int(max(0.1, t_drop) * SR)
    tt = np.arange(L_) / SR
    place(music, 0, 0.25 * np.sin(2 * np.pi * 36.71 * tt) * np.minimum(1, tt / 0.3), 1.0)

    # sidechain duck
    venv = np.abs(voice)
    w = int(0.03 * SR)
    venv = np.convolve(venv, np.ones(w) / w, mode="same")
    tgt = np.clip(venv / (np.percentile(venv[venv > 1e-4], 60) + 1e-9), 0, 1)
    duck = np.empty(n)
    g = 0.0
    att, rel = 1 - np.exp(-1 / (0.02 * SR)), 1 - np.exp(-1 / (0.35 * SR))
    for ii in range(0, n, 48):
        x = tgt[ii]
        g += min(1.0, (att if x > g else rel) * 48) * (x - g)
        duck[ii:ii + 48] = g
    bus = (music + drums) * (1 - 0.6 * duck)
    # the freeze on "He isn't": the beat cuts out, then slams back
    try:
        t_isnt = base.Reel._first(reel, ["isn't", "He"], 2) + 0.3
        gate = np.where((t > t_isnt) & (t < t_isnt + 0.62), 0.12, 1.0)
        gate = np.convolve(gate, np.ones(480) / 480, mode="same")
        bus *= gate
    except Exception:
        t_isnt = None
    bus *= np.where(t < reel.t_logo, 1.0, np.clip(1 - (t - reel.t_logo) / 1.4, 0, 1))

    sfx = np.zeros(n)
    noise = rng.standard_normal(int(1.2 * SR))

    def whoosh(at, length=0.4, g=0.5):
        L_ = int(length * SR)
        seg = noise[:L_].copy()
        fc = np.linspace(400, 6000, L_)
        y = np.zeros(L_)
        acc = 0.0
        for q in range(L_):
            a = 1 - np.exp(-2 * np.pi * fc[q] / SR)
            acc += a * (seg[q] - acc)
            y[q] = acc
        y *= np.sin(np.linspace(0, np.pi, L_)) ** 1.5
        place(sfx, at - length * 0.6, y / (np.abs(y).max() + 1e-9), g)

    def pop(at, f=900, g=0.25):
        L_ = int(0.12 * SR)
        tt = np.arange(L_) / SR
        place(sfx, at, np.sin(2 * np.pi * (f * tt + 1400 * tt ** 2)) * np.minimum(1, tt / 0.002) * np.exp(-tt / 0.04), g)

    def hit(at, g=0.6):
        L_ = int(1.4 * SR)
        tt = np.arange(L_) / SR
        f = 38 + 60 * np.exp(-tt / 0.05)
        boom = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt / 0.5)
        crash = lfilter(*butter(2, 3000 / (SR / 2), "high"), rng.standard_normal(L_)) * np.exp(-tt / 0.4) * 0.25
        place(sfx, at, np.tanh(1.4 * (boom + crash)), g)

    def riser(at, length=1.0, g=0.3):
        L_ = int(length * SR)
        tt = np.arange(L_) / SR
        f = 220 * (8 ** (tt / length))
        tone = np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.3 + lfilter(*butter(2, 2500 / (SR / 2), "high"), rng.standard_normal(L_)) * 0.5
        place(sfx, at - length, tone * (tt / length) ** 2, g)

    def chime(at, g=0.25):
        for m, f in enumerate((1318.5, 1760.0, 2637.0)):
            L_ = int(1.6 * SR)
            tt = np.arange(L_) / SR
            place(sfx, at + 0.04 * m, np.sin(2 * np.pi * f * tt) * np.exp(-tt / 0.5) * np.minimum(1, tt / 0.003), g / (m + 1))

    def camera(at, g=0.4):  # shutter for freeze frames
        for d in (0.0, 0.06):
            L_ = int(0.05 * SR)
            tt = np.arange(L_) / SR
            place(sfx, at + d, lfilter(*butter(2, 2000 / (SR / 2), "high"), rng.standard_normal(L_)) * np.exp(-tt / 0.008), g)

    hit(0.0, 0.5)
    riser(t_drop, 1.6, 0.35)
    hit(t_drop, 0.9)
    for i in (2, 3, 4):
        riser(reel.Ls[i], 0.9, 0.22)
        whoosh(reel.Ls[i], 0.4, 0.5)
        hit(reel.Ls[i] + 0.02, 0.5)
    for e in reel.events:
        nm, at = e["name"], e["t"]
        if at <= 0:
            continue
        if nm.startswith(("whip", "wipe", "cut", "stamp")):
            whoosh(at + 0.1, 0.32, 0.4)
            if nm.startswith("stamp"):
                hit(at + 0.05, 0.3)
        elif nm.startswith("BHAI"):  # slam
            hit(at, 0.85)
            chime(at + 0.05, 0.25)
        elif nm.startswith(("freeze", "60 behind")):
            camera(at, 0.5)
            hit(at, 0.5)
        elif nm.startswith("logo"):
            continue
        else:
            pop(at, 650 + 250 * (sum(map(ord, nm)) % 3), 0.16)
    whoosh(reel.Ls[5], 0.45, 0.45)
    hit(reel.Ls[5] + 0.3, 0.45)
    whoosh(reel.Ls[7], 0.45, 0.5)
    hit(reel.Ls[7] + 0.02, 0.55)
    riser(reel.t_logo + 0.05, 1.0, 0.25)
    whoosh(reel.t_logo + 0.3, 0.6, 0.6)
    hit(reel.t_logo + 0.78, 0.8)
    chime(reel.t_logo + 1.05, 0.45)

    mix = voice + bus * 0.30 + sfx * 0.2
    mix = np.tanh(mix * 1.1) / 1.1
    d = int(0.012 * SR)
    wide = bus * 0.30 + sfx * 0.2
    side = np.concatenate([np.zeros(d), wide[:-d]]) - wide
    st = np.stack([mix + 0.1 * side, mix - 0.1 * side], 1)
    st /= np.abs(st).max() / 0.92
    sf.write(out, st, SR)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("work", type=Path)
    ap.add_argument("--stills", nargs="*", type=float)
    ap.add_argument("--audio-only", action="store_true")
    a = ap.parse_args()
    reel = Reel(a.work)
    reel.build_chunks()
    R = a.work / "render"
    R.mkdir(exist_ok=True)
    print("sections:", [round(x, 2) for x in reel.Ls], "logo", round(reel.t_logo, 2), "total", round(reel.T, 2))
    if a.stills is not None:
        for t in a.stills:
            reel.compose(t).write_to_png(str(R / f"s_{t:05.2f}.png"))
        return
    if not a.audio_only:
        vid = R / "video.mp4"
        p = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgra", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
                              "-c:v", "libx264", "-preset", "medium", "-crf", "16", "-pix_fmt", "yuv420p", "-an", str(vid)], stdin=subprocess.PIPE)
        for i in range(int(round(reel.T * FPS))):
            p.stdin.write(bytes(reel.compose(i / FPS).get_data()))
        p.stdin.close()
        assert p.wait() == 0
        (R / "events.json").write_text(json.dumps(reel.events, indent=1))
    else:
        reel.events = json.loads((R / "events.json").read_text())
    wav = R / "audio.wav"
    build_audio(reel, wav)
    out = R / "salman_cool.mp4"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(R / "video.mp4"), "-i", str(wav), "-map", "0:v", "-map", "1:a", "-c:v", "copy",
                    "-af", "loudnorm=I=-14:TP=-1.5:LRA=9,aresample=48000", "-c:a", "aac", "-b:a", "256k", "-shortest", "-movflags", "+faststart", str(out)],
                   check=True)
    print("done:", out)


if __name__ == "__main__":
    main()
