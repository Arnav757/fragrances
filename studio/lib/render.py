"""pycairo + ffmpeg renderer for vertical reels, following the video-making skill:
one encoded file per scene (identical settings) → concat demuxer with -c copy → audio muxed last with -c:v copy.

A reel is a list of Scene(name, duration, draw) where draw(ctx, t, T) paints frame t (seconds into the scene).
Primitives here draw in the FORMA / "Glowup" series style: Playfair italic captions and titles, IBM Plex Mono
badges with drawn ✓/✗ marks, Syne title cards, measurement lines, before/after tiles with a cursor click,
colour swatches, scan-line transformation wipes.
"""
from __future__ import annotations

import json
import math
import os
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Callable

import cairo
import cv2
import numpy as np

W, H, FPS = 1080, 1920, 30
SERIF, MONO, DISPLAY, SANS = "Playfair Display", "IBM Plex Mono", "Syne", "Inter Tight"
INK, PAPER, ACCENT, OK, BAD = (0.07, 0.07, 0.07), (0.984, 0.98, 0.969), (0.69, 0.314, 0.165), (0.16, 0.62, 0.32), (0.86, 0.2, 0.18)
ENC = ["-c:v", "libx264", "-preset", "medium", "-crf", "17", "-pix_fmt", "yuv420p", "-profile:v", "high", "-r", str(FPS), "-g", str(FPS * 2), "-bf", "2"]

# ---------------------------------------------------------------- easing


def clamp(x: float, a: float = 0.0, b: float = 1.0) -> float:
    return max(a, min(b, x))


def ease_out(x: float) -> float:
    x = clamp(x)
    return 1 - (1 - x) ** 3


def ease_in_out(x: float) -> float:
    x = clamp(x)
    return 4 * x**3 if x < 0.5 else 1 - (-2 * x + 2) ** 3 / 2


def prog(t: float, start: float, dur: float) -> float:
    """0..1 progress of an animation that starts at `start` and lasts `dur` (eased out)."""
    return ease_out((t - start) / dur) if dur > 0 else float(t >= start)


# ---------------------------------------------------------------- images


def cover(img: np.ndarray, w: int = W, h: int = H) -> np.ndarray:
    ih, iw = img.shape[:2]
    s = max(w / iw, h / ih)
    r = cv2.resize(img, (round(iw * s), round(ih * s)), interpolation=cv2.INTER_LANCZOS4)
    y, x = (r.shape[0] - h) // 2, (r.shape[1] - w) // 2
    return r[y : y + h, x : x + w]


class Img:
    """An image fitted to the canvas, kept as a cairo surface.

    fit < 1 shrinks it and anchors it to the bottom centre, extending the backdrop (edge-replicated, then
    softened) to make headroom for titles and badges. map(x, y) converts points measured on the plain
    cover-fitted image (landmarks.json / silhouette.json) into canvas pixels.
    """

    def __init__(self, path: str | Path, grey: bool = False, fit: float = 1.0):
        bgr = cover(cv2.imread(str(path)))
        self.fit, self.ox, self.oy = fit, 0.0, 0.0
        if fit < 1.0:
            small = cv2.resize(bgr, (round(W * fit), round(H * fit)), interpolation=cv2.INTER_AREA)
            self.ox, self.oy = (W - small.shape[1]) / 2, H - small.shape[0]
            l, t = int(self.ox), int(self.oy)
            ext = cv2.copyMakeBorder(small, t, 0, l, W - small.shape[1] - l, cv2.BORDER_REPLICATE)
            soft = cv2.GaussianBlur(ext, (0, 0), 25)
            mask = np.zeros((H, W), np.float32)
            mask[t:, l : l + small.shape[1]] = 1
            mask = cv2.GaussianBlur(mask, (0, 0), 6)[..., None]
            bgr = (ext * mask + soft * (1 - mask)).astype(np.uint8)
            bgr[t + 8 :, l + 8 : l + small.shape[1] - 8] = small[8:, 8:-8]
        if grey:
            g = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
            g = cv2.convertScaleAbs(g, alpha=1.12, beta=-12)
            bgr = cv2.cvtColor(g, cv2.COLOR_GRAY2BGR)
        self.bgr = bgr
        bgra = np.ascontiguousarray(cv2.cvtColor(bgr, cv2.COLOR_BGR2BGRA))
        self._buf = bgra  # keep alive
        self.surface = cairo.ImageSurface.create_for_data(memoryview(bgra), cairo.FORMAT_ARGB32, W, H, bgra.strides[0])

    def map(self, x: float, y: float) -> tuple[float, float]:
        return self.ox + x * self.fit, self.oy + y * self.fit

    def luminance(self, x0: int, y0: int, x1: int, y1: int) -> float:
        return float(cv2.cvtColor(self.bgr[y0:y1, x0:x1], cv2.COLOR_BGR2GRAY).mean() / 255)


