"""Reaction reel: "Saif Ali Khan — the Nawab of Bollywood" — 9:16, screen-recorded clips + photos, generated voice.

    python studio/reels/saif_clips.py studio/work/saif               # cut the clean 9:16 clips first
    python studio/reels/saif_nawab.py studio/work/saif               # → render/saif_nawab.mp4
    python studio/reels/saif_nawab.py studio/work/saif --stills 1 5 ...

Built on salman_cool.Reel (clip playback, stamps, cards, stripe wipes, purple haze, end card, logo).
New here: royal gold accent, name behind his cut-out, face-mesh callouts on the smirk, 90s/now slider,
"SAIF 2.0" update bar, cool-o-meter, the bare-feet zoom.
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
import salman_cool as sc  # noqa: E402
import sid_face as base  # noqa: E402
import srk_face as srk  # noqa: E402
from render import rounded  # noqa: E402
from salman_cool import PURPLE, VIOLET_INK, Vid  # noqa: E402
from sid_face import (COBALT, DISPLAY, FPS, H, INK, LEAD, LIME, MONO, ORANGE, WHITE, W, Photo, clamp,  # noqa: E402
                      cover_scale, e_back, e_in, e_io, e_out, lerp, paint_cam, prog)

GOLD = (0xE8 / 255, 0xB2 / 255, 0x4A / 255)
TAIL = 5.4
CREDITS = ("VIDEO: ZOOMTV · @MJ.VISHAL · @MAHESH_VIDEOJOURNALIST · @THEUNSEENSHORTS",
           "PHOTOS: EROS · DHARMA · SCREEN · PRESS ARCHIVE · FAN EDIT")


class Reel(sc.Reel):
    def __init__(self, work: Path):  # noqa: C901  (sc.Reel.__init__ loads the Salman crowd clip; not used here)
        import mediapipe as mp

        self.work = work
        seg = mp.solutions.selfie_segmentation.SelfieSegmentation(model_selection=1)
        self.seg_v = mp.solutions.selfie_segmentation.SelfieSegmentation(model_selection=0)
        self.ph = {p.stem: Photo(p, seg) for p in sorted((work / "img").glob("0*.png"))}
        self.v = {p.stem: Vid(p) for p in sorted((work / "clips").glob("*.mp4"))}
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
        self._mask_cache = {}
        self.cam_wide = (0.0, 0.0, 1.0)
        self.smirk_lm = self._smirk_landmarks(mp)

    def _smirk_landmarks(self, mp):
        """Mouth corners + brows on every frame of the smirk clip (cached)."""
        cache = self.work / "clips" / "smirk_lm.json"
        if cache.exists():
            return json.loads(cache.read_text())
        fm = mp.solutions.face_mesh.FaceMesh(static_image_mode=False, refine_landmarks=False, max_num_faces=1)
        cap = cv2.VideoCapture(str(self.work / "clips" / "smirk.mp4"))
        out, last = [], None
        ids = [61, 291, 0, 17, 70, 63, 105, 66, 107, 336, 296, 334, 293, 300, 13, 14]
        while True:
            ok, f = cap.read()
            if not ok:
                break
            r = fm.process(cv2.cvtColor(f, cv2.COLOR_BGR2RGB))
            if r.multi_face_landmarks:
                L = r.multi_face_landmarks[0].landmark
                last = {str(i): (L[i].x * W, L[i].y * H) for i in ids}
            out.append(last)
        out = [o or next(x for x in out if x) for o in out]
        cache.write_text(json.dumps(out))
        return out

    # ------------------------------------------------------------ helpers
    def stripe_wipe(self, ctx, draw_a, draw_b, u, cols=(GOLD, PURPLE, ORANGE)):
        cols = tuple(PURPLE if c == COBALT else c for c in cols)
        srk.Reel.stripe_wipe(self, ctx, draw_a, draw_b, u, cols=cols)

    def pcam(self, key, fx, fy, mult=1.0):
        ph = self.ph[key]
        s = cover_scale(ph.w, ph.h) * mult
        cx = min(max(ph.w * fx, W / 2 / s), ph.w - W / 2 / s)
        cy = min(max(ph.h * fy, H / 2 / s), ph.h - H / 2 / s)
        return (cx, cy, s)

    def pdraw(self, ctx, key, cam, layer="full", ox=0.0, alpha=1.0):
        ph = self.ph[key]
        paint_cam(ctx, getattr(ph, layer), ph.w, ph.h, cam[0], cam[1], cam[2], alpha=alpha, ox=ox)

    def arrow_label(self, ctx, pt, lab_xy, text, age, bg=ORANGE, fg=WHITE, size=32, anchor="c"):
        if age <= 0:
            return
        px, py = pt
        lx, ly = lab_xy
        p = e_out(prog(age, 0.0, 0.35))
        self.node(ctx, px, py, 9 * e_back(prog(age, 0, 0.3)), rgb=bg)
        ctx.set_source_rgba(1, 1, 1, 0.95)
        ctx.set_line_width(4)
        ctx.set_dash((2, 9))
        ctx.set_line_cap(cairo.LINE_CAP_ROUND)
        ctx.move_to(px, py)
        ctx.line_to(lerp(px, lx, p), lerp(py, ly, p))
        ctx.stroke()
        ctx.set_dash(())
        self.pill(ctx, text, lx, ly, age - 0.2, rgb_bg=bg, rgb_fg=fg, size=size, anchor=anchor)

    def gold_frame(self, ctx, x0, y0, x1, y1, k, width=8):
        """A gold picture frame that draws itself around a region (corner ticks + full outline)."""
        if k <= 0:
            return
        per = 2 * ((x1 - x0) + (y1 - y0))
        ctx.save()
        ctx.set_source_rgba(*GOLD, clamp(k * 2))
        ctx.set_line_width(width)
        ctx.set_dash((per * e_io(k), per))
        ctx.move_to(x0, y0)
        ctx.line_to(x1, y0)
        ctx.line_to(x1, y1)
        ctx.line_to(x0, y1)
        ctx.close_path()
        ctx.stroke()
        ctx.restore()

    def bubble(self, ctx, x, y, text, age, col, rot=0.0, size=64):
        k = e_back(prog(age, 0, 0.35), 2.6)
        if k <= 0:
            return
        ctx.save()
        ctx.translate(x, y)
        ctx.rotate(math.radians(rot))
        ctx.scale(k, k)
        ctx.select_font_face(DISPLAY)
        ctx.set_font_size(size)
        tw = ctx.text_extents(text).x_advance
        w, h = tw + 60, size * 1.45
        rounded(ctx, -w / 2, -h / 2, w, h, h / 2)
        ctx.move_to(-w * 0.15, h / 2 - 4)
        ctx.line_to(-w * 0.3, h / 2 + 34)
        ctx.line_to(-w * 0.02, h / 2 - 4)
        ctx.set_source_rgb(*col)
        ctx.fill()
        self.text(ctx, text, 0, size * 0.36, size, rgb=INK if col in (LIME, GOLD, WHITE) else WHITE, shadow=False)
        ctx.restore()

    # ------------------------------------------------------------ scenes
    def frame(self, ctx, t):
        Ls = self.Ls
        self._in_end = Ls[7] <= t < self.t_logo
        ctx.set_source_rgb(0, 0, 0)
        ctx.paint()
        scenes = [self.sc_hook, self.sc_who, self.sc_charm, self.sc_humor, self.sc_looks, self.sc_dress, self.sc_turn]
        for i, fn in enumerate(scenes):
            if t < Ls[i + 1]:
                fn(ctx, t)
                return
        if t < self.t_logo:
            self.sc_end(ctx, t)
        else:
            self.sc_logo(ctx, t)

    # HOOK — the scissor door rises; the headline is on screen from frame one
    def sc_hook(self, ctx, t):
        s1 = self.Ls[1]
        t_some = self.t_(["somehow", "And"], 0, s1 - 2.6)
        t_nawab = self.t_(["Nawab"], 0, 1.3)
        if t < t_some - 0.05:
            self.vid(ctx, "door", t, speed=0.62, zoom=lerp(1.22, 1.05, e_out(prog(t, 0, 0.8))))
            self.grad_top(ctx, 900, 0.6)
            self.headline(ctx, [("THIS MAN IS", -0.08, WHITE), ("AN ACTUAL", self._first(["actual", "an"], 0), WHITE),
                                ("NAWAB.", t_nawab, GOLD)], t, y0=320, size=112, step=140)
            age = t - t_nawab
            if age > 0.1:
                d = e_back(prog(age, 0.1, 0.45), 2.6)
                self.crown(ctx, W / 2 + 175, 548 - lerp(220, 0, d), 100, a=clamp((age - 0.1) / 0.1), rgb=GOLD)
                self.event("crown lands", t_nawab + 0.35)
        else:
            k = t - t_some + 0.05
            self.vid(ctx, "carwalk", k + 0.15, speed=0.75, zoom=lerp(1.18, 1.04, e_out(prog(k, 0, 0.6))))
            self.flash(ctx, k, 0.1, 0.5)
            self.grad_top(ctx, 700, 0.5)
            self.headline(ctx, [("AND THAT'S", t_some + 0.05, WHITE), ("THE BORING PART.", self._first(["least", "interesting"], 0), ORANGE)],
                          t, y0=330, size=96, step=134)
            self.event("cut → steps out", t_some)

    # WHO — name behind him, the family, the title
    def sc_who(self, ctx, t):
        s0, s1 = self.Ls[1], self.Ls[2]
        t_son = self.t_(["Son", "cricket"], 1, s0 + 1.3)
        t_cric = self.t_(["cricket", "captain"], 1, t_son + 0.3)
        t_screen = self.t_(["screen", "legend"], 1, t_cric + 0.9)
        t_lit = self.t_(["literally", "Nawab"], 1, s1 - 1.6)
        t_pat = self.t_(["Pataudi"], 1, t_lit + 0.8)
        if t < t_son - 0.05:
            k = t - s0
            cam = self.pcam("01", 0.42, 0.42, 1.08 + 0.03 * k)
            self.pdraw(ctx, "01", cam)
            kb = prog(k, 0.0, 0.4)
            self.text(ctx, "SAIF", W / 2, 640, 330, rgb=GOLD, a=clamp(kb * 3), track=14, shadow=False)
            self.pdraw(ctx, "01", cam, "fg")
            self.pill(ctx, "SAIF ALI KHAN", W / 2, 1300, k - 0.1, rgb_bg=INK, size=40)
            self.event("SAIF behind him", s0)
        elif t < t_lit - 0.05:
            k = t - t_son
            cam = self.pcam("01", 0.42, 0.42, 1.12)
            self.pdraw(ctx, "01", cam, "bg")
            ctx.set_source_rgba(*VIOLET_INK, 0.55)
            ctx.paint()
            # two lineage cards with a + between
            for i, (tt, top, word, col, icon) in enumerate(((t_cric, "SON OF A", "CRICKET\nCAPTAIN", GOLD, "ball"),
                                                             (t_screen, "AND A", "SCREEN\nLEGEND", PURPLE, "film"))):
                age = t - tt + 0.1
                kk = e_back(prog(age, 0, 0.45), 1.8)
                if kk <= 0:
                    continue
                cw, chh = 420, 560
                x = W / 2 - cw - 30 if i == 0 else W / 2 + 30
                y = 620 + (1 - kk) * 500
                ctx.save()
                ctx.translate(x + cw / 2, y + chh / 2)
                ctx.rotate(math.radians(-4 if i == 0 else 4) * (2 - kk))
                ctx.translate(-cw / 2, -chh / 2)
                rounded(ctx, 0, 0, cw, chh, 30)
                ctx.set_source_rgb(*col)
                ctx.fill()
                fg = INK if col == GOLD else WHITE
                self.text(ctx, top, cw / 2, 90, 30, font=MONO, rgb=fg, a=0.8, track=3, shadow=False)
                for j, ln in enumerate(word.split("\n")):
                    self.text(ctx, ln, cw / 2, 330 + j * 74, 66, rgb=fg, shadow=False)
                ctx.set_source_rgb(*fg)
                ctx.set_line_width(7)
                if icon == "ball":  # a cricket ball: circle + seam
                    ctx.arc(cw / 2, 190, 48, 0, 2 * math.pi)
                    ctx.stroke()
                    ctx.arc(cw / 2 - 60, 190, 58, -0.6, 0.6)
                    ctx.stroke()
                    ctx.arc(cw / 2 + 60, 190, 58, math.pi - 0.6, math.pi + 0.6)
                    ctx.stroke()
                else:  # a film frame
                    rounded(ctx, cw / 2 - 70, 145, 140, 92, 10)
                    ctx.stroke()
                    for sx in (-50, -17, 17, 50):
                        ctx.rectangle(cw / 2 + sx - 8, 128, 16, 10)
                        ctx.rectangle(cw / 2 + sx - 8, 244, 16, 10)
                    ctx.fill()
                ctx.restore()
                self.event(f"lineage card {i}", tt)
            if t > t_screen:
                self.text(ctx, "+", W / 2, 940, 110, rgb=WHITE, a=clamp((t - t_screen) / 0.2), shadow=False)
        else:
            # the palace portrait wall — a gold frame draws around him, the title stamps in
            k = t - t_lit + 0.05
            cam = self.pcam("03", 0.45, 0.6, 1.1 + 0.05 * k)
            self.stripe_wipe(ctx, lambda ox: (ctx.set_source_rgb(*VIOLET_INK), ctx.paint()),
                             lambda ox: self.pdraw(ctx, "03", cam), prog(k, 0, 0.3)) if k < 0.3 else self.pdraw(ctx, "03", cam)
            ph = self.ph["03"]
            x0, y0 = self.to_canvas((ph.w * 0.28, ph.h * 0.42), cam)
            x1, y1 = self.to_canvas((ph.w * 0.57, ph.h * 0.99), cam)
            self.gold_frame(ctx, x0, y0, x1, y1, prog(k, 0.25, 0.7))
            self.event("wipe → palace", t_lit)
            age = t - t_pat
            if age > 0:
                self.stamp(ctx, "NAWAB OF PATAUDI", W / 2, 1330, age, rgb=GOLD, size=60, rot=-4)
                self.crown(ctx, W / 2, 1180 - lerp(160, 0, e_back(prog(age, 0.15, 0.4), 2.4)), 90, a=clamp((age - 0.15) / 0.1), rgb=GOLD)
                self.event("stamp nawab", t_pat)

    # 01 THE CHARM — face-tracked callouts on the smirk
    def sc_charm(self, ctx, t):
        s0, s1 = self.Ls[2], self.Ls[3]
        t_half = self.t_(["half", "smile"], 2, s0 + 1.4)
        t_brow = self.t_(["raised", "eyebrow"], 2, t_half + 0.9)
        t_look = self.t_(["look"], 2, t_brow + 0.9)
        t_joke = self.t_(["joke"], 2, s1 - 0.5)
        k = t - s0
        speed = 0.55
        f, i = self.vid(ctx, "smirk", k * 1.0, speed=speed, zoom=1.0)
        lm = self.smirk_lm[min(i, len(self.smirk_lm) - 1)]
        P = lambda j: tuple(lm[str(j)])  # noqa: E731
        # half smile: dotted line along the lips corner→corner, the raised side gets the label
        if t > t_half - 0.05:
            age = t - t_half + 0.05
            a, b_ = P(61), P(291)
            mid = P(13)
            pts = [(lerp(a[0], b_[0], u), lerp(a[1], b_[1], u) + 26 * math.sin(math.pi * u) - 10) for u in np.linspace(0, 1, 16)]
            self.dotted(ctx, pts, e_io(prog(age, 0, 0.45)), rgb=WHITE, width=5, dash=(2, 11))
            hi = a if a[1] < b_[1] else b_
            self.arrow_label(ctx, hi, (W - 120, mid[1] + 260), "HALF SMILE", age, bg=GOLD, fg=INK, anchor="r")
            self.event("half smile", t_half)
        if t > t_brow - 0.05:
            age = t - t_brow + 0.05
            br = P(105) if P(105)[1] < P(334)[1] else P(334)
            self.arrow_label(ctx, br, (80, br[1] + 380), "RAISED BROW", age, bg=PURPLE, anchor="l")
            self.event("raised brow", t_brow)
        if t > t_look:
            self.pill(ctx, "THE LOOK", W / 2, 300, t - t_look, rgb_bg=WHITE, rgb_fg=INK, size=40)
        if t > t_joke - 0.05:
            self.stamp(ctx, "IN ON THE JOKE", W / 2, 1320, t - t_joke + 0.05, rgb=ORANGE, size=60, rot=-5)
        self.section_title(ctx, "01", "THE CHARM", t, s0, dur=0.85)

    # 02 THE HUMOR — HA bubbles, self-aware, the cool-o-meter
    def sc_humor(self, ctx, t):
        s0, s1 = self.Ls[3], self.Ls[4]
        t_laugh = self.t_(["laughs", "He"], 3, s0 + 1.4)
        t_before = self.t_(["before", "anyone"], 3, t_laugh + 0.8)
        t_cool = self.t_(["cooler", "only"], 3, s1 - 0.8)
        if t < t_before - 0.05:
            k = t - s0
            cam = self.pcam("05", 0.5, 0.42, 1.05 + 0.04 * k)
            self.pdraw(ctx, "05", cam)
            for j, (dx, dy, col, rot) in enumerate(((-300, 520, GOLD, -8), (300, 420, PURPLE, 7), (-250, 1250, LIME, 5), (290, 1180, ORANGE, -6))):
                self.bubble(ctx, W / 2 + dx, dy, "HA" if j % 2 == 0 else "HAHA", t - t_laugh - 0.12 * j, col, rot, size=58 if j % 2 else 70)
            if t > t_laugh:
                self.event("ha bubbles", t_laugh)
            self.section_title(ctx, "02", "THE HUMOR", t, s0, dur=0.85)
        elif t < t_cool - 0.15:
            k = t - t_before + 0.05
            cam = self.pcam("07", 0.48, 0.45, 1.05 + 0.04 * k)
            self.stripe_wipe(ctx, lambda ox: self.pdraw(ctx, "05", self.pcam("05", 0.5, 0.42, 1.1)),
                             lambda ox: self.pdraw(ctx, "07", cam), prog(k, 0, 0.3)) if k < 0.3 else self.pdraw(ctx, "07", cam)
            self.pill(ctx, "LAUGHS AT HIMSELF FIRST", W / 2, 300, k - 0.25, rgb_bg=WHITE, rgb_fg=INK, size=36)
            self.stamp(ctx, "SELF-AWARE", W / 2, 1320, k - 0.5, rgb=GOLD, size=66)
            self.event("wipe → self-aware", t_before)
        else:
            # airport thumbs-up + cool-o-meter maxing out
            k = t - t_cool + 0.15
            self.vid(ctx, "airport", 4.15 + k * 0.5, speed=1.0, zoom=1.35, oy=-120)
            self.flash(ctx, k, 0.1, 0.5)
            fill = e_out(prog(k, 0.2, 0.7))
            x0, y0, w, h = 140, 1180, 800, 56
            rounded(ctx, x0, y0, w, h, h / 2)
            ctx.set_source_rgba(0, 0, 0, 0.55)
            ctx.fill()
            rounded(ctx, x0 + 6, y0 + 6, (w - 12) * fill, h - 12, (h - 12) / 2)
            g = cairo.LinearGradient(x0, 0, x0 + w, 0)
            g.add_color_stop_rgb(0, *LIME)
            g.add_color_stop_rgb(0.6, *GOLD)
            g.add_color_stop_rgb(1, *ORANGE)
            ctx.set_source(g)
            ctx.fill()
            self.text(ctx, "COOL-O-METER", x0, y0 - 24, 30, font=MONO, align="l", track=3)
            self.text(ctx, f"{round(100 * fill)}%", x0 + w, y0 - 24, 36, align="r")
            if fill > 0.98:
                self.stamp(ctx, "MAXED", W / 2, 1400, k - 0.9, rgb=ORANGE, size=64)
            self.event("cool-o-meter", t_cool)

    # 03 THE LOOKS — 90s vs now slider, SAIF 2.0
    def sc_looks(self, ctx, t):
        s0, s1 = self.Ls[4], self.Ls[5]
        t_long = self.t_(["Long", "hair"], 4, s0 + 1.3)
        t_beard = self.t_(["sharp", "beard"], 4, t_long + 1.3)
        t_up = self.t_(["didn't", "age"], 4, s1 - 1.5)
        t_upg = self.t_(["upgraded"], 4, s1 - 0.6)
        if t < t_up - 0.05:
            k = t - s0
            then_cam = self.pcam("06", 0.5, 0.42, 1.05 + 0.03 * k)
            self.pdraw(ctx, "06", then_cam)
            # NOW slides in from the right on "sharp beard"
            sp = e_io(prog(t, t_beard - 0.15, 0.6))
            if sp > 0:
                xd = lerp(W, W * 0.45, sp)
                ctx.save()
                ctx.rectangle(xd, 0, W - xd, H)
                ctx.clip()
                self.vid(ctx, "smirk", 3.0 + (t - t_beard) * 0.4, speed=1.0, zoom=1.05)
                ctx.restore()
                ctx.set_source_rgb(1, 1, 1)
                ctx.rectangle(xd - 4, 0, 8, H)
                ctx.fill()
                ctx.arc(xd, H / 2, 34, 0, 2 * math.pi)
                ctx.fill()
                ctx.set_source_rgb(*INK)
                for d in (-1, 1):
                    ctx.move_to(xd + d * 8, H / 2 - 12)
                    ctx.line_to(xd + d * 22, H / 2)
                    ctx.line_to(xd + d * 8, H / 2 + 12)
                    ctx.close_path()
                    ctx.fill()
                self.pill(ctx, "NOW", (xd + W) / 2, 420, t - t_beard, rgb_bg=PURPLE, size=40)
                self.event("then/now slider", t_beard)
            self.pill(ctx, "THE 90s", lerp(W / 2, xd / 2 if sp > 0 else W / 2, sp), 300 if sp <= 0 else 420, t - t_long, rgb_bg=GOLD, rgb_fg=INK, size=40)
            self.section_title(ctx, "03", "THE LOOKS", t, s0, dur=0.85)
        else:
            k = t - t_up + 0.05
            self.vid(ctx, "suit", k * 0.6, speed=1.0, zoom=1.04)
            ctx.set_source_rgba(0, 0, 0, 0.35)
            ctx.paint()
            # software-update card
            cw, chh = 820, 300
            x, y = (W - cw) / 2, 760
            kk = e_back(prog(k, 0.0, 0.4), 1.6)
            ctx.save()
            ctx.translate(W / 2, y + chh / 2)
            ctx.scale(kk, kk)
            ctx.translate(-W / 2, -(y + chh / 2))
            rounded(ctx, x, y, cw, chh, 34)
            ctx.set_source_rgb(1, 1, 1)
            ctx.fill()
            self.text(ctx, "UPDATE", x + 50, y + 80, 28, font=MONO, rgb=INK, align="l", track=3, shadow=False)
            self.text(ctx, "SAIF 2.0", x + 50, y + 165, 76, rgb=INK, align="l", shadow=False)
            pr = e_io(prog(k, 0.25, 0.9))
            rounded(ctx, x + 50, y + 205, cw - 100, 34, 17)
            ctx.set_source_rgba(*INK, 0.1)
            ctx.fill()
            rounded(ctx, x + 50, y + 205, (cw - 100) * pr, 34, 17)
            ctx.set_source_rgb(*PURPLE)
            ctx.fill()
            msg = "INSTALLED  ✓" if pr >= 1 else f"INSTALLING {round(pr * 100)}%"
            self.text(ctx, msg, x + cw - 50, y + 80, 28, font=MONO, rgb=ORANGE if pr >= 1 else INK, align="r", track=2, shadow=False)
            ctx.restore()
            if t > t_upg:
                self.stamp(ctx, "UPGRADED", W / 2, 1300, t - t_upg, rgb=GOLD, size=72)
                self.event("upgraded", t_upg)
            self.event("update card", t_up)

    # THE DRESSING — rapid labelled cuts
    def sc_dress(self, ctx, t):
        s0, s1 = self.Ls[5], self.Ls[6]
        t_dr = self.t_(["dressing"], 5, s0 + 0.5)
        t_white = self.t_(["White", "shirts"], 5, t_dr + 0.9)
        t_flare = self.t_(["flared", "denim"], 5, t_white + 0.9)
        t_linen = self.t_(["linen", "suit"], 5, t_flare + 0.9)
        t_no = self.t_(["no", "shoes"], 5, t_linen + 1.0)
        t_old = self.t_(["Old", "money"], 5, s1 - 1.8)
        if t < t_white - 0.05:
            self.vid(ctx, "walk", (t - s0) * 0.7, speed=1.0, zoom=1.08)
            self.section_title(ctx, "", "THE DRESSING", t, s0 + 0.05, dur=max(0.6, t_white - s0 - 0.4), kicker="AND FINALLY")
            return
        shots = [("01", t_white, "WHITE SHIRT", WHITE), ("08", t_flare, "FLARED DENIM", PURPLE), ("suit", t_linen, "LINEN SUIT", GOLD),
                 ("airport", t_no, "NO SHOES.", ORANGE), ("02", t_old, "OLD MONEY", GOLD)]
        cur = 0
        for i, sh in enumerate(shots):
            if t >= sh[1] - 0.05:
                cur = i
        key, st, lab, col = shots[cur]
        k = t - st + 0.05
        nxt = shots[cur + 1][1] if cur + 1 < len(shots) else s1

        def draw(which, kk):
            kname = shots[which][0]
            if kname in self.v:
                if kname == "airport":
                    # bare feet: tight on the feet, then pull back to the whole walk
                    v = self.v["airport"]
                    i = v.at(kk * 0.9, 1.0)
                    fx, fy = v.track[i]
                    z = lerp(2.3, 1.0, e_io(prog(kk, 0.55, 0.7)))
                    self.vid(ctx, "airport", kk * 0.9, speed=1.0, zoom=z, oy=(1 - (z - 1) / 1.3) * 0 - (z - 1) * 520)
                else:
                    self.vid(ctx, kname, kk * 0.7, speed=1.0, zoom=1.05)
            else:
                foc = {"01": (0.45, 0.45), "08": (0.5, 0.6), "02": (0.5, 0.45)}[kname]
                self.pdraw(ctx, kname, self.pcam(kname, *foc, 1.04 + 0.05 * kk))

        if cur and k < 0.28:
            pk = t - shots[cur - 1][1]
            self.stripe_wipe(ctx, lambda ox: draw(cur - 1, pk), lambda ox: draw(cur, k), prog(k, 0, 0.28),
                             cols=[(GOLD, PURPLE, ORANGE), (PURPLE, ORANGE, GOLD), (ORANGE, GOLD, PURPLE)][cur % 3])
            self.event(f"wipe dress {cur}", st)
        else:
            draw(cur, k)
        if key == "08" and k > 0.2:  # point at the flare
            cam = self.pcam("08", 0.5, 0.6, 1.04 + 0.05 * k)
            ph = self.ph["08"]
            pt = self.to_canvas((ph.w * 0.42, ph.h * 0.9), cam)
            self.arrow_label(ctx, pt, (W - 140, pt[1] - 300), "THE FLARE", k - 0.25, bg=GOLD, fg=INK, anchor="r")
        if key == "airport" and k < 0.9:
            ctx.set_source_rgba(*ORANGE, clamp(k / 0.15) * (1 - prog(k, 0.6, 0.3)))
            ctx.set_line_width(7)
            ctx.set_dash((4, 12), -k * 60)
            ctx.arc(W / 2, 1450, 260, 0, 2 * math.pi)
            ctx.stroke()
            ctx.set_dash(())
        self.pill(ctx, lab, W / 2, 300, k - 0.08, rgb_bg=col, rgb_fg=INK if col in (WHITE, GOLD) else WHITE, size=44)
        self.text(ctx, f"FIT {cur + 1:02d}/05", W - 60, 230, 26, font=MONO, align="r", a=0.85, track=2)
        if key == "airport":
            self.stamp(ctx, "AT THE AIRPORT", W / 2, 1150, k - 0.5, rgb=WHITE, size=56, rot=-5)
            self.event("bare feet", st)
        if key == "02":
            self.stamp(ctx, "NEVER TRIES TOO HARD", W / 2, 1330, t - (self._first(["never", "tries"], 5) or st + 0.6), rgb=GOLD, size=50, rot=-4)

    # TURN — royalty is the entrance
    def sc_turn(self, ctx, t):
        s0, s1 = self.Ls[6], self.Ls[7]
        t_its = self.t_(["It's", "how"], 6, (s0 + s1) / 2)
        t_car = self.t_(["car", "step"], 6, s1 - 0.5)
        if t < t_its - 0.05:
            cam = self.pcam("03", 0.45, 0.55, 1.08 + 0.04 * (t - s0))
            self.pdraw(ctx, "03", cam, "grey")
            self.pill(ctx, "NOT A TITLE", W / 2, 300, t - s0 - 0.15, rgb_bg=WHITE, rgb_fg=INK, size=40)
        else:
            k = t - t_its + 0.05
            self.whip(ctx, lambda ox: self.pdraw(ctx, "03", self.pcam("03", 0.45, 0.55, 1.12), "grey", ox=ox),
                      lambda ox: self.vid(ctx, "step", 1.4 + k * 0.55, speed=1.0, ox=ox, zoom=1.04), prog(k, 0, 0.28))
            self.event("whip → step out", t_its)
            age = t - t_car
            if age > -0.4:
                self.brackets(ctx, 150, 360, 930, 1560, e_back(prog(age + 0.4, 0, 0.45), 1.6), rgb=GOLD)
                self.event("gold brackets", t_car)
            self.pill(ctx, "IT'S THE ENTRANCE", W / 2, 300, k - 0.15, rgb_bg=GOLD, rgb_fg=INK, size=40)

    def shot_face_end(self, ctx, cam):
        self.vid(ctx, "walk", 4.0, speed=1.0)

    def crown(self, ctx, x, y, s, a=1.0, rgb=GOLD):
        srk.Reel.crown(self, ctx, x, y, s, a=a, rgb=rgb)

    def credit(self, ctx, t):
        if t > self.Ls[7]:
            return
        ctx.select_font_face(MONO)
        ctx.set_font_size(15)
        for j, c in enumerate(CREDITS):
            ex = ctx.text_extents(c)
            ctx.set_source_rgba(1, 1, 1, 0.55)
            ctx.move_to(W / 2 - ex.x_advance / 2, 165 + j * 22)
            ctx.show_text(c)


# ------------------------------------------------------------ sound: royal swagger (tabla + 808 + strings + brass stabs + sitar)
def build_audio(reel: Reel, out: Path):
    from scipy.signal import butter, lfilter

    SR = 48000
    n = int(reel.T * SR)
    t = np.arange(n) / SR
    rng = np.random.default_rng(31)

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

    bpm = 90
    beat = 60 / bpm
    bar = 4 * beat
    end_music = reel.t_logo + 0.05
    chords = [(146.83, 174.61, 220.0), (116.54, 146.83, 174.61), (98.0, 116.54, 146.83), (110.0, 138.59, 164.81)]  # Dm Bb Gm A
    roots = [73.42, 58.27, 49.0, 55.0]
    music = np.zeros(n)
    drums = np.zeros(n)

    b_lp, a_lp = butter(2, 1300 / (SR / 2))
    nb = int(end_music / bar) + 2
    for b in range(nb):
        L_ = int((bar + 0.4) * SR)
        tt = np.arange(L_) / SR
        sig = np.zeros(L_)
        for f in chords[b % 4]:
            for det in (-0.14, 0.0, 0.12):
                ph = (f * (1 + det / 100) * tt + rng.uniform()) % 1.0
                sig += 2 * ph - 1
        sig = lfilter(b_lp, a_lp, sig) / 9
        sig *= np.minimum(1, tt / 0.35) * np.minimum(1, np.maximum(0, bar + 0.4 - tt) / 0.4)
        place(music, b * bar, sig, 0.5)

    def brass(chord, dur=0.7, g=1.0):
        L_ = int(dur * SR)
        tt = np.arange(L_) / SR
        sig = np.zeros(L_)
        for f in chord:
            for mult in (1, 2):
                ph = (f * mult * tt) % 1.0
                sig += (2 * ph - 1) / mult
        # filter envelope: bright attack, closing quickly (a brass "blat")
        out_ = np.zeros(L_)
        acc = 0.0
        fc = 600 + 3800 * np.exp(-tt / 0.12)
        for q in range(0, L_):
            a = 1 - np.exp(-2 * np.pi * fc[q] / SR)
            acc += a * (sig[q] - acc)
            out_[q] = acc
        return g * np.tanh(out_ * 0.6) * np.minimum(1, tt / 0.015) * np.exp(-tt / (dur * 0.6))

    # tabla + 808 groove from the first frame (the hook needs energy immediately)
    rngt = np.random.default_rng(5)

    def dayan(f=540, g=1.0, dec=0.08):
        L_ = int(0.6 * SR)
        tt = np.arange(L_) / SR
        s = sum(a * np.sin(2 * np.pi * f * m * tt) * np.exp(-tt / (dec / m ** 0.5)) for m, a in ((1, 1), (2, 0.45), (3, 0.25), (4.2, 0.12)))
        s[:int(0.004 * SR)] += rngt.uniform(-0.6, 0.6, int(0.004 * SR))
        return g * s

    def bayan(g=1.0):
        L_ = int(0.6 * SR)
        tt = np.arange(L_) / SR
        f = 70 + 45 * np.exp(-tt / 0.08)
        return g * np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt / 0.28)

    def k808(f0):
        L_ = int(1.2 * SR)
        tt = np.arange(L_) / SR
        f = f0 + 130 * np.exp(-tt / 0.03)
        return np.tanh(2.2 * np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt / 0.75))

    def clap():
        L_ = int(0.3 * SR)
        tt = np.arange(L_) / SR
        nz = lfilter(*butter(2, [900 / (SR / 2), 6000 / (SR / 2)], "band"), rng.standard_normal(L_))
        e = np.exp(-tt / 0.08)
        for d in (0.0, 0.011, 0.022):
            e += 0.6 * np.exp(-np.maximum(tt - d, 0) / 0.006) * (tt >= d)
        return nz * e * 0.5

    strokes = {"dha": dayan(560) + bayan(0.9), "ge": bayan(1.0), "na": dayan(560, 0.9), "ti": dayan(820, 0.55, 0.04),
               "ka": dayan(380, 0.5, 0.03), "dhi": dayan(470, 0.8) + bayan(0.8)}
    groove = ["dha", "ge", "na", "ti", "na", "ka", "dhi", "na"]
    CL = clap()
    hl = int(0.04 * SR)
    hat = lfilter(*butter(2, 7000 / (SR / 2), "high"), rng.standard_normal(hl)) * np.exp(-np.arange(hl) / SR / 0.012)
    tb, i = 0.0, 0
    while tb < end_music - 0.1:
        s = groove[i % 8]
        place(drums, tb + (0.015 if i % 2 else 0), strokes[s], 0.3 * (1.0 if s in ("dha", "dhi") else 0.8))
        if i % 8 == 0:
            place(drums, tb, k808(roots[int(tb / bar) % 4]), 0.5)
        if i % 8 == 5:
            place(drums, tb, k808(roots[int(tb / bar) % 4] * 1.0), 0.35)
        if i % 4 == 2:
            place(drums, tb, CL, 0.55)
        place(drums, tb, hat, 0.12)
        tb += beat / 2
        i += 1

    # brass stabs: the hook, "Nawab", each section title, the end card
    stabs = [0.02]
    try:
        stabs.append(base.Reel._first(reel, ["Nawab"], 0))
    except Exception:
        pass
    stabs += [reel.Ls[i] + 0.02 for i in (2, 3, 4, 5)] + [reel.Ls[7] + 0.02]
    for j, st in enumerate(stabs):
        ch = chords[j % 4]
        place(music, st, brass(ch, 0.6), 0.55)
        place(music, st + 0.33, brass(ch, 0.5), 0.4)

    # sitar motif under the charm + looks sections
    motif = [(0, 293.66), (0.5, 329.63), (1.0, 349.23), (1.5, 440.0), (2.0, 349.23), (2.5, 329.63), (3.0, 293.66)]
    for start in (reel.Ls[2] + 0.9, reel.Ls[4] + 0.9):
        for off, f in motif:
            place(music, start + off * beat / 2, srk.ks_pluck(f, 1.0, SR, 0.996, 0.55, seed=int(f * 5)), 0.2)

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

    def ding(at, g=0.3):  # update-installed ding
        L_ = int(0.9 * SR)
        tt = np.arange(L_) / SR
        place(sfx, at, (np.sin(2 * np.pi * 1568 * tt) + 0.5 * np.sin(2 * np.pi * 2093 * tt)) * np.exp(-tt / 0.3), g)

    hit(0.0, 0.85)
    for i in (2, 3, 4, 5):
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
                hit(at + 0.05, 0.35)
        elif nm.startswith(("crown", "SAIF")):
            chime(at, 0.35)
            hit(at, 0.5)
        elif nm.startswith("ha bubbles"):
            for j in range(4):
                pop(at + 0.12 * j, 700 + 120 * j, 0.22)
        elif nm.startswith("update"):
            ding(at + 1.2, 0.35)
        elif nm.startswith("logo"):
            continue
        else:
            pop(at, 650 + 250 * (sum(map(ord, nm)) % 3), 0.16)
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
    out = R / "saif_nawab.mp4"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(R / "video.mp4"), "-i", str(wav), "-map", "0:v", "-map", "1:a", "-c:v", "copy",
                    "-af", "loudnorm=I=-14:TP=-1.5:LRA=9,aresample=48000", "-c:a", "aac", "-b:a", "256k", "-shortest", "-movflags", "+faststart", str(out)],
                   check=True)
    print("done:", out)


if __name__ == "__main__":
    main()
