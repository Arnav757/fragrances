"""Reaction reel: "Why is King Khan still the most magnetic face in India?" — 9:16, generated voice, FORMA styling.

    python studio/reels/srk_face.py studio/work/srk                  # → render/srk_face.mp4
    python studio/reels/srk_face.py studio/work/srk --stills 1 5 12 ...

Inputs in <work>:
  img/01..07.png      the supplied photos, card borders cropped (04, 06, 07 EDSR x3)
  lm.json             Face Mesh landmarks on the CROPPED photos 04, 07, 01, 02 (crop pixel coords)
  voice/narration.wav, voice/words.json, voice/lines.json

Built on sid_face.Reel (brand panels, captions, pills, mesh scan). Every graphic is keyed to a spoken word and the
proportion graphics are drawn from his measured landmarks on the frontal polaroid (04).
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
import forma_ad as fa  # noqa: E402  (logo animation geometry + brush strokes)
import sid_face as base  # noqa: E402
from render import rounded  # noqa: E402
from sid_face import (COBALT, DISPLAY, FPS, H, ICE, INK, LEAD, LIME, MONO, ORANGE, WHITE, W, Photo, clamp,  # noqa: E402
                      cover_scale, e_back, e_in, e_io, e_out, lerp, paint_cam, prog)

UP = {"04": 3.0, "06": 3.0, "07": 3.0}   # EDSR factor per image (others are the crops as-is)
TAIL = 5.4                               # end card + logo after the last word
CREDIT = "PHOTOS: IIFA · JATIN KAMPANI · PRESS ARCHIVE"
RED = (0.80, 0.22, 0.24)


class Reel(base.Reel):
    def __init__(self, work: Path):  # noqa: C901  (deliberately not calling base.__init__: different inputs)
        import mediapipe as mp

        self.work = work
        seg = mp.solutions.selfie_segmentation.SelfieSegmentation(model_selection=1)
        self.ph = {p.stem: Photo(p, seg) for p in sorted((work / "img").glob("0*.png"))}
        lm = json.loads((work / "lm.json").read_text())
        self.LM = {k: np.array(v) * UP.get(k, 1.0) for k, v in lm.items()}
        self.L = self.LM["04"]
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
        L = self.L
        # ---- measured: the rule of fifths across the eye line (image-left → image-right)
        self.fifth_x = [L[234][0], L[33][0], L[133][0], L[362][0], L[263][0], L[454][0]]
        eye = (np.linalg.norm(L[33] - L[133]) + np.linalg.norm(L[362] - L[263])) / 2
        self.eye_w = eye
        self.fifths = [abs(b - a) / eye for a, b in zip(self.fifth_x, self.fifth_x[1:])]
        self.eyes_wide = (L[454][0] - L[234][0]) / eye
        self.eye_y = (L[159][1] + L[145][1] + L[386][1] + L[374][1]) / 4
        # ---- cameras on 04 (image coords of the x3 upscale, canvas px per image px)
        p4 = self.ph["04"]
        self.cam_wide = (p4.w / 2, p4.h * 0.45, cover_scale(p4.w, p4.h))
        fc = ((L[234][0] + L[454][0]) / 2, (L[10][1] + L[152][1]) / 2 - 60)
        self.cam_face = (fc[0], fc[1], 1.62)
        ec = ((L[70][0] + L[300][0]) / 2, (L[105][1] + L[145][1]) / 2)
        self.cam_eyes = (ec[0], ec[1], 2.55)
        self.cam_hair = (fc[0], L[10][1] - 60, 1.32)
        self.cam_fifths = (fc[0], self.eye_y + 40, 2.0)
        L7 = self.LM["07"]
        self.cam7_eyes = ((L7[33][0] + L7[263][0]) / 2, (L7[159][1] + L7[386][1]) / 2, 2.2)
        self._hair_mask(seg)

    # ------------------------------------------------------------ prep
    def _hair_mask(self, seg):
        """Hair on the polaroid: dark pixels inside the person, above the brows and outside the face oval."""
        ph = self.ph["04"]
        bgr = cv2.imread(str(self.work / "img" / "04.png"))
        small = cv2.resize(bgr, (ph.w // 3, ph.h // 3))
        L = self.L / 3
        person = seg.process(cv2.cvtColor(cv2.resize(small, (512, 512)), cv2.COLOR_BGR2RGB)).segmentation_mask
        person = cv2.resize(person, (small.shape[1], small.shape[0])) > 0.4
        grey = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)
        dark = grey < 95
        yy = np.arange(small.shape[0])[:, None]
        brow_top = min(L[i][1] for i in (70, 63, 105, 66, 107, 336, 296, 334, 293, 300)) - 6
        m = person & dark & (yy < brow_top)
        m = cv2.morphologyEx(m.astype(np.uint8) * 255, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
        m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
        n, lab, stats, _ = cv2.connectedComponentsWithStats(m)
        if n > 1:
            m = (lab == 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))).astype(np.uint8) * 255
        self.hair_small = m
        big = cv2.GaussianBlur(cv2.resize(m, (ph.w, ph.h)), (0, 0), 4).astype(np.float32) / 255
        tint = np.zeros((ph.h, ph.w, 4), np.uint8)
        tint[..., 0], tint[..., 1], tint[..., 2] = int(LIME[2] * 255), int(LIME[1] * 255), int(LIME[0] * 255)
        tint[..., 3] = 255
        self.hair_tint = base.to_surface((tint.astype(np.float32) * big[..., None]).astype(np.uint8))
        # strands: for columns across the hair, crown → fringe tip, bending toward the side it falls
        ys, xs = np.nonzero(m)
        x0, x1 = np.percentile(xs, 8), np.percentile(xs, 92)
        cx = (L[234][0] + L[454][0]) / 2
        strands = []
        for x in np.linspace(x0, x1, 9):
            col = ys[np.abs(xs - x) < 3]
            if len(col) < 10:
                continue
            top, bot = np.percentile(col, 4), np.percentile(col, 97)
            bend = (x - cx) * 0.25 + 14
            pts = [(x + bend * (u ** 1.6), lerp(top, bot, u)) for u in np.linspace(0, 1, 24)]
            strands.append([(px * 3, py * 3) for px, py in pts])
        self.strands = strands

    # ------------------------------------------------------------ shots
    def shot_face(self, ctx, cam, ox=0.0, grey=False, key="04"):
        if self._in_end and cam is self.cam_wide:  # the base end card wipes up over this; use the black-suit shot
            self.shot_face_end(ctx, cam)
            return
        ph = self.ph[key]
        paint_cam(ctx, ph.grey if grey else ph.full, ph.w, ph.h, cam[0], cam[1], cam[2], ox=ox)

    def letterbox(self, ctx, u, h=150):
        if u <= 0:
            return
        ctx.set_source_rgb(0, 0, 0)
        ctx.rectangle(0, 0, W, h * u)
        ctx.rectangle(0, H - h * u, W, h * u)
        ctx.fill()

    def stripe_wipe(self, ctx, draw_a, draw_b, u, cols=(ORANGE, COBALT, LIME)):
        """Brand wipe: three diagonal colour bands sweep left→right; the next shot sits behind them."""
        if u <= 0:
            draw_a(0)
            return
        if u >= 1:
            draw_b(0)
            return
        e = e_io(u)
        lead = lerp(-500, W + 900, e)
        slope = 420

        def band(x0, x1):
            ctx.move_to(x0, 0)
            ctx.line_to(x1, 0)
            ctx.line_to(x1 - slope, H)
            ctx.line_to(x0 - slope, H)
            ctx.close_path()

        draw_a(0)
        ctx.save()
        band(-2000, lead - 300)
        ctx.clip()
        draw_b(0)
        ctx.restore()
        for i, c in enumerate(cols):
            a = lead - 300 + i * 100
            ctx.set_source_rgb(*c)
            band(a, a + 100)
            ctx.fill()

    def crown(self, ctx, x, y, s, a=1.0, rgb=ORANGE):
        """A small crown, base centred at (x, y), width s."""
        if a <= 0:
            return
        h = s * 0.62
        ctx.save()
        ctx.set_source_rgba(*rgb, a)
        ctx.move_to(x - s / 2, y)
        ctx.line_to(x - s / 2, y - h * 0.62)
        ctx.line_to(x - s * 0.25, y - h * 0.3)
        ctx.line_to(x, y - h)
        ctx.line_to(x + s * 0.25, y - h * 0.3)
        ctx.line_to(x + s / 2, y - h * 0.62)
        ctx.line_to(x + s / 2, y)
        ctx.close_path()
        ctx.fill()
        for px, py in ((x - s / 2, y - h * 0.62), (x, y - h), (x + s / 2, y - h * 0.62)):
            ctx.arc(px, py - s * 0.06, s * 0.07, 0, 2 * math.pi)
            ctx.fill()
        ctx.restore()

    def brackets(self, ctx, x0, y0, x1, y1, k, rgb=ORANGE, cl=70, width=9):
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        hw, hh = (x1 - x0) / 2 * lerp(1.5, 1.0, k), (y1 - y0) / 2 * lerp(1.5, 1.0, k)
        ctx.set_source_rgba(*rgb, clamp(k * 1.5))
        ctx.set_line_width(width)
        for sx, sy in ((-1, -1), (1, -1), (-1, 1), (1, 1)):
            X, Y = cx + sx * hw, cy + sy * hh
            ctx.move_to(X - sx * cl, Y)
            ctx.line_to(X, Y)
            ctx.line_to(X, Y - sy * cl)
        ctx.stroke()

    def t_(self, toks, sec, default):
        v = self._first(toks, sec)
        return v if v is not None else default

    # ------------------------------------------------------------ scenes
    def frame(self, ctx, t):
        Ls = self.Ls
        self._in_end = Ls[6] <= t < self.t_logo
        ctx.set_source_rgb(0, 0, 0)
        ctx.paint()
        if t < Ls[1]:
            self.sc_hook(ctx, t)
        elif t < Ls[2]:
            self.sc_eyes(ctx, t)
        elif t < Ls[3]:
            self.sc_hair(ctx, t)
        elif t < Ls[4]:
            self.sc_fifths(ctx, t)
        elif t < Ls[5]:
            self.sc_attitude(ctx, t)
        elif t < Ls[6]:
            self.sc_turn(ctx, t)
        elif t < self.t_logo:
            self.sc_end(ctx, t)
        else:
            self.sc_logo(ctx, t)

    # HOOK — the pop-art poster, headline stacks, then the scan
    def sc_hook(self, ctx, t):
        t_break = self.t_("Let's", 0, self.Ls[1] - 1.2) - 0.05
        if t < t_break:
            ph = self.ph["01"]
            # starts tight on the eyes, pulls back to the poster with a little overshoot
            u = e_back(prog(t, 0.0, 0.9), 1.3)
            s = cover_scale(ph.w, ph.h) * lerp(2.3, 1.06, u) * (1 + 0.035 * t)
            cy = lerp(ph.h * 0.455, ph.h * 0.44, u)
            paint_cam(ctx, ph.full, ph.w, ph.h, ph.w * 0.5, cy, s)
            if t < 0.12:
                ctx.set_source_rgba(1, 1, 1, 0.7 * (1 - t / 0.12))
                ctx.paint()
            g = cairo.LinearGradient(0, 0, 0, 900)
            g.add_color_stop_rgba(0, 0, 0, 0, 0.6)
            g.add_color_stop_rgba(1, 0, 0, 0, 0)
            ctx.set_source(g)
            ctx.rectangle(0, 0, W, 900)
            ctx.fill()
            rows = [("WHY IS", ["Why", "is"], WHITE), ("KING KHAN", ["King", "Khan"], INK), ("STILL THIS", ["still", "the"], WHITE),
                    ("MAGNETIC?", ["magnetic"], ORANGE)]
            y = 300
            for txt, keys, bgc in rows:
                tk = self._first(keys, 0)
                age = t - (tk if tk is not None else 99) + 0.08
                if age > 0:
                    k = e_back(prog(age, 0, 0.3), 2.2)
                    ctx.save()
                    ctx.translate(W / 2, y - 40)
                    ctx.scale(k, k)
                    ctx.translate(-W / 2, -(y - 40))
                    ctx.select_font_face(DISPLAY)
                    ctx.set_font_size(100)
                    tw = ctx.text_extents(txt).x_advance + 2 * (len(txt) - 1)
                    bw = (tw + 60) * e_out(prog(age, 0, 0.22))
                    ctx.set_source_rgba(*bgc, clamp(age / 0.08))
                    ctx.rectangle(W / 2 - (tw + 60) / 2, y - 90, bw, 114)
                    ctx.fill()
                    if bw > tw * 0.6:
                        fg = INK if bgc == WHITE else WHITE
                        self.text(ctx, txt, W / 2, y, 100, rgb=fg, a=clamp((bw - tw * 0.6) / (tw * 0.4)), track=2, shadow=False)
                    ctx.restore()
                    if txt == "KING KHAN":
                        # the crown drops onto the box
                        d = e_back(prog(age, 0.12, 0.4), 2.6)
                        self.crown(ctx, W / 2 + (tw + 60) / 2 - 30, y - 92 - lerp(180, 0, d), 86, a=clamp((age - 0.12) / 0.1))
                        if 0.3 < age < 0.6:
                            self.event("crown lands", t - age + 0.4)
                y += 128
            t_30 = self._first(["thirty"], 0)
            if t_30 is not None and t > t_30:
                age = t - t_30
                # the years count up 0 → 30+
                n = round(30 * e_out(prog(age, 0, 0.6)))
                self.pill(ctx, f"{n}+ YEARS", W / 2, 1240, age, rgb_bg=LIME, rgb_fg=INK, size=44)
                self.event("years counter", t_30)
        else:
            k = t - t_break
            dur = self.Ls[1] - t_break
            cam = self.cam_lerp(self.cam_wide, self.cam_face, prog(k, 0, 0.9))
            self.shot_face(ctx, cam)
            self.mesh_scan(ctx, cam, prog(k, 0.15, 1.1), fade=1 - prog(k, dur - 0.35, 0.3))
            self.pill(ctx, "THE BREAKDOWN", W / 2, 300, k - 0.1, rgb_bg=LIME, rgb_fg=INK, size=36)
            self.event("cut → frontal scan", t_break)

    # 01 THE EYES
    def sc_eyes(self, ctx, t):
        s0, s1 = self.Ls[1], self.Ls[2]
        t_brows = self.t_(["Heavy", "brows"], 1, s0 + 1.3)
        t_close = self._first(["close"], 1)
        t_deep = self._first(["deep-set", "deep", "deepset"], 1)
        t_silent = self._first(["silent", "even"], 1)
        t_say = self._first(["something", "say"], 1)
        cut_at = (t_silent - 0.1) if t_silent else s1 - 1.6
        L = self.L
        if t < cut_at:
            cam = self.cam_lerp(self.cam_face, self.cam_eyes, prog(t, s0 + 0.35, 1.0))
            self.shot_face(ctx, cam)
            x0, y0 = self.to_canvas((L[70][0] - 30, L[105][1] - 50), cam)
            x1, y1 = self.to_canvas((L[300][0] + 30, L[145][1] + 40), cam)
            ap = e_out(prog(t, t_brows - 0.2, 0.4))
            if ap > 0:
                ctx.save()
                ctx.rectangle(0, 0, W, H)
                ctx.rectangle(x0, y0, x1 - x0, y1 - y0)
                ctx.set_fill_rule(cairo.FILL_RULE_EVEN_ODD)
                ctx.set_source_rgba(0, 0, 0, 0.55 * ap)
                ctx.fill()
                ctx.restore()
                ctx.set_source_rgba(*ORANGE, ap)
                ctx.set_line_width(5)
                for (cx, cy, dx, dy) in ((x0, y0, 1, 1), (x1, y0, -1, 1), (x0, y1, 1, -1), (x1, y1, -1, -1)):
                    ctx.move_to(cx + dx * 50, cy)
                    ctx.line_to(cx, cy)
                    ctx.line_to(cx, cy + dy * 50)
                ctx.stroke()
            # heavy brows: thick lines along each brow
            p = e_io(prog(t, t_brows - 0.05, 0.5))
            for ids in (base.BROW_L, base.BROW_R):
                pts = [self.to_canvas(L[i], cam) for i in ids]
                end = self.dotted(ctx, pts, p, width=7, dash=(16, 9))
                if end and p < 1:
                    self.node(ctx, *end, 9)
            self.event("brow lines", t_brows)
            self.pill(ctx, "HEAVY BROWS", W / 2 - 200, y0 - 70, t - t_brows - 0.1, size=32)
            # close: brow → lid gap brackets
            if t_close is not None and t > t_close:
                age = t - t_close
                for bi, ei in ((105, 159), (334, 386)):
                    bx, by = self.to_canvas((L[bi][0], L[bi][1] + 6), cam)
                    _, ey = self.to_canvas(L[ei], cam)
                    pp = e_out(prog(age, 0, 0.35))
                    ctx.set_source_rgb(*WHITE)
                    ctx.set_line_width(4)
                    ctx.move_to(bx - 14, by)
                    ctx.line_to(bx + 14, by)
                    ctx.move_to(bx, by)
                    ctx.line_to(bx, lerp(by, ey, pp))
                    ctx.move_to(bx - 14, lerp(by, ey, pp))
                    ctx.line_to(bx + 14, lerp(by, ey, pp))
                    ctx.stroke()
                self.pill(ctx, "SIT CLOSE", W / 2 + 200, y0 - 70, age, size=32, rgb_bg=COBALT)
                self.event("brow gap brackets", t_close)
            # deep-set: dotted rings settle around each eye socket
            if t_deep is not None and t > t_deep:
                age = t - t_deep
                for a_, b_, top_, bot_ in ((33, 133, 159, 145), (362, 263, 386, 374)):
                    cx_ = (L[a_][0] + L[b_][0]) / 2
                    cy_ = (L[top_][1] + L[bot_][1]) / 2 - 6
                    X, Y = self.to_canvas((cx_, cy_), cam)
                    rx = abs(L[b_][0] - L[a_][0]) * cam[2] * 0.78
                    k = e_back(prog(age, 0, 0.45), 1.8)
                    ctx.save()
                    ctx.translate(X, Y)
                    ctx.scale(rx * lerp(1.6, 1, k), rx * 0.62 * lerp(1.6, 1, k))
                    ctx.arc(0, 0, 1, 0, 2 * math.pi)
                    ctx.restore()
                    ctx.set_source_rgba(*ORANGE, clamp(age / 0.15))
                    ctx.set_line_width(5)
                    ctx.set_dash((3, 11))
                    ctx.set_line_cap(cairo.LINE_CAP_ROUND)
                    ctx.stroke()
                    ctx.set_dash(())
                self.pill(ctx, "DEEP-SET", W / 2, y1 + 90, age - 0.1, size=34, rgb_bg=LIME, rgb_fg=INK)
                self.event("socket rings", t_deep)
            self.section_title(ctx, "01", "THE EYES", t, s0)
        else:
            # whip to the magazine portrait, cinematic bars, slow push on his eyes
            k = t - cut_at
            p7 = self.ph["07"]

            def b_(ox):
                c = self.cam7_eyes
                s = c[2] * (1 + 0.05 * prog(k, 0, s1 - cut_at))
                cx = min(max(c[0], W / 2 / s), p7.w - W / 2 / s)
                paint_cam(ctx, p7.full, p7.w, p7.h, cx, c[1] + 160, s, ox=ox)

            self.whip(ctx, lambda ox: self.shot_face(ctx, self.cam_eyes, ox), b_, prog(k, 0, 0.28), direction=-1)
            self.letterbox(ctx, e_out(prog(k, 0.15, 0.4)), 170)
            if t_say is not None:
                self.pill(ctx, "SAYS IT WITHOUT A WORD", W / 2, 1290, t - t_say + 0.1, rgb_bg=ORANGE, size=34)
            self.event("whip → magazine eyes", cut_at)

    # 02 THE HAIR
    def sc_hair(self, ctx, t):
        s0, s1 = self.Ls[2], self.Ls[3]
        t_thick = self.t_(["Thick"], 2, s0 + 1.2)
        t_messy = self._first(["messy"], 2)
        t_fall = self._first(["falling", "forward"], 2)
        t_soft = self._first(["softens"], 2)
        t_sharp = self._first(["sharp"], 2)
        t_era = self._first(["started", "era"], 2)
        cut_at = (t_era - 0.12) if t_era else s1 - 1.2
        if t < cut_at:
            cam = self.cam_lerp(self.cam_face, self.cam_hair, prog(t, s0 + 0.3, 1.0))
            self.shot_face(ctx, cam)
            ph = self.ph["04"]
            # lime glow over the hair, wiping down from the crown on "Thick"
            if t > t_thick - 0.1:
                age = t - t_thick + 0.1
                top = self.to_canvas((0, self.L[10][1] - 1200), cam)[1]
                bot = self.to_canvas((0, self.L[105][1]), cam)[1]
                yc = lerp(top, bot + 40, e_io(prog(age, 0, 0.6)))
                ctx.save()
                ctx.rectangle(0, 0, W, yc)
                ctx.clip()
                breathe = 0.33 + 0.08 * math.sin(age * 5)
                fade = 1 - 0.55 * prog(t, t_soft or s1, 0.4) if t_soft else 1
                ctx.save()
                ctx.translate(W / 2, H / 2)
                ctx.scale(cam[2], cam[2])
                ctx.translate(-cam[0], -cam[1])
                ctx.set_source_surface(self.hair_tint, 0, 0)
                ctx.paint_with_alpha(breathe * fade)
                ctx.restore()
                ctx.restore()
                self.event("hair glow", t_thick)
            self.pill(ctx, "THICK", 200, 520, t - t_thick, size=38, anchor="l", rgb_bg=LIME, rgb_fg=INK)
            if t_messy is not None:
                self.pill(ctx, "A LITTLE MESSY", W - 170, 640, t - t_messy, size=34, anchor="r", rgb_bg=WHITE, rgb_fg=INK)
                if t > t_messy:
                    self.event("messy tag", t_messy)
            # strands flow down to the fringe on "falling forward"
            if t_fall is not None and t > t_fall - 0.15:
                age = t - t_fall + 0.15
                for i, st in enumerate(self.strands):
                    pts = [self.to_canvas(q, cam) for q in st]
                    p = e_out(prog(age, 0.03 * i, 0.7))
                    ctx.save()
                    ctx.set_line_width(4)
                    ctx.set_line_cap(cairo.LINE_CAP_ROUND)
                    ctx.set_dash((18, 14), -age * 90)
                    ctx.set_source_rgba(1, 1, 1, 0.85 * (1 - 0.6 * prog(t, (t_soft or s1), 0.4)))
                    n = max(2, int(len(pts) * p))
                    ctx.move_to(*pts[0])
                    for q in pts[1:n]:
                        ctx.line_to(*q)
                    ctx.stroke()
                    ctx.restore()
                    if p < 1:
                        self.node(ctx, *pts[n - 1], 6)
                # arrow on the tip of the fringe
                tip = max((st[-1] for st in self.strands), key=lambda q: q[1])
                X, Y = self.to_canvas(tip, cam)
                a = e_back(prog(age, 0.5, 0.35))
                if a > 0:
                    ctx.set_source_rgba(*ORANGE, clamp(a))
                    ctx.move_to(X - 22 * a, Y + 10)
                    ctx.line_to(X + 22 * a, Y + 10)
                    ctx.line_to(X, Y + 10 + 34 * a)
                    ctx.close_path()
                    ctx.fill()
                self.pill(ctx, "FALLS FORWARD", W / 2, 1290, age - 0.2, size=36)
                self.event("strands flow", t_fall)
            # "softens a sharp face": the sharp jaw outline appears, the hair softens it
            if t_sharp is not None and t > t_sharp - 0.1:
                age = t - t_sharp + 0.1
                L = self.L
                pts = [self.to_canvas(L[i], cam) for i in base.JAW]
                self.dotted(ctx, pts, e_io(prog(age, 0, 0.6)), width=5, rgb=WHITE)
                self.pill(ctx, "SOFT FRAME · SHARP FACE", W / 2, 1290, age - 0.05, size=32, rgb_bg=COBALT)
                self.event("jaw outline (sharp)", t_sharp)
            self.section_title(ctx, "02", "THE HAIR", t, s0)
        else:
            k = t - cut_at
            self.stripe_wipe(ctx, lambda ox: self.shot_face(ctx, self.cam_hair),
                             lambda ox: self.shot_parallax(ctx, "02", k, s1 - cut_at, (0.36, 0.24), push=0.09), prog(k, 0, 0.45))
            if k > 0.35:
                age = k - 0.35
                self.pill(ctx, "THE SRK FRINGE", W / 2, 300, age, rgb_bg=INK, size=38)
                # a stamp-style era label
                st = e_back(prog(age, 0.25, 0.35), 2.5)
                if st > 0:
                    ctx.save()
                    ctx.translate(W - 230, 1240)
                    ctx.rotate(math.radians(-8))
                    ctx.scale(lerp(1.8, 1, st), lerp(1.8, 1, st))
                    rounded(ctx, -150, -62, 300, 124, 18)
                    ctx.set_source_rgba(*ORANGE, clamp(st * 2))
                    ctx.set_line_width(8)
                    ctx.stroke()
                    self.text(ctx, "AN ERA", 0, 22, 62, rgb=ORANGE, a=clamp(st * 2), shadow=False)
                    ctx.restore()
            self.event("stripe wipe → era", cut_at)

    # 03 PROPORTIONS — the rule of fifths, measured
    def sc_fifths(self, ctx, t):
        s0, s1 = self.Ls[3], self.Ls[4]
        t_five = self.t_(["five"], 3, s0 + 2.2)
        t_exact = self.t_(["exactly", "almost"], 3, t_five - 0.4)
        t_space = self._first(["space", "between"], 3)
        t_classic = self._first(["classic", "balance"], 3)
        t_art = self._first(["artists"], 3)
        cam = self.cam_lerp(self.cam_face, self.cam_fifths, prog(t, s0 + 0.3, 1.0))
        if t_classic is not None:
            cam = self.cam_lerp(cam, self.cam_face, prog(t, t_classic - 0.2, 0.9))
        self.shot_face(ctx, cam)
        L = self.L
        xs = [self.to_canvas((x, 0), cam)[0] for x in self.fifth_x]
        yc = self.to_canvas((0, self.eye_y), cam)[1]
        bh = self.eye_w * 0.95 * cam[2]
        cols = [ICE, ORANGE, LIME, ORANGE, ICE]
        # dim the frame outside the eye band once the ruler starts
        dim = e_out(prog(t, t_exact - 0.1, 0.4))
        if dim > 0:
            ctx.save()
            ctx.rectangle(0, 0, W, H)
            ctx.rectangle(0, yc - bh * 0.9, W, bh * 1.8)
            ctx.set_fill_rule(cairo.FILL_RULE_EVEN_ODD)
            ctx.set_source_rgba(0, 0, 0, 0.45 * dim)
            ctx.fill()
            ctx.restore()
        # boundaries draw down, then the five boxes count off one by one
        for i, x in enumerate(xs):
            p = e_io(prog(t, t_exact - 0.1 + 0.05 * i, 0.4))
            self.dotted(ctx, [(x, yc - bh * 1.6), (x, yc + bh * 1.6)], p, width=4, dash=(8, 9), glow=False)
        hl = 0.0
        if t_space is not None:
            hl = e_out(prog(t, t_space - 0.05, 0.3))
        for i in range(5):
            age = t - t_five - 0.13 * i
            if age <= 0:
                continue
            a = e_out(prog(age, 0, 0.25))
            mid = i == 2
            alpha = (0.28 if not mid else lerp(0.28, 0.5 + 0.12 * math.sin(age * 8), hl)) * a
            ctx.set_source_rgba(*cols[i], alpha)
            ctx.rectangle(xs[i] + 3, yc - bh / 2, xs[i + 1] - xs[i] - 6, bh)
            ctx.fill()
            k = e_back(prog(age, 0, 0.3), 2.4)
            cx_ = (xs[i] + xs[i + 1]) / 2
            ctx.save()
            ctx.translate(cx_, yc - bh / 2 - 60)
            ctx.scale(k, k)
            ctx.set_source_rgb(*(ORANGE if mid and hl > 0 else WHITE))
            ctx.arc(0, 0, 30, 0, 2 * math.pi)
            ctx.fill()
            self.text(ctx, str(i + 1), 0, 13, 36, rgb=INK if not (mid and hl > 0) else WHITE, shadow=False)
            ctx.restore()
            # the measured width of each fifth, in eye-widths
            self.text(ctx, f"{self.fifths[i]:.1f}", cx_, yc + bh / 2 + 52, 34, a=a * clamp((age - 0.15) / 0.2), track=1)
            if i == 0:
                self.event("fifths count", t_five)
        self.pill(ctx, f"{self.eyes_wide:.1f} EYES WIDE", W / 2, 300, t - t_exact - 0.1, rgb_bg=INK, size=40)
        if t_space is not None and t > t_space:
            self.pill(ctx, "≈ ONE EYE APART", W / 2, yc + bh / 2 + 150, t - t_space - 0.1, rgb_bg=ORANGE, size=34)
            self.event("middle fifth", t_space)
        if t_classic is not None and t > t_classic:
            age = t - t_classic
            # the full-height guides of the classic grid sweep in
            for i, x in enumerate(xs):
                p = e_io(prog(age, 0.05 * i, 0.5))
                ctx.set_source_rgba(1, 1, 1, 0.35)
                ctx.set_line_width(2)
                ctx.move_to(x, H / 2 - H / 2 * p)
                ctx.line_to(x, H / 2 + H / 2 * p)
                ctx.stroke()
            self.pill(ctx, "THE RULE OF FIFTHS", W / 2, 1300, (t - (t_art or t_classic)) - 0.05, rgb_bg=LIME, rgb_fg=INK, size=36)
            self.event("rule of fifths", t_classic)
        self.section_title(ctx, "03", "PROPORTIONS", t, s0)

    # THE REAL SECRET — attitude montage across every look
    def sc_attitude(self, ctx, t):
        s0, s1 = self.Ls[4], self.Ls[5]
        t_att = self.t_(["attitude"], 4, s0 + 1.2)
        t_black = self.t_(["black", "All"], 4, t_att + 1.0)
        t_red = self.t_(["red", "carpet"], 4, t_black + 0.6)
        t_white = self.t_(["white", "kurta"], 4, t_red + 0.9)
        t_wears = self.t_(["wears", "He"], 4, t_white + 0.9)
        t_owns = self.t_(["owns", "room"], 4, t_wears + 0.8)
        if t < t_att + 0.95:
            # kicker over the poster, then the panel
            self.shot_parallax(ctx, "01", t - s0, t_att + 1 - s0, (0.5, 0.44), push=0.08)
            self.pill(ctx, "THE REAL SECRET", W / 2, 300, t - s0 - 0.05, rgb_bg=INK, size=40)
            self.section_title(ctx, "", "ATTITUDE", t, t_att - 0.1, dur=0.85, kicker="THE REAL SECRET")
            return
        shots = [("02", t_black, (0.36, 0.3), "ALL BLACK", INK, WHITE),
                 ("03", t_red, (0.5, 0.36), "ON THE RED", RED, WHITE),
                 ("06", t_white - 0.08, (0.62, 0.3), "WHITE KURTA", WHITE, INK),
                 ("05", t_wears - 0.08, (0.45, 0.3), "WEARS IT", ORANGE, WHITE),
                 ("07", t_owns - 0.1, (0.45, 0.28), "OWNS THE ROOM", ORANGE, WHITE)]
        cur = 0
        for i, sh in enumerate(shots):
            if t >= sh[1]:
                cur = i
        key, st, foc, lab, bg, fg = shots[cur]
        end = shots[cur + 1][1] if cur + 1 < len(shots) else s1
        k = t - st
        prev = shots[cur - 1] if cur > 0 else None
        u = prog(k, 0, 0.32)
        if prev is not None and u < 1:
            pk = t - prev[1]
            pdur = st - prev[1]
            wipe_cols = [(ORANGE, COBALT, LIME), (LIME, ORANGE, COBALT), (COBALT, LIME, ORANGE), (ORANGE, LIME, COBALT)][cur % 4]
            self.stripe_wipe(ctx, lambda ox: self.shot_parallax(ctx, prev[0], pk, pdur, prev[2], push=0.1, drift=-1),
                             lambda ox: self.shot_parallax(ctx, key, k, end - st, foc, push=0.1), u, cols=wipe_cols)
        else:
            self.shot_parallax(ctx, key, k if k > 0 else t - t_att, end - st, foc, push=0.1, drift=1 if cur % 2 else -1)
        if key == "07":
            self.letterbox(ctx, e_out(prog(k, 0.1, 0.4)), 150)
            # crown above his head on "owns the room"
            d = e_back(prog(k, 0.25, 0.45), 2.4)
            self.crown(ctx, W / 2 + 30, 560 - lerp(220, 0, d), 120, a=clamp((k - 0.25) / 0.12))
        self.pill(ctx, lab, W / 2, 1300, k - 0.18, rgb_bg=bg, rgb_fg=fg, size=44)
        # a running counter of the looks in the corner
        self.text(ctx, f"LOOK {cur + 1:02d}/05", W - 60, 230, 26, font=MONO, align="r", a=0.85, track=2)
        self.event(f"look {cur + 1}", st)

    # TURN — face vs. carriage
    def sc_turn(self, ctx, t):
        s0, s1 = self.Ls[5], self.Ls[6]
        t_but = self.t_(["but", "But"], 5, (s0 + s1) / 2)
        t_carries = self.t_(["carries"], 5, t_but + 0.8)
        if t < t_but:
            self.shot_face(ctx, self.cam_face, grey=True)
            self.mesh_scan(ctx, self.cam_face, 1.0, fade=e_out(prog(t, s0, 0.3)))
            self.pill(ctx, "THE FACE: HIS", W / 2, 300, t - s0 - 0.15, rgb_bg=WHITE, rgb_fg=INK, size=38)
        else:
            k = t - t_but
            ph = self.ph["02"]
            self.whip(ctx, lambda ox: self.shot_face(ctx, self.cam_face, ox, grey=True),
                      lambda ox: self.shot_parallax(ctx, "02", k, s1 - t_but, (0.4, 0.32), push=0.06, ox=ox), prog(k, 0, 0.28))
            age = t - t_carries
            if age > -0.35:
                kk = e_back(prog(age + 0.35, 0, 0.45), 1.6)
                self.brackets(ctx, 170, 330, 860, 1560, kk)
                self.event("carry brackets", t_carries)
            self.pill(ctx, "THE CARRY: YOURS", W / 2, 300, k - 0.15, rgb_bg=ORANGE, size=38)
            _ = ph

    # END — who's next
    def sc_end(self, ctx, t):
        base.Reel.sc_end(self, ctx, t)

    def shot_face_end(self, ctx, cam):  # used by the base end card while its panel wipes up
        self.shot_parallax(ctx, "02", 2.0, 2.0, (0.4, 0.32), push=0.06)

    # LOGO — the orange brush stroke closes into the dot and the F builds around it
    def sc_logo(self, ctx, t):
        t0 = self.t_logo
        k = t - t0
        ctx.set_source_rgb(1, 1, 1)
        ctx.paint()
        mx, my, ms = 389, 700, 0.86
        dx, dy, dr = mx + 281 * ms, my + 414 * ms, 50 * ms
        pts = fa.bezier_pts([((-80, 1500), (300, 1700), (500, 400), (900, 650)), ((900, 650), (1150, 850), (800, 1190), (dx, dy))])
        head = e_out(prog(k, 0.0, 0.55))
        tail = e_io(prog(k, 0.3, 0.55))
        fa.stroke_part(ctx, pts, tail, head, 70, ORANGE)
        settle = prog(k, 0.78, 0.2)
        if settle > 0:
            fa.dot(ctx, dx, dy, dr * fa.back(settle, 2.0))
        tf = t0 + 1.0
        u1, u2, u3 = (e_out(prog(t, tf + d, 0.32)) for d in (0.0, 0.1, 0.18))
        ctx.save()
        ctx.translate(mx, my)
        ctx.scale(ms, ms)
        ctx.set_source_rgb(*INK)
        if u1 > 0:
            ctx.rectangle(0, 463 - 463 * u1, 109, 463 * u1)
        if u2 > 0:
            ctx.rectangle(0, 0, 109 + 243 * u2, 93)
        if u3 > 0:
            ctx.rectangle(0, 182, 109 + 197 * u3, 93)
        ctx.fill()
        ctx.restore()
        if settle >= 1:
            fa.dot(ctx, dx, dy, dr)
        a = e_out(prog(k, 1.6, 0.5))
        if a > 0:
            self.text(ctx, "FOLLOW FOR PART 2", W / 2, 1330, 34, font=MONO, rgb=INK, a=0.75 * a, track=3, shadow=False)
        self.event("logo stroke", t0)
        self.event("logo dot", t0 + 0.78)
        self.event("logo F", tf)

    # ------------------------------------------------------------ overlays
    def credit(self, ctx, t):
        if t > self.Ls[6]:
            return
        ctx.select_font_face(MONO)
        ctx.set_font_size(17)
        ex = ctx.text_extents(CREDIT)
        ctx.set_source_rgba(1, 1, 1, 0.55)
        ctx.move_to(W / 2 - ex.x_advance / 2, 170)
        ctx.show_text(CREDIT)

    def caption(self, ctx, t):
        if t >= self.t_logo - 0.2:
            return
        base.Reel.caption(self, ctx, t)


# ------------------------------------------------------------ sound: an original cinematic score
def ks_pluck(f, dur, sr, decay=0.996, bright=0.5, seed=0):
    """Karplus–Strong string (sitar/tanpura-like with a little buzz)."""
    rng = np.random.default_rng(seed)
    n = int(dur * sr)
    p = max(2, int(sr / f))
    buf = rng.uniform(-1, 1, p)
    out = np.empty(n)
    for i in range(n):
        v = buf[i % p]
        out[i] = v
        buf[i % p] = decay * (bright * v + (1 - bright) * buf[(i + 1) % p])
    return np.tanh(1.6 * out) * 0.8


def build_audio(reel: Reel, out: Path):
    from scipy.signal import butter, lfilter, resample_poly

    SR = 48000
    n = int(reel.T * SR)
    t = np.arange(n) / SR
    rng = np.random.default_rng(11)

    # ---- voice: cleaned up in ffmpeg (rumble cut, gentle comp, presence, de-ess), placed at LEAD
    vtmp = out.parent / "voice_fx.wav"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(reel.work / "voice" / "narration.wav"), "-af",
                    "highpass=f=75,lowpass=f=15000,equalizer=f=220:t=q:w=1.2:g=-1.5,equalizer=f=3200:t=q:w=1.1:g=2.2,"
                    "deesser=i=0.35,acompressor=threshold=-21dB:ratio=3:attack=6:release=90:makeup=2,aresample=48000",
                    "-ac", "1", str(vtmp)], check=True)
    narr, sr = sf.read(str(vtmp), dtype="float64")
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

    def env(L_, a, d):
        tt = np.arange(L_) / SR
        return np.minimum(1, tt / max(a, 1e-4)) * np.exp(-tt / d)

    # ---- tempo + harmony: 92 bpm, D minor  i – VI – VII – v  (Dm  Bb  C  Am)
    bpm = 92
    beat = 60 / bpm
    bar = 4 * beat
    end_music = reel.t_logo + 0.05
    chords = [(146.83, 174.61, 220.0), (116.54, 146.83, 174.61), (130.81, 164.81, 196.0), (110.0, 130.81, 164.81)]
    roots = [73.42, 58.27, 65.41, 55.0]
    music = np.zeros(n)
    perc = np.zeros(n)

    # strings pad: detuned saws through a slow low-pass, crossfaded per bar
    b_lp, a_lp = butter(2, 1400 / (SR / 2))
    nb = int(end_music / bar) + 2
    for b in range(nb):
        st = b * bar
        L_ = int((bar + 0.4) * SR)
        tt = np.arange(L_) / SR
        sig = np.zeros(L_)
        for f in chords[b % 4]:
            for det in (-0.12, 0.0, 0.11):
                ph = (f * (1 + det / 100) * tt + rng.uniform()) % 1.0
                sig += 2 * ph - 1
        sig = lfilter(b_lp, a_lp, sig) / 9
        sig *= np.minimum(1, tt / 0.35) * np.minimum(1, np.maximum(0, (bar + 0.4 - tt)) / 0.4)
        place(music, st, sig, 0.55)

    # tanpura drone: Pa Sa' Sa' Sa (A3 D4 D4 D3) plucked on every beat, long ring
    pat = [110.0, 146.83, 146.83, 73.42]
    plucks = {f: ks_pluck(f, 2.2, SR, 0.9985, 0.5, seed=int(f)) for f in set(pat)}
    k = 0
    tb = 0.0
    while tb < end_music:
        place(music, tb, plucks[pat[k % 4]], 0.16)
        tb += beat
        k += 1

    # tabla (keherwa): dha ge na ti | na ka dhi na — synthesized dayan / bayan strokes, plus a modern sub kick
    def dayan(f=520, g=1.0, dec=0.09):
        L_ = int(0.35 * SR)
        tt = np.arange(L_) / SR
        s = sum(a * np.sin(2 * np.pi * f * m * tt) * np.exp(-tt / (dec / m ** 0.5)) for m, a in ((1, 1), (2, 0.45), (3, 0.25), (4.2, 0.12)))
        s[:int(0.004 * SR)] += rng.uniform(-0.6, 0.6, int(0.004 * SR))
        return g * s

    def bayan(g=1.0):
        L_ = int(0.6 * SR)
        tt = np.arange(L_) / SR
        f = 70 + 45 * np.exp(-tt / 0.08)
        return g * np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt / 0.28)

    def kick():
        L_ = int(0.5 * SR)
        tt = np.arange(L_) / SR
        f = 45 + 90 * np.exp(-tt / 0.025)
        return np.tanh(1.5 * np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt / 0.22))

    strokes = {"dha": lambda: dayan(560) + bayan(0.9), "ge": lambda: bayan(1.0), "na": lambda: dayan(560, 0.9, 0.08),
               "ti": lambda: dayan(820, 0.55, 0.04), "ka": lambda: dayan(380, 0.5, 0.03), "dhi": lambda: dayan(470, 0.8) + bayan(0.8)}
    groove = ["dha", "ge", "na", "ti", "na", "ka", "dhi", "na"]
    cache = {s: strokes[s]() for s in strokes}
    step = beat / 2
    tb = reel.Ls[1] - 4 * step  # tabla enters with a pickup into section 1
    i = 0
    while tb < end_music - 0.1:
        s = groove[i % 8]
        swing = 0.018 if i % 2 else 0.0
        place(perc, tb + swing, cache[s], 0.34 * (1.0 if s in ("dha", "dhi") else 0.8))
        if i % 8 in (0, 5):
            place(perc, tb, kick(), 0.55)
        tb += step
        i += 1
    # shaker on 16ths, soft
    hl = int(0.04 * SR)
    sh = lfilter(*butter(2, [5000 / (SR / 2), 12000 / (SR / 2)], "band"), rng.standard_normal(hl)) * np.exp(-np.arange(hl) / SR / 0.012)
    tb = reel.Ls[1]
    j = 0
    while tb < end_music - 0.1:
        place(perc, tb, sh, 0.22 if j % 2 else 0.12)
        tb += beat / 4
        j += 1

    # bass: root on 1 and the and-of-3
    for b in range(nb):
        for off in (0.0, 2.5 * beat):
            L_ = int(1.1 * beat * SR)
            tt = np.arange(L_) / SR
            seg = np.tanh(1.8 * np.sin(2 * np.pi * roots[b % 4] * tt)) * np.exp(-tt / 0.5) * np.minimum(1, tt / 0.01)
            if b * bar + off >= reel.Ls[1] - 0.05:
                place(music, b * bar + off, seg, 0.38)

    # sitar motif on the hook and under the end card (D F A G | F E D)
    motif = [(0, 293.66), (0.5, 349.23), (1.0, 440.0), (1.5, 392.0), (2.0, 349.23), (2.5, 329.63), (3.0, 293.66)]
    for start in (0.25, reel.Ls[6] + 0.1):
        for off, f in motif:
            place(music, start + off * beat, ks_pluck(f, 1.2, SR, 0.997, 0.55, seed=int(f * 3)), 0.2)

    # ---- sidechain: duck music under the voice with attack / release smoothing
    venv = np.abs(voice)
    w = int(0.03 * SR)
    venv = np.convolve(venv, np.ones(w) / w, mode="same")
    tgt = np.clip(venv / (np.percentile(venv[venv > 1e-4], 60) + 1e-9), 0, 1)
    duck = np.empty(n)
    g = 0.0
    att, rel = 1 - np.exp(-1 / (0.02 * SR)), 1 - np.exp(-1 / (0.35 * SR))
    for ii in range(0, n, 48):  # 1 ms control rate
        x = tgt[ii]
        g += min(1.0, (att if x > g else rel) * 48) * (x - g)
        duck[ii:ii + 48] = g
    music_bus = (music + perc * 0.9) * (1 - 0.62 * duck)
    # swell into the end card, fade under the logo hold
    music_bus *= np.where(t < reel.t_logo, 1.0, np.clip(1 - (t - reel.t_logo) / 1.4, 0, 1))
    music_bus *= np.clip(t / 0.08, 0, 1)

    # ---- sound design from the visual events
    sfx = np.zeros(n)
    noise = rng.standard_normal(int(1.2 * SR))

    def whoosh(at, length=0.4, g=0.5, up=True):
        L_ = int(length * SR)
        seg = noise[:L_].copy()
        fc = np.linspace(400, 6000, L_) if up else np.linspace(5000, 300, L_)
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
        place(sfx, at, np.sin(2 * np.pi * (f * tt + 1400 * tt ** 2)) * env(L_, 0.002, 0.04), g)

    def hit(at, g=0.6):
        L_ = int(1.2 * SR)
        tt = np.arange(L_) / SR
        f = 40 + 55 * np.exp(-tt / 0.05)
        boom = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt / 0.45)
        crash = lfilter(*butter(2, 3000 / (SR / 2), "high"), rng.standard_normal(L_)) * np.exp(-tt / 0.35) * 0.25
        place(sfx, at, np.tanh(1.4 * (boom + crash)), g)

    def riser(at, length=1.2, g=0.3):
        L_ = int(length * SR)
        tt = np.arange(L_) / SR
        f = 200 * (8 ** (tt / length))
        tone = np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.3 + lfilter(*butter(2, 2500 / (SR / 2), "high"), rng.standard_normal(L_)) * 0.5
        place(sfx, at - length, tone * (tt / length) ** 2, g)

    def chime(at, g=0.25):
        for m, f in enumerate((1318.5, 1760.0, 2637.0)):
            L_ = int(1.6 * SR)
            tt = np.arange(L_) / SR
            place(sfx, at + 0.04 * m, np.sin(2 * np.pi * f * tt) * np.exp(-tt / 0.5) * np.minimum(1, tt / 0.003), g / (m + 1))

    hit(0.0, 0.75)
    whoosh(0.05, 0.35, 0.35, up=False)
    for i in (1, 2, 3):
        riser(reel.Ls[i], 0.9, 0.22)
        whoosh(reel.Ls[i], 0.4, 0.5)
        hit(reel.Ls[i] + 0.02, 0.5)
    for e in reel.events:
        nm, at = e["name"], e["t"]
        if nm.startswith(("whip", "stripe", "cut", "look")):
            whoosh(at + 0.12, 0.32, 0.42)
        elif nm.startswith("logo"):
            continue
        elif nm.startswith("crown"):
            chime(at, 0.3)
        else:
            pop(at, 650 + 250 * (sum(map(ord, nm)) % 3), 0.17)
    hit(reel.Ls[5], 0.45)
    whoosh(reel.Ls[6], 0.45, 0.5)
    hit(reel.Ls[6] + 0.02, 0.55)
    # logo: whoosh with the brush stroke, hit on the dot, chime on the F
    riser(reel.t_logo + 0.05, 1.0, 0.25)
    whoosh(reel.t_logo + 0.3, 0.6, 0.6)
    hit(reel.t_logo + 0.78, 0.8)
    chime(reel.t_logo + 1.05, 0.45)

    mix = voice * 1.0 + music_bus * 0.30 + sfx * 0.2
    mix = np.tanh(mix * 1.1) / 1.1
    mix /= np.abs(mix).max() / 0.9
    # a touch of stereo width on music + fx only (voice stays dead centre)
    wide = resample_poly(music_bus * 0.30 + sfx * 0.2, 1, 1)
    d = int(0.012 * SR)
    side = np.concatenate([np.zeros(d), wide[:-d]]) - wide
    Lc = mix + 0.12 * side / (np.abs(mix).max() + 1e-9)
    Rc = mix - 0.12 * side / (np.abs(mix).max() + 1e-9)
    st = np.stack([Lc, Rc], 1)
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
    print("sections:", [round(x, 2) for x in reel.Ls], "logo", round(reel.t_logo, 2), "total", round(reel.T, 2),
          "fifths", [round(x, 2) for x in reel.fifths], "eyes wide", round(reel.eyes_wide, 2))
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
    out = R / "srk_face.mp4"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(R / "video.mp4"), "-i", str(wav), "-map", "0:v", "-map", "1:a", "-c:v", "copy",
                    "-af", "loudnorm=I=-14:TP=-1.5:LRA=9,aresample=48000", "-c:a", "aac", "-b:a", "256k", "-shortest", "-movflags", "+faststart", str(out)],
                   check=True)
    print("done:", out)


if __name__ == "__main__":
    main()