def paint(ctx: cairo.Context, img: Img, zoom: float = 1.0, cx: float = W / 2, cy: float = H / 2, alpha: float = 1.0):
    """Draw an image scaled by `zoom` around (cx, cy) — used for slow push-ins."""
    ctx.save()
    ctx.translate(cx, cy)
    ctx.scale(zoom, zoom)
    ctx.translate(-cx, -cy)
    ctx.set_source_surface(img.surface, 0, 0)
    ctx.get_source().set_filter(cairo.FILTER_GOOD)
    ctx.paint_with_alpha(alpha)
    ctx.restore()


def zoom_point(x: float, y: float, zoom: float, cx: float = W / 2, cy: float = H / 2) -> tuple[float, float]:
    """Where an image point lands on screen after paint(..., zoom, cx, cy)."""
    return cx + (x - cx) * zoom, cy + (y - cy) * zoom


def wipe(ctx: cairo.Context, a: Img, b: Img, p: float, zoom: float = 1.0, cx: float = W / 2, cy: float = H / 2):
    """Scan-line transformation: a glowing line sweeps down, revealing `b` behind it with a brief grid shimmer."""
    paint(ctx, a, zoom, cx, cy)
    if p <= 0:
        return
    y = ease_in_out(p) * (H + 120) - 60
    ctx.save()
    ctx.rectangle(0, 0, W, max(0, y))
    ctx.clip()
    paint(ctx, b, zoom, cx, cy)
    ctx.restore()
    if p >= 1:
        return
    # grid band just behind the line
    band = 150
    g = cairo.LinearGradient(0, y - band, 0, y)
    g.add_color_stop_rgba(0, 1, 1, 1, 0)
    g.add_color_stop_rgba(1, 1, 1, 1, 0.22)
    ctx.set_source(g)
    ctx.rectangle(0, y - band, W, band)
    ctx.fill()
    ctx.set_source_rgba(1, 1, 1, 0.35)
    ctx.set_line_width(1)
    for gx in range(0, W, 36):
        ctx.move_to(gx + 0.5, y - band)
        ctx.line_to(gx + 0.5, y)
    for gy in range(int(y - band), int(y), 36):
        ctx.move_to(0, gy + 0.5)
        ctx.line_to(W, gy + 0.5)
    ctx.stroke()
    ctx.set_source_rgba(1, 1, 1, 0.95)
    ctx.set_line_width(4)
    ctx.move_to(0, y)
    ctx.line_to(W, y)
    ctx.stroke()


# ---------------------------------------------------------------- text


def font(ctx: cairo.Context, family: str, size: float, italic: bool = False, bold: bool = False):
    ctx.select_font_face(family, cairo.FONT_SLANT_ITALIC if italic else cairo.FONT_SLANT_NORMAL, cairo.FONT_WEIGHT_BOLD if bold else cairo.FONT_WEIGHT_NORMAL)
    ctx.set_font_size(size)


