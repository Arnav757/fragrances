"""Scimplify — MREO process film: Gemini footage + stage graphics in the logo's periodic-tile style + end card.

    python studio/reels/scimplify_mreo.py studio/work/scimplify            # → render/scimplify_mreo.mp4
    python studio/reels/scimplify_mreo.py studio/work/scimplify --stills 1 4 9 19.6 21 23

<work>/in/src.mp4 (1280x720, 24 fps, 20 s), logo_color.png / logo_white.png (cut from the supplied logo),
wm_mask.png (Gemini sparkle mask at 720p). Output 1920x1080, 24 fps.
"""
import argparse
import math
import subprocess
import sys
from pathlib import Path

import cairo
import cv2
import numpy as np

W, H, FPS = 1920, 1080, 24
SRC_END = 20.0
TOTAL = 23.5
TEAL = (0x03 / 255, 0xBE / 255, 0xA9 / 255)
DEEP = (0x00 / 255, 0x5F / 255, 0x59 / 255)
BG = (0xF7 / 255, 0xF7 / 255, 0xF7 / 255)
INK = (0x1B / 255, 0x2A / 255, 0x2E / 255)
FONT = "Inter Tight"

# cuts measured from the footage (frame differences)
STAGES = [
    (0.0, "In", "Concentrate inspection", "Rare-earth mineral concentrate"),
    (3.167, "Le", "Leaching", "Hydrometallurgical dissolution"),
    (6.083, "Sp", "Solid–liquid separation", "Filtering the leach slurry"),
    (10.0, "Pu", "Purification", "Removing impurities from the solution"),
    (13.167, "Pr", "Precipitation", "Mixed rare-earth compounds collected"),
    (14.458, "Dr", "Drying", "Moisture driven off the precipitate"),
    (16.0, "Ca", "Calcination", "Converted to oxide"),
    (17.917, "Ox", "MREO", "Mixed Rare Earth Oxide"),
]
CUTS = [s[0] for s in STAGES[1:]]


def clamp(x, a=0.0, b=1.0):
    return max(a, min(b, x))


def prog(t, t0, d):
    return clamp((t - t0) / d) if d > 0 else float(t >= t0)


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


_KEEP = []


def surf(bgra):
    a = bgra[..., 3:4].astype(np.float32) / 255
    pm = bgra.astype(np.float32)
    pm[..., :3] *= a
    arr = np.ascontiguousarray(pm.astype(np.uint8))
    _KEEP.append(arr)
    return cairo.ImageSurface.create_for_data(memoryview(arr), cairo.FORMAT_ARGB32, arr.shape[1], arr.shape[0], arr.strides[0])


def teal_gradient(x0, y0, x1, y1, a=1.0):
    g = cairo.LinearGradient(x0, y0, x1, y1)
    g.add_color_stop_rgba(0, *TEAL, a)
    g.add_color_stop_rgba(1, *DEEP, a)
    return g