def text_center(ctx: cairo.Context, s: str, x: float, y: float, rgb=INK, alpha: float = 1.0, shadow: bool = False, tracking: float = 0.0):
    """Draw `s` centred on x with its baseline at y. `tracking` adds letter-spacing in px."""
    ext = ctx.text_extents(s)
    width = ext.x_advance + tracking * max(0, len(s) - 1)
    x0 = x - width / 2
    for dx, dy, col, a in ([(0, 3, (0, 0, 0), 0.35 * alpha)] if shadow else []) + [(0, 0, rgb, alpha)]:
        ctx.set_source_rgba(*col, a)
        if tracking:
            cx = x0 + dx
            for ch in s:
                ctx.move_to(cx, y + dy)
                ctx.show_text(ch)
                cx += ctx.text_extents(ch).x_advance + tracking
        else:
            ctx.move_to(x0 + dx, y + dy)
            ctx.show_text(s)
    return width


def caption(ctx: cairo.Context, s: str, img: Img | None, age: float, y: float = 1665, size: float = 64):
    """Kabir-style spoken-word caption: white Playfair italic with a soft dark glow, readable on any background."""
    if not s:
        return
    a = prog(age, 0, 0.12)
    yy = y + (1 - a) * 10
    font(ctx, SERIF, size, italic=True)
    width = ctx.text_extents(s).x_advance
    x0 = W / 2 - width / 2
    for r, al in ((7, 0.05), (4, 0.07), (2, 0.09)):  # cheap blur: rings of faint offsets
        for k in range(12):
            ang = k * math.pi / 6
            ctx.set_source_rgba(0, 0, 0, al * a)
            ctx.move_to(x0 + r * math.cos(ang), yy + 2 + r * math.sin(ang))
            ctx.show_text(s)
    ctx.set_source_rgba(1, 1, 1, a)
    ctx.move_to(x0, yy)
    ctx.show_text(s)


def title_top(ctx: cairo.Context, s: str, img: Img | None, alpha: float = 1.0, y: float = 150):
    light_bg = img.luminance(200, int(y - 70), 880, int(y + 20)) > 0.55 if img else False
    font(ctx, SERIF, 66, italic=True)
    text_center(ctx, s, W / 2, y, INK if light_bg else (1, 1, 1), alpha=alpha, shadow=not light_bg)


def mono_label(ctx: cairo.Context, s: str, x: float, y: float, rgb=(1, 1, 1), alpha: float = 1.0, size: float = 22):
    font(ctx, MONO, size)
    text_center(ctx, s, x, y, rgb, alpha=alpha, tracking=2)


# ---------------------------------------------------------------- marks, badges, tiles


def rounded(ctx: cairo.Context, x: float, y: float, w: float, h: float, r: float):
    r = min(r, w / 2, h / 2)
    ctx.new_sub_path()
    ctx.arc(x + w - r, y + r, r, -math.pi / 2, 0)
    ctx.arc(x + w - r, y + h - r, r, 0, math.pi / 2)
    ctx.arc(x + r, y + h - r, r, math.pi / 2, math.pi)
    ctx.arc(x + r, y + r, r, math.pi, 3 * math.pi / 2)
    ctx.close_path()


def mark(ctx: cairo.Context, ok: bool, x: float, y: float, r: float = 14, alpha: float = 1.0):
    """Filled green ✓ or red ✗ circle, drawn as paths (Plex Mono has no ✓/✗ glyphs)."""
    ctx.set_source_rgba(*(OK if ok else BAD), alpha)
    ctx.arc(x, y, r, 0, 2 * math.pi)
    ctx.fill()
    ctx.set_source_rgba(1, 1, 1, alpha)
    ctx.set_line_width(r * 0.24)
    ctx.set_line_cap(cairo.LINE_CAP_ROUND)
    ctx.set_line_join(cairo.LINE_JOIN_ROUND)
    if ok:
        ctx.move_to(x - r * 0.45, y + r * 0.02)
        ctx.line_to(x - r * 0.1, y + r * 0.38)
        ctx.line_to(x + r * 0.5, y - r * 0.35)
    else:
        k = r * 0.36
        ctx.move_to(x - k, y - k)
        ctx.line_to(x + k, y + k)
        ctx.move_to(x + k, y - k)
        ctx.line_to(x - k, y + k)
    ctx.stroke()


def badge(ctx: cairo.Context, s: str, state: bool | None, age: float, y: float = 110):
    """White pill with mono caps and an optional ✓/✗, popping in at the top centre."""
    if age < 0:
        return
    a = prog(age, 0, 0.25)
    sc = 0.85 + 0.15 * a
    font(ctx, MONO, 24, bold=True)
    tw = ctx.text_extents(s).x_advance + 2 * (len(s) - 1)
    w = tw + 56 + (40 if state is not None else 0)
    h = 50
    ctx.save()
    ctx.translate(W / 2, y)
    ctx.scale(sc, sc)
    ctx.translate(-W / 2, -y)
    x = W / 2 - w / 2
    rounded(ctx, x, y - h / 2, w, h, h / 2)
    ctx.set_source_rgba(*PAPER, 0.96 * a)
    ctx.fill_preserve()
    ctx.set_source_rgba(0, 0, 0, 0.12 * a)
    ctx.set_line_width(1.5)
    ctx.stroke()
    ctx.set_source_rgba(*INK, a)
    tx = x + 28
    for ch in s:
        ctx.move_to(tx, y + 9)
        ctx.show_text(ch)
        tx += ctx.text_extents(ch).x_advance + 2
    if state is not None:
        mark(ctx, state, x + w - 34, y, 13, a)
    ctx.restore()


def tiles(ctx: cairo.Context, left: tuple[Img, tuple[int, int, int, int], str], right: tuple[Img, tuple[int, int, int, int], str], age: float, click_at: float, y: float = 1330):
    """Two before/after thumbnails with labels; a cursor glides to the right tile and clicks at `click_at`."""
    if age < 0:
        return
    a = prog(age, 0, 0.3)
    size, gap = 170, 26
    for i, (img, crop, label) in enumerate((left, right)):
        x = W / 2 - size - gap / 2 + i * (size + gap)
        yy = y + (1 - a) * 30
        ctx.save()
        rounded(ctx, x, yy, size, size, 22)
        ctx.clip()
        cx0, cy0, cw, ch = crop
        s = size / max(cw, ch)
        ctx.translate(x, yy)
        ctx.scale(s, s)
        ctx.translate(-cx0, -cy0)
        ctx.set_source_surface(img.surface, 0, 0)
        ctx.paint_with_alpha(a)
        ctx.restore()
        chosen = i == 1 and age >= click_at
        rounded(ctx, x, yy, size, size, 22)
        ctx.set_source_rgba(1, 1, 1, a)
        ctx.set_line_width(6 if chosen else 4)
        ctx.stroke()
        mark(ctx, i == 1, x + size / 2, yy + size + 4, 15, a)
        font(ctx, MONO, 19, bold=True)
        lum_ok = True
        text_center(ctx, label, x + size / 2, yy + size + 50, (1, 1, 1) if lum_ok else INK, alpha=a, shadow=True, tracking=1.5)
    # cursor
    if age > 0.25:
        p = prog(age, 0.25, max(0.2, click_at - 0.25))
        tx, ty = W / 2 + gap / 2 + size * 0.62, y + size * 0.62
        sx, sy = W / 2 + 230, y + size + 160
        cx, cy = sx + (tx - sx) * p, sy + (ty - sy) * p
        press = 0.88 if 0 <= age - click_at < 0.12 else 1.0
        cursor(ctx, cx, cy, press)