class Film:
    def __init__(self, work: Path):
        self.work = work
        self.cap = cv2.VideoCapture(str(work / "in" / "src.mp4"))
        self.src_fps = self.cap.get(cv2.CAP_PROP_FPS)
        self.idx, self.cur = -1, None
        m = cv2.imread(str(work / "wm_mask.png"), 0)
        cnts, _ = cv2.findContours((m > 0).astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        hull = np.zeros_like(m)
        cv2.fillPoly(hull, [cv2.convexHull(np.vstack(cnts))], 255)
        self.wm = cv2.dilate(hull, np.ones((9, 9), np.uint8))
        self.white = cv2.imread(str(work / "logo_white.png"), cv2.IMREAD_UNCHANGED)
        self.color = cv2.imread(str(work / "logo_color.png"), cv2.IMREAD_UNCHANGED)
        self.bug = surf(cv2.resize(self.white, (270, round(270 * self.white.shape[0] / self.white.shape[1])), interpolation=cv2.INTER_AREA))
        self._endcard_parts()
        yy, xx = np.mgrid[0:H, 0:W]
        r = np.hypot((xx - W / 2) / (W / 2), (yy - H / 2) / (H / 2))
        self.vignette = (1 - 0.22 * np.clip(r - 0.55, 0, 1) ** 1.5)[..., None].astype(np.float32)

    # ------------------------------------------------------------ footage
    def frame(self, t):
        i = min(int(round(t * self.src_fps)), int(SRC_END * self.src_fps) - 1)
        while self.idx < i:
            ok, f = self.cap.read()
            if not ok:
                break
            self.idx += 1
            self.cur = f
        f = cv2.inpaint(self.cur, self.wm, 6, cv2.INPAINT_TELEA)
        f = cv2.resize(f, (W, H), interpolation=cv2.INTER_LANCZOS4)
        blur = cv2.GaussianBlur(f, (0, 0), 1.2)
        f = cv2.addWeighted(f, 1.35, blur, -0.35, 0)  # gentle sharpen after the upscale
        f = (f.astype(np.float32) * self.vignette).clip(0, 255).astype(np.uint8)
        return f

    # ------------------------------------------------------------ end-card logo, split into parts for animation
    def _endcard_parts(self):
        c = self.color
        h, w = c.shape[:2]
        a = c[..., 3]
        # box stroke band (logo-crop coordinates): outer square 6..382, stroke ~26 px, open on the right
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

        def part(m):
            p = c.copy()
            p[..., 3] = np.where(m, a, 0)
            return p

        self.parts = {k: part(m) for k, m in (("box", band > 0), ("nums", nums > 0), ("reg", reg > 0), ("word", word))}
        self.logo_size = (w, h)
        # centre-line of the box stroke, drawn from the top-right stub round to the bottom-right stub
        self.box_path = [(369, 73), (369, 18), (19, 18), (19, 369), (369, 369), (369, 323)]

    # ------------------------------------------------------------ overlays
    def stage_at(self, t):
        k = 0
        for i, s in enumerate(STAGES):
            if t >= s[0]:
                k = i
        return k

    def tile(self, ctx, t):
        """Periodic-table tile (number, symbol) + stage name, rolling to the next stage on each cut."""
        appear = e_out(prog(t, 0.35, 0.6))
        leave = e_io(prog(t, 19.15, 0.4))
        a = appear * (1 - leave)
        if a <= 0:
            return
        x, y, s = 96, 812, 156
        # legibility gradient
        g = cairo.LinearGradient(0, 640, 0, H)
        g.add_color_stop_rgba(0, 0, 0, 0, 0)
        g.add_color_stop_rgba(1, 0, 0, 0, 0.55 * a)
        ctx.set_source(g)
        ctx.rectangle(0, 640, W, H - 640)
        ctx.fill()
        # tile: translucent dark fill, teal gradient frame that draws on
        ctx.save()
        ctx.rectangle(x, y, s, s)
        ctx.set_source_rgba(0.02, 0.08, 0.09, 0.55 * a)
        ctx.fill()
        per = 4 * s
        drawn = per * e_out(prog(t, 0.35, 0.9))
        pts = [(x + s, y + s * 0.3), (x + s, y), (x, y), (x, y + s), (x + s, y + s), (x + s, y + s * 0.7)]
        ctx.set_source(teal_gradient(x, y, x + s, y + s, a))
        ctx.set_line_width(7)
        ctx.set_line_cap(cairo.LINE_CAP_SQUARE)
        ctx.move_to(*pts[0])
        rem = drawn
        for p0, p1 in zip(pts, pts[1:]):
            d = math.dist(p0, p1)
            if rem <= 0:
                break
            u = min(1, rem / d)
            ctx.line_to(lerp(p0[0], p1[0], u), lerp(p0[1], p1[1], u))
            rem -= d
        ctx.stroke()
        ctx.restore()
        k = self.stage_at(t)
        # roll: the previous stage slides up and out as the new one slides in (0.35 s, starting at the cut)
        t_cut = STAGES[k][0]
        r = e_out(prog(t, t_cut, 0.38)) if k > 0 else 1.0
        for idx, off in ((k - 1, -1.0 + 0 * r), (k, 0.0)):
            if idx < 0 or (idx == k - 1 and r >= 1):
                continue
            shift = (r - 1) if idx == k else r  # new: from +1 → 0; old: 0 → -1
            dy_tile = -shift * 60 if idx == k else -shift * 60
            dy = (1 - r) * 60 if idx == k else -r * 60
            alpha = a * (r if idx == k else 1 - r)
            num, sym, name, sub = STAGES[idx][0], STAGES[idx][1], STAGES[idx][2], STAGES[idx][3]
            # inside the tile (clipped)
            ctx.save()
            ctx.rectangle(x + 4, y + 4, s - 8, s - 8)
            ctx.clip()
            ctx.select_font_face(FONT, cairo.FONT_SLANT_NORMAL, cairo.FONT_WEIGHT_BOLD)
            ctx.set_font_size(22)
            ctx.set_source_rgba(*TEAL, alpha)
            ctx.move_to(x + 16, y + 34 + dy)
            ctx.show_text(f"{idx + 1:02d}")
            ctx.set_font_size(74)
            ex = ctx.text_extents(sym)
            ctx.set_source_rgba(1, 1, 1, alpha)
            ctx.move_to(x + s / 2 - ex.x_advance / 2, y + s / 2 + 38 + dy)
            ctx.show_text(sym)
            ctx.restore()
            # name + subline (clipped to their own band)
            ctx.save()
            ctx.rectangle(x + s + 30, y - 10, 1200, s + 20)
            ctx.clip()
            ctx.select_font_face(FONT, cairo.FONT_SLANT_NORMAL, cairo.FONT_WEIGHT_BOLD)
            ctx.set_font_size(52)
            ctx.set_source_rgba(1, 1, 1, alpha)
            ctx.move_to(x + s + 34, y + 78 + dy)
            ctx.show_text(name)
            ctx.select_font_face(FONT, cairo.FONT_SLANT_NORMAL, cairo.FONT_WEIGHT_NORMAL)
            ctx.set_font_size(27)
            ctx.set_source_rgba(1, 1, 1, 0.82 * alpha)
            ctx.move_to(x + s + 36, y + 124 + dy)
            ctx.show_text(sub)
            ctx.restore()
        # progress: 8 segments under the text
        px, py, seg, gap = x + s + 36, y + s - 4, 46, 8
        for i in range(len(STAGES)):
            fill = 1.0 if i < k else (e_out(prog(t, STAGES[i][0], 0.5)) if i == k else 0.0)
            ctx.set_source_rgba(1, 1, 1, 0.28 * a)
            ctx.rectangle(px + i * (seg + gap), py, seg, 4)
            ctx.fill()
            if fill > 0:
                ctx.set_source_rgba(*TEAL, a)
                ctx.rectangle(px + i * (seg + gap), py, seg * fill, 4)
                ctx.fill()

    def title(self, ctx, t):
        """Opening title, top-left: MREO / the process, from concentrate to oxide."""
        a = e_out(prog(t, 0.15, 0.6)) * (1 - e_io(prog(t, 2.45, 0.5)))
        if a <= 0:
            return
        x, y = 96, 150
        g = cairo.LinearGradient(0, 0, 0, 420)
        g.add_color_stop_rgba(0, 0, 0, 0, 0.5 * a)
        g.add_color_stop_rgba(1, 0, 0, 0, 0)
        ctx.set_source(g)
        ctx.rectangle(0, 0, W, 420)
        ctx.fill()
        ctx.set_source(teal_gradient(x, y, x + 160, y, a))
        ctx.rectangle(x, y - 40, 160 * e_out(prog(t, 0.15, 0.7)), 6)
        ctx.fill()
        for txt, size, weight, dy, d0, al in (
            ("MREO", 96, cairo.FONT_WEIGHT_BOLD, 66, 0.25, 1.0),
            ("Mixed Rare Earth Oxide, from concentrate to powder", 30, cairo.FONT_WEIGHT_NORMAL, 118, 0.4, 0.85),
        ):
            u = e_out(prog(t, d0, 0.55))
            ctx.save()
            ctx.rectangle(x - 5, y + dy - size, 1400, size * 1.3)
            ctx.clip()
            ctx.select_font_face(FONT, cairo.FONT_SLANT_NORMAL, weight)
            ctx.set_font_size(size)
            ctx.set_source_rgba(1, 1, 1, a * al)
            ctx.move_to(x, y + dy + (1 - u) * size)
            ctx.show_text(txt)
            ctx.restore()

    def watermark_bug(self, ctx, t):
        a = 0.92 * (1 - e_io(prog(t, 19.15, 0.4)))
        if a <= 0:
            return
        bw, bh = self.bug.get_width(), self.bug.get_height()
        x, y = 1660 - 10, 858  # sits over the inpainted sparkle (1704–1776, 864–936 at 1080p)
        ctx.save()
        ctx.set_source_surface(self.bug, x + 2, y + 3)  # soft shadow
        ctx.paint_with_alpha(0.25 * a)
        ctx.restore()
        ctx.set_source_rgba(0, 0, 0, 0.22 * a)
        ctx.mask_surface(self.bug, x + 1, y + 2)
        ctx.set_source_surface(self.bug, x, y)
        ctx.paint_with_alpha(a)

    def wipe_to_card(self, ctx, t):
        """A white disc opens from the sample container into the end card's background."""
        u = e_io(prog(t, 19.25, 0.75))
        if u <= 0:
            return
        cx, cy = 1180, 620
        r = u * math.hypot(W, H)
        ctx.arc(cx, cy, r, 0, 2 * math.pi)
        ctx.set_source_rgb(*BG)
        ctx.fill()
        if u < 1:  # teal ring on the leading edge
            ctx.arc(cx, cy, r, 0, 2 * math.pi)
            ctx.set_source(teal_gradient(cx - r, cy - r, cx + r, cy + r))
            ctx.set_line_width(10)
            ctx.stroke()

    def end_card(self, ctx, t):
        k = t - SRC_END
        ctx.set_source_rgb(*BG)
        ctx.paint()
        lw, lh = self.logo_size
        sc = 1080 / lw
        sc *= 1 + 0.025 * e_out(prog(k, 0, 3.5))  # slow push
        ox, oy = W / 2 - lw * sc / 2, H / 2 - lh * sc / 2 - 30
        def draw_part(name, mask_fn):
            p = self.parts[name].copy()
            if mask_fn is not None:
                m = mask_fn()
                p[..., 3] = (p[..., 3].astype(np.float32) * m).astype(np.uint8)
            s = surf(p)
            ctx.save()
            ctx.translate(ox, oy)
            ctx.scale(sc, sc)
            ctx.set_source_surface(s, 0, 0)
            ctx.get_source().set_filter(cairo.FILTER_GOOD)
            ctx.paint()
            ctx.restore()
            _KEEP.pop()
        # 1. box strokes on along its path
        pb = e_io(prog(k, 0.0, 0.9))
        if pb > 0:
            def box_mask():
                m = np.zeros((lh, lw), np.uint8)
                L = sum(math.dist(a, b) for a, b in zip(self.box_path, self.box_path[1:]))
                rem = L * pb
                pts = [self.box_path[0]]
                for p0, p1 in zip(self.box_path, self.box_path[1:]):
                    d = math.dist(p0, p1)
                    u = min(1, rem / d)
                    pts.append((lerp(p0[0], p1[0], u), lerp(p0[1], p1[1], u)))
                    rem -= d
                    if rem <= 0:
                        break
                cv2.polylines(m, [np.array(pts, np.int32)], False, 255, 44)
                return m.astype(np.float32) / 255
            draw_part("box", box_mask if pb < 1 else None)
        # 2. atomic numbers fade in
        pn = e_out(prog(k, 0.55, 0.4))
        if pn > 0:
            draw_part("nums", (lambda: np.full((lh, lw), pn, np.float32)) if pn < 1 else None)
        # 3. wordmark wipes in left to right with a soft edge
        pw = e_io(prog(k, 0.45, 0.85))
        if pw > 0:
            def word_mask():
                xs = np.arange(lw, dtype=np.float32)
                edge = lerp(-80, lw + 80, pw)
                row = np.clip((edge - xs) / 80, 0, 1)
                return np.repeat(row[None, :], lh, 0)
            draw_part("word", word_mask if pw < 1 else None)
        # 4. ® pops
        pr = e_out(prog(k, 1.25, 0.3))
        if pr > 0:
            draw_part("reg", (lambda: np.full((lh, lw), pr, np.float32)) if pr < 1 else None)
        # 5. descriptor line
        pd = e_out(prog(k, 1.5, 0.5))
        if pd > 0:
            ctx.select_font_face(FONT, cairo.FONT_SLANT_NORMAL, cairo.FONT_WEIGHT_NORMAL)
            ctx.set_font_size(30)
            txt = "Mixed Rare Earth Oxide  ·  MREO"
            ex = ctx.text_extents(txt)
            ctx.set_source_rgba(*INK, 0.75 * pd)
            ctx.move_to(W / 2 - ex.x_advance / 2, oy + lh * sc + 90 + (1 - pd) * 14)
            ctx.show_text(txt)

    # ------------------------------------------------------------ compose
    def compose(self, t):
        s = cairo.ImageSurface(cairo.FORMAT_ARGB32, W, H)
        ctx = cairo.Context(s)
        if t < SRC_END:
            f = cv2.cvtColor(self.frame(t), cv2.COLOR_BGR2BGRA)
            buf = np.ndarray((H, W, 4), np.uint8, s.get_data(), strides=(s.get_stride(), 4, 1))
            buf[:] = f
            s.mark_dirty()
            self.title(ctx, t)
            self.tile(ctx, t)
            self.watermark_bug(ctx, t)
            self.wipe_to_card(ctx, t)
        else:
            self.end_card(ctx, t)
        s.flush()
        return s


def render(work: Path, out: Path, t0: float, t1: float, film: Film):
    tmp = out.with_name("." + out.name)
    p = subprocess.Popen(
        ["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgra", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
         "-c:v", "libx264", "-preset", "medium", "-crf", "16", "-pix_fmt", "yuv420p", "-r", str(FPS), "-g", str(FPS * 2), "-an", str(tmp)],
        stdin=subprocess.PIPE,
    )
    n0, n1 = round(t0 * FPS), round(t1 * FPS)
    for i in range(n0, n1):
        p.stdin.write(bytes(film.compose(i / FPS).get_data()))
    p.stdin.close()
    if p.wait() != 0:
        raise RuntimeError("ffmpeg failed")
    tmp.rename(out)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("work", type=Path)
    ap.add_argument("--stills", nargs="*", type=float)
    a = ap.parse_args()
    R = a.work / "render"
    R.mkdir(exist_ok=True)
    if a.stills is not None:
        for t in sorted(a.stills):
            Film(a.work).compose(t).write_to_png(str(R / f"still_{t:05.2f}.png"))
        return
    film = Film(a.work)
    render(a.work, R / "s1_film.mp4", 0, SRC_END, film)
    render(a.work, R / "s2_card.mp4", SRC_END, TOTAL, film)
    (R / "list.txt").write_text(f"file '{(R / 's1_film.mp4').resolve()}'\nfile '{(R / 's2_card.mp4').resolve()}'\n")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", str(R / "list.txt"), "-c", "copy", str(R / "video.mp4")], check=True)
    print("video:", R / "video.mp4")


if __name__ == "__main__":
    main()