def cursor(ctx: cairo.Context, x: float, y: float, scale: float = 1.0):
    ctx.save()
    ctx.translate(x, y)
    ctx.scale(1.6 * scale, 1.6 * scale)
    ctx.move_to(0, 0)
    for px, py in [(0, 22), (5.5, 16.5), (9.5, 25), (13, 23.5), (9, 15.5), (16.5, 15.5)]:
        ctx.line_to(px, py)
    ctx.close_path()
    ctx.set_source_rgb(1, 1, 1)
    ctx.fill_preserve()
    ctx.set_source_rgb(0, 0, 0)
    ctx.set_line_width(1.3)
    ctx.stroke()
    ctx.restore()


def measure_line(ctx: cairo.Context, x0: float, x1: float, y: float, p: float, label: str = "", rgb=(1, 1, 1), label_above: bool = True):
    """A dimension line with end ticks that draws outward from the centre; label fades in when complete."""
    if p <= 0:
        return
    cx, half = (x0 + x1) / 2, (x1 - x0) / 2 * p
    ctx.set_source_rgba(*rgb, 0.95)
    ctx.set_line_width(3.5)
    ctx.move_to(cx - half, y)
    ctx.line_to(cx + half, y)
    ctx.stroke()
    for xx in (cx - half, cx + half):
        ctx.move_to(xx, y - 14)
        ctx.line_to(xx, y + 14)
    ctx.stroke()
    if label and p > 0.6:
        a = clamp((p - 0.6) / 0.4)
        font(ctx, MONO, 22, bold=True)
        tw = ctx.text_extents(label).x_advance + 1.5 * len(label)
        ly = y - 38 if label_above else y + 30
        rounded(ctx, cx - tw / 2 - 14, ly - 4, tw + 28, 38, 19)
        ctx.set_source_rgba(0.07, 0.07, 0.07, 0.72 * a)
        ctx.fill()
        text_center(ctx, label, cx, ly + 23, (1, 1, 1), alpha=a, tracking=1.5)


def polyline(ctx: cairo.Context, pts: list[tuple[float, float]], p: float, rgb=(1, 1, 1), width: float = 3, dash: tuple = (14, 10), alpha: float = 0.9):
    """Draw the first fraction `p` of a polyline (by length)."""
    if p <= 0 or len(pts) < 2:
        return
    lens = [math.dist(pts[i], pts[i + 1]) for i in range(len(pts) - 1)]
    remaining = sum(lens) * p
    ctx.set_source_rgba(*rgb, alpha)
    ctx.set_line_width(width)
    ctx.set_dash(list(dash))
    ctx.move_to(*pts[0])
    for i, l in enumerate(lens):
        if remaining <= 0:
            break
        f = min(1, remaining / l)
        ctx.line_to(pts[i][0] + (pts[i + 1][0] - pts[i][0]) * f, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * f)
        remaining -= l
    ctx.stroke()
    ctx.set_dash([])


def scan_grid(ctx: cairo.Context, x: float, y: float, w: float, h: float, p: float, rgb=(1, 1, 1), step: int = 26):
    """Region highlight: a fine grid that sweeps in from the top with a soft tint."""
    if p <= 0:
        return
    hh = h * p
    ctx.save()
    rounded(ctx, x, y, w, hh, 18)
    ctx.clip()
    ctx.set_source_rgba(*rgb, 0.14)
    ctx.paint()
    ctx.set_source_rgba(*rgb, 0.45)
    ctx.set_line_width(1.2)
    for gx in np.arange(x, x + w + 1, step):
        ctx.move_to(gx, y)
        ctx.line_to(gx, y + hh)
    for gy in np.arange(y, y + hh + 1, step):
        ctx.move_to(x, gy)
        ctx.line_to(x + w, gy)
    ctx.stroke()
    ctx.restore()
    rounded(ctx, x, y, w, hh, 18)
    ctx.set_source_rgba(*rgb, 0.9)
    ctx.set_line_width(2.5)
    ctx.stroke()


def swatch_row(ctx: cairo.Context, items: list[tuple[str, str, float]], ok: bool, y: float, crossed: float = 0.0, size: int = 150):
    """items: (name, hex, age). Each pops in at its own time; `crossed` (0..1) strikes the row out."""
    gap = 22
    n = len(items)
    total = n * size + (n - 1) * gap
    for i, (name, hx, age) in enumerate(items):
        if age < 0:
            continue
        a = prog(age, 0, 0.25)
        x = W / 2 - total / 2 + i * (size + gap)
        yy = y + (1 - a) * 24
        r, g, b = (int(hx[k : k + 2], 16) / 255 for k in (1, 3, 5))
        rounded(ctx, x, yy, size, size, 22)
        ctx.set_source_rgba(r, g, b, a)
        ctx.fill_preserve()
        ctx.set_source_rgba(1, 1, 1, 0.9 * a)
        ctx.set_line_width(3)
        ctx.stroke()
        mark(ctx, ok, x + size - 6, yy + 6, 17, a)
        font(ctx, MONO, 24, bold=True)
        text_center(ctx, name.upper(), x + size / 2, yy + size + 40, (1, 1, 1), alpha=a, shadow=True, tracking=1.5)
        if crossed > 0 and not ok:
            ctx.set_source_rgba(*BAD, 0.95)
            ctx.set_line_width(6)
            ctx.move_to(x + 14, yy + size - 14)
            ctx.line_to(x + 14 + (size - 28) * crossed, yy + size - 14 - (size - 28) * crossed)
            ctx.stroke()


def title_card(ctx: cairo.Context, img: Img, small: str, big: str, age: float, zoom: float = 1.04):
    """Black-and-white still with a small mono label and a big Syne word (Kabir's 'SECOND / HAIRSTYLE')."""
    paint(ctx, img, zoom)
    g = cairo.LinearGradient(0, 0, 0, 700)
    g.add_color_stop_rgba(0, 0, 0, 0, 0.55)
    g.add_color_stop_rgba(1, 0, 0, 0, 0)
    ctx.set_source(g)
    ctx.rectangle(0, 0, W, 700)
    ctx.fill()
    a1, a2 = prog(age, 0, 0.25), prog(age, 0.12, 0.35)
    mono_label(ctx, small, W / 2, 205, (1, 1, 1), alpha=a1, size=26)
    font(ctx, DISPLAY, 132, bold=True)
    text_center(ctx, big, W / 2, 330 + (1 - a2) * 24, (1, 1, 1), alpha=a2, shadow=True, tracking=4)


def logo_mark(ctx: cairo.Context, x: float, y: float, s: float = 58, light: bool = False):
    """FORMA mark: rounded square, 'F' stroke, terracotta dot."""
    ctx.save()
    ctx.translate(x, y)
    ctx.scale(s / 28, s / 28)
    rounded(ctx, 1, 1, 26, 26, 7)
    ctx.set_source_rgb(*(PAPER if light else INK))
    ctx.fill()
    ctx.set_source_rgb(*(INK if light else PAPER))
    ctx.set_line_width(2.6)
    ctx.set_line_cap(cairo.LINE_CAP_ROUND)
    ctx.set_line_join(cairo.LINE_JOIN_ROUND)
    ctx.move_to(9, 20)
    ctx.line_to(9, 8)
    ctx.line_to(19, 8)
    ctx.move_to(9, 14)
    ctx.line_to(16, 14)
    ctx.stroke()
    ctx.set_source_rgb(*ACCENT)
    ctx.arc(20, 19.5, 1.9, 0, 2 * math.pi)
    ctx.fill()
    ctx.restore()


# ---------------------------------------------------------------- captions from word timestamps


def caption_chunks(words: list[dict], offset: float, max_words: int = 3, max_gap: float = 0.35) -> list[tuple[float, float, str]]:
    """Group timed words into short spoken-phrase captions (≤ max_words, split at punctuation and pauses)."""
    out, cur = [], []
    for i, w in enumerate(words):
        cur.append(w)
        nxt = words[i + 1] if i + 1 < len(words) else None
        end_punct = w["word"].rstrip().endswith((".", ",", "?", "!", ":"))
        long_gap = nxt is not None and nxt["start"] - w["end"] > max_gap
        if len(cur) >= max_words or end_punct or long_gap or nxt is None:
            start = cur[0]["start"] + offset
            end = (nxt["start"] + offset) if nxt is not None and not long_gap else cur[-1]["end"] + offset + 0.25
            out.append((start, end, " ".join(x["word"].strip() for x in cur)))
            cur = []
    return out


def caption_at(chunks: list[tuple[float, float, str]], t: float) -> tuple[str, float]:
    for s, e, txt in chunks:
        if s <= t < e:
            return txt, t - s
    return "", 0.0


# ---------------------------------------------------------------- encode


@dataclass
class Scene:
    name: str
    start: float  # absolute reel time (s), used for captions and word anchors
    duration: float
    draw: Callable[[cairo.Context, float, float], None]


def render_scene(scene: Scene, out_dir: Path, only_frames: list[float] | None = None) -> Path:
    """Encode one scene to out_dir/NN_name.mp4 via a temp name, renamed only if ffmpeg exits 0."""
    out_dir.mkdir(parents=True, exist_ok=True)
    final = out_dir / f"{scene.name}.mp4"
    tmp = out_dir / f".{scene.name}.tmp.mp4"
    n = max(1, round(scene.duration * FPS))
    surf = cairo.ImageSurface(cairo.FORMAT_ARGB32, W, H)
    if only_frames is not None:
        for t in only_frames:
            draw_frame(scene, surf, t)
            surf.write_to_png(str(out_dir / f"{scene.name}@{t:.2f}.png"))
        return final
    proc = subprocess.Popen(
        ["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgra", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-", *ENC, "-an", str(tmp)],
        stdin=subprocess.PIPE,
    )
    assert proc.stdin
    for i in range(n):
        draw_frame(scene, surf, i / FPS)
        proc.stdin.write(bytes(surf.get_data()))
    proc.stdin.close()
    if proc.wait() != 0:
        tmp.unlink(missing_ok=True)
        raise RuntimeError(f"ffmpeg failed on scene {scene.name}")
    tmp.rename(final)
    return final


def draw_frame(scene: Scene, surf: cairo.ImageSurface, t: float):
    ctx = cairo.Context(surf)
    ctx.set_source_rgb(0, 0, 0)
    ctx.paint()
    scene.draw(ctx, t, scene.duration)
    surf.flush()


def join(scene_files: list[Path], audio: Path | None, out: Path, loudness: float = -14.0):
    """Concat scene files without re-encoding, then add loudness-normalised audio with -c:v copy."""
    lst = out.with_suffix(".concat.txt")
    lst.write_text("".join(f"file '{f.resolve()}'\n" for f in scene_files))
    silent = out.with_name(out.stem + ".video.mp4")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", str(lst), "-c", "copy", str(silent)], check=True)
    if audio is None:
        silent.rename(out)
        return
    tmp = out.with_name("." + out.name)
    subprocess.run(
        ["ffmpeg", "-v", "error", "-y", "-i", str(silent), "-i", str(audio), "-map", "0:v", "-map", "1:a", "-c:v", "copy",
         "-af", f"loudnorm=I={loudness}:TP=-1.5:LRA=7,aresample=48000", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", str(tmp)],
        check=True,
    )
    tmp.rename(out)


def words_json(path: Path) -> list[dict]:
    return json.loads(path.read_text())


def find_word(words: list[dict], token: str, nth: int = 1, after: float = -1) -> float:
    """Start time of the nth occurrence of `token` (case/punctuation-insensitive) after `after`."""
    norm = lambda s: "".join(ch for ch in s.lower() if ch.isalnum())  # noqa: E731
    k = 0
    for w in words:
        if w["start"] > after and norm(w["word"]) == norm(token):
            k += 1
            if k == nth:
                return w["start"]
    raise KeyError(f"word {token!r} #{nth} not found")


if os.environ.get("STUDIO_DEBUG"):
    print("render.py loaded", W, H, FPS)
