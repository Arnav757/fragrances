"""Arjun's Outfit Glowup — timeline. Every scene boundary and animation is anchored to a spoken word.

    python studio/reels/arjun_outfit.py studio/work/arjun            # full render
    python studio/reels/arjun_outfit.py studio/work/arjun --stills   # key frames only, for checking
    python studio/reels/arjun_outfit.py studio/work/arjun --only s07_balance_problem

Inputs in <work>: assets/*.png, voice/narration.wav, voice/words.json, silhouette.json, landmarks.json.
"""
import argparse
import json
import subprocess
import sys
from pathlib import Path

import numpy as np
import soundfile as sf

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "lib"))
from render import (  # noqa: E402
    INK, PAPER, W, H, Img, Scene, badge, caption, caption_at, caption_chunks, clamp, find_word, font, join, logo_mark,
    measure_line, mono_label, paint, polyline, prog, render_scene, scan_grid, swatch_row, text_center, tiles, title_card,
    title_top, wipe, zoom_point, ACCENT,
)

HOOK, ENDCARD, LEAD_PAD = 0.9, 2.8, 0.2
# How long before its word each scan-line wipe starts, so the line reaches the garment on the word.
# (The top of each before/after pair is identical — backdrop and head — so the visible change is on the clothes.)
WIPE_LEAD = {"fit": 0.47, "balance": 0.6, "colour": 0.43}
LEAD = HOOK + LEAD_PAD  # narration starts here in the final reel
TITLE = "Arjun’s Outfit Glowup"


def build(work: Path):
    A = work / "assets"
    FULL = 0.86  # full-body shots: shrink + bottom-anchor for headroom (titles, badges) like Kabir's framing
    full = ["img1_before", "img2_fit", "img3_balance", "img5_after_studio"]
    img = {k: Img(A / f"{k}.png", fit=FULL if k in full else 1.0) for k in full + ["img1b_pulling_closeup", "img4a_black", "img4b_olive", "img6_after_cafe"]}
    grey = {k: Img(A / f"{k}.png", grey=True, fit=0.78) for k in ["img1_before", "img2_fit", "img3_balance"]}
    sil = json.loads((work / "silhouette.json").read_text())
    lmk = json.loads((work / "landmarks.json").read_text())
    words = json.loads((work / "voice" / "words.json").read_text())
    narr_len = sf.info(str(work / "voice" / "narration.wav")).duration
    chunks = caption_chunks(words, LEAD)

    def w(token: str, nth: int = 1, alts: tuple = (), after: float = -1) -> float:
        for tok in (token, *alts):
            try:
                return find_word(words, tok, nth, after - LEAD if after >= 0 else -1) + LEAD
            except KeyError:
                continue
        raise KeyError(token)

    CUT = 0.08  # cut a touch before the word lands
    b = {
        "intro": HOOK,
        "diag": w("He's", alts=("Hes", "He")) - CUT,
        "t_fit": w("First") - CUT,
        "fit_problem": w("Regular") - CUT,
        "fit_fix": w("Go") - CUT,
        "t_trousers": w("Second") - CUT,
        "bal_problem": w("Skinny") - CUT,
        "bal_fix": w("Straight-leg", alts=("Straight", "Straightleg")) - CUT,
    }
    b |= {"t_colour": w("And", after=b["bal_fix"]) - CUT}
    b |= {
        "col_problem": w("Arjun", after=b["t_colour"]) - CUT,
        "col_fix": w("Olive") - 0.4,
        "payoff": w("Same") - CUT,
        "end": LEAD + narr_len + 0.5,
    }
    b = {k: round(v * 30) / 30 for k, v in b.items()}  # frame-aligned scene boundaries: zero cumulative drift
    order = list(b)
    for x, y in zip(order, order[1:]):
        assert b[y] - b[x] > 0.5, f"scene order broken: {x}={b[x]:.2f} → {y}={b[y]:.2f}"
    T_END = round((b["end"] + ENDCARD) * 30) / 30

    def cap(ctx, t_abs, im):
        txt, age = caption_at(chunks, t_abs)
        caption(ctx, txt, im, age)

    def brand(ctx):
        logo_mark(ctx, 36, 226, 58)

    # ------------------------------------------------------------ geometry helpers
    def rows(k):
        return sil[k]

    def full_zoom(t, T, z0=1.0, z1=1.05):
        return z0 + (z1 - z0) * clamp(t / max(T, 0.01))

    ZC = (W / 2, 1000)

    def zp(x, y, z, k="img1_before"):
        """Point measured on the cover-fitted image k → canvas, including the image's fit and the zoom."""
        return zoom_point(*img[k].map(x, y), z, *ZC)

    # ------------------------------------------------------------ scenes
    scenes = []

    def add(name, start, end, fn):
        scenes.append(Scene(name, start, end - start, lambda ctx, t, T, s=start: fn(ctx, t, T, s + t)))

    # S0 hook: the payoff first
    def hook(ctx, t, T, ta):
        paint(ctx, img["img6_after_cafe"], 1.06 - 0.02 * t / T, W / 2, 760)
        g = __import__("cairo").LinearGradient(0, 0, 0, 900)
        g.add_color_stop_rgba(0, 0, 0, 0, 0.6)
        g.add_color_stop_rgba(1, 0, 0, 0, 0)
        ctx.set_source(g)
        ctx.rectangle(0, 0, W, 900)
        ctx.fill()
        font(ctx, "Playfair Display", 150, italic=True)
        text_center(ctx, "Same guy.", W / 2, 420, (1, 1, 1), shadow=True)
        font(ctx, "Inter Tight", 60, bold=True)
        text_center(ctx, "3 outfit fixes. Watch.", W / 2, 520, (1, 1, 1), shadow=True)
        badge(ctx, "AFTER", None, 1.0, y=1640)

    add("s00_hook", 0, HOOK, hook)

    # S1 intro: before, slow push-in, series title
    def intro(ctx, t, T, ta):
        z = full_zoom(ta - b["intro"], b["t_fit"] - b["intro"])
        im = img["img1_before"]
        paint(ctx, im, z, *ZC)
        title_top(ctx, TITLE, im, alpha=prog(t, 0, 0.4))
        mono_label(ctx, "ARJUN, AI-GENERATED CHARACTER", W / 2, 205, INK, alpha=0.6 * prog(t, 0.2, 0.4), size=19)
        brand(ctx)
        cap(ctx, ta, im)

    add("s01_intro", b["intro"], b["diag"], intro)

    # S2 diagnosis: real shoulder/waist widths from the body outline, then the inverted-triangle outline
    def diag(ctx, t, T, ta):
        z = full_zoom(ta - b["intro"], b["t_fit"] - b["intro"])
        im = img["img1_before"]
        paint(ctx, im, z, *ZC)
        r = rows("img1_before")
        sx0, sx1, _ = r["shoulder"]
        wx0, wx1, _ = r["waist"]
        sy, wy = r["rows"]["shoulder"], r["rows"]["waist"]
        a0, a1 = zp(sx0, sy, z), zp(sx1, sy, z)
        b0, b1 = zp(wx0, wy, z), zp(wx1, wy, z)
        t_sh, t_wa, t_tri = w("broad") - ta + t, w("narrow") - ta + t, w("inverted") - ta + t
        measure_line(ctx, a0[0], a1[0], a0[1], prog(t, t_sh, 0.45), "SHOULDERS")
        measure_line(ctx, b0[0], b1[0], b0[1], prog(t, t_wa, 0.45), "WAIST", label_above=False)
        crotch = zp((wx0 + wx1) / 2, rows("img1_before")["rows"]["waist"] + 170, z)
        polyline(ctx, [a0, crotch, a1], prog(t, t_tri, 0.6), (1, 1, 1), 3)
        badge(ctx, "INVERTED TRIANGLE", None, t - t_tri)
        brand(ctx)
        cap(ctx, ta, im)

    add("s02_diagnosis", b["diag"], b["t_fit"], diag)

    # Title cards
    def card(small, big, key):
        def fn(ctx, t, T, ta):
            title_card(ctx, grey[key], small, big, t, 1.03 + 0.02 * t / max(T, 0.01))
            brand(ctx)
            cap(ctx, ta, grey[key])

        return fn

    add("s03_title_fit", b["t_fit"], b["fit_problem"], card("FIRST", "FIT", "img1_before"))

    # S4 fit problem: chest pulling, waist ballooning (regions from the close-up's pose)
    pc = lmk["img1b_pulling_closeup"]["pose"]

    def fit_problem(ctx, t, T, ta):
        im = img["img1b_pulling_closeup"]
        z = 1.0 + 0.04 * t / max(T, 0.01)
        paint(ctx, im, z, W / 2, 1100)
        lx, rx = sorted([pc[11][0], pc[12][0]])
        sy = (pc[11][1] + pc[12][1]) / 2
        t_pull, t_ball = w("pull") - ta + t, w("balloon") - ta + t
        x0, y0 = zoom_point(lx + 30, sy + 40, z, W / 2, 1100)
        x1, y1 = zoom_point(rx - 30, sy + 330, z, W / 2, 1100)
        scan_grid(ctx, x0, y0, x1 - x0, y1 - y0, prog(t, t_pull, 0.5), (1, 0.42, 0.38))
        wy0 = zoom_point(0, min(H - 330, sy + 700), z, W / 2, 1100)[1]
        scan_grid(ctx, x0 - 20, wy0, x1 - x0 + 40, 250, prog(t, t_ball, 0.5), (1, 0.42, 0.38))
        if t < t_ball:
            badge(ctx, "PULLING AT CHEST", False, t - t_pull)
        else:
            badge(ctx, "LOOSE AT WAIST", False, t - t_ball)
        brand(ctx)
        cap(ctx, ta, im)

    add("s04_fit_problem", b["fit_problem"], b["fit_fix"], fit_problem)

    # S5 fit fix: wipe to athletic fit, waist line narrows, tiles + cursor click
    def fit_fix(ctx, t, T, ta):
        t_w, t_f = w("athletic") - ta + t, w("follows") - ta + t
        z = 1.0 + 0.03 * t / max(T, 0.01)
        a, bb = img["img1_before"], img["img2_fit"]
        wipe(ctx, a, bb, prog(t, t_w - WIPE_LEAD["fit"], 0.8), z, *ZC)
        done = t >= t_w + 0.45
        r = rows("img2_fit" if done else "img1_before")
        wx0, wx1, _ = r["waist"]
        y = r["rows"]["waist"]
        p0, p1 = zp(wx0, y, z), zp(wx1, y, z)
        measure_line(ctx, p0[0], p1[0], p0[1], 1.0 if t > 0.15 else prog(t, 0, 0.15), "TAPERED WAIST" if done else "WAIST", label_above=False)
        badge(ctx, "ATHLETIC FIT", True, t - (t_w + 0.6))
        tiles(ctx, (a, (240, 380, 600, 600), "REGULAR"), (bb, (240, 380, 600, 600), "ATHLETIC"), t - t_f + 0.1, 0.75)
        brand(ctx)
        cap(ctx, ta, bb if done else a)

    add("s05_fit_fix", b["fit_fix"], b["t_trousers"], fit_fix)
    add("s06_title_trousers", b["t_trousers"], b["bal_problem"], card("SECOND", "TROUSERS", "img2_fit"))

    # S7 balance problem: shoulders vs ankles — real outline widths
    def leg_geometry(k, z):
        r = rows(k)
        sx0, sx1, _ = r["shoulder"]
        sy = r["rows"]["shoulder"]
        L, R = r["ankleL"], r["ankleR"]
        ay = r["ankleY"]
        xs = sorted([L[0], L[1], R[0], R[1]])
        return zp(sx0, sy, z, k), zp(sx1, sy, z, k), zp(xs[0], ay, z, k), zp(xs[-1], ay, z, k), r

    def bal_problem(ctx, t, T, ta):
        im = img["img2_fit"]
        z = 1.0 + 0.03 * t / max(T, 0.01)
        paint(ctx, im, z, *ZC)
        s0, s1, a0, a1, r = leg_geometry("img2_fit", z)
        t_sk, t_hu = w("Skinny") - ta + t, w("huge") - ta + t
        measure_line(ctx, s0[0], s1[0], s0[1], prog(t, t_sk, 0.4), "SHOULDERS")
        polyline(ctx, [s0, a0], prog(t, t_sk + 0.3, 0.6), (1, 0.42, 0.38), 4.5)
        polyline(ctx, [s1, a1], prog(t, t_sk + 0.3, 0.6), (1, 0.42, 0.38), 4.5)
        for side in "LR":
            x0, x1, _ = r["ankle" + side]
            p0, p1 = zp(x0, r["ankleY"], z, "img2_fit"), zp(x1, r["ankleY"], z, "img2_fit")
            measure_line(ctx, p0[0], p1[0], p0[1], prog(t, t_sk + 0.5, 0.35), "", (1, 0.42, 0.38))
        badge(ctx, "TOP-HEAVY", False, t - t_hu)
        brand(ctx)
        cap(ctx, ta, im)

    add("s07_balance_problem", b["bal_problem"], b["bal_fix"], bal_problem)

    # S8 balance fix: wipe to straight-leg chinos; outline straightens; tiles
    def bal_fix(ctx, t, T, ta):
        t_w, t_b = w("chinos") - WIPE_LEAD["balance"] - ta + t, w("balance") - ta + t
        z = 1.0 + 0.03 * t / max(T, 0.01)
        a, bb = img["img2_fit"], img["img3_balance"]
        wipe(ctx, a, bb, prog(t, t_w, 0.8), z, *ZC)
        done = t >= t_w + 0.6
        s0, s1, a0, a1, r = leg_geometry("img3_balance" if done else "img2_fit", z)
        col = (0.55, 0.95, 0.65) if done else (1, 0.42, 0.38)
        measure_line(ctx, s0[0], s1[0], s0[1], 1.0, "SHOULDERS")
        polyline(ctx, [s0, a0], 1.0, col, 4.5)
        polyline(ctx, [s1, a1], 1.0, col, 4.5)
        kk = "img3_balance" if done else "img2_fit"
        for side in "LR":
            x0, x1, _ = r["ankle" + side]
            p0, p1 = zp(x0, r["ankleY"], z, kk), zp(x1, r["ankleY"], z, kk)
            measure_line(ctx, p0[0], p1[0], p0[1], 1.0, "", col)
        badge(ctx, "BALANCED", True, t - t_b)
        tiles(ctx, (a, (190, 1020, 700, 700), "SKINNY"), (bb, (190, 1020, 700, 700), "STRAIGHT LEG"), t - t_b + 0.2, 0.7, y=1180)
        brand(ctx)
        cap(ctx, ta, bb if done else a)

    add("s08_balance_fix", b["bal_fix"], b["t_colour"], bal_fix)
    add("s09_title_colour", b["t_colour"], b["col_problem"], card("THIRD", "COLOUR", "img3_balance"))

    # S10 colour problem: warm undertone; black & icy grey struck out
    def col_problem(ctx, t, T, ta):
        im = img["img4a_black"]
        paint(ctx, im, 1.0 + 0.04 * t / max(T, 0.01), W / 2, 700)
        t_warm, t_bl, t_gr, t_wa = w("warm") - ta + t, w("Black") - ta + t, w("grey", alts=("gray",)) - ta + t, w("wash") - ta + t
        badge(ctx, "WARM UNDERTONE", None, t - t_warm)
        swatch_row(ctx, [("Jet black", "#0a0a0a", t - t_bl), ("Icy grey", "#d9dee3", t - t_gr)], False, 1330, crossed=prog(t, t_wa, 0.4))
        brand(ctx)
        cap(ctx, ta, im)

    add("s10_colour_problem", b["col_problem"], b["col_fix"], col_problem)

    # S11 colour fix: wipe to olive + stone; best colours appear on their words
    def col_fix(ctx, t, T, ta):
        a, bb = img["img4a_black"], img["img4b_olive"]
        zz = 1.04 + 0.03 * t / max(T, 0.01)
        wipe(ctx, a, bb, prog(t, w("Olive") - WIPE_LEAD["colour"] - ta + t, 0.7), zz, W / 2, 700)
        t_ol, t_ca, t_te, t_gl = (w(x) - ta + t for x in ("Olive", "camel", "terracotta", "glow"))
        swatch_row(ctx, [("Olive", "#708238", t - t_ol), ("Camel", "#c19a6b", t - t_ca), ("Terracotta", "#c8644a", t - t_te), ("Warm teal", "#2f7f7a", t - t_te - 0.25)], True, 1330, size=140)
        badge(ctx, "WARM COLOURS", True, t - t_gl)
        brand(ctx)
        cap(ctx, ta, bb)

    add("s11_colour_fix", b["col_fix"], b["payoff"], col_fix)

    # S12 payoff: final studio look, then the café walk
    t_follow = w("Follow")

    def payoff(ctx, t, T, ta):
        if ta < t_follow - 0.1:
            im = img["img5_after_studio"]
            paint(ctx, im, 1.0 + 0.05 * clamp(t / max(t_follow - b["payoff"], 0.1)), *ZC)
        else:
            im = img["img6_after_cafe"]
            k = ta - (t_follow - 0.1)
            paint(ctx, im, 1.02 + 0.03 * clamp(k / 2.5), W / 2, 760)
            # brief flash-cut feel
            if k < 0.12:
                ctx.set_source_rgba(1, 1, 1, 0.35 * (1 - k / 0.12))
                ctx.paint()
        if ta < t_follow - 0.1:
            title_top(ctx, TITLE, im, alpha=prog(t, 0.2, 0.4))
        brand(ctx)
        cap(ctx, ta, im)

    add("s12_payoff", b["payoff"], b["end"], payoff)

    # S13 end card on the blurred last frame
    blur = None

    def endcard(ctx, t, T, ta):
        nonlocal blur
        import cairo
        import cv2

        if blur is None:
            bgr = cv2.GaussianBlur(img["img6_after_cafe"].bgr, (0, 0), 28)
            blur = Img.__new__(Img)
            blur.bgr = bgr
            bgra = np.ascontiguousarray(cv2.cvtColor(bgr, cv2.COLOR_BGR2BGRA))
            blur._buf = bgra
            blur.surface = cairo.ImageSurface.create_for_data(memoryview(bgra), cairo.FORMAT_ARGB32, W, H, bgra.strides[0])
        paint(ctx, blur, 1.05)
        a = prog(t, 0, 0.35)
        g = cairo.LinearGradient(0, 0, 0, H)
        g.add_color_stop_rgba(0, 0.07, 0.07, 0.07, 0.55 * a)
        g.add_color_stop_rgba(0.45, 0.07, 0.07, 0.07, 0.88 * a)
        g.add_color_stop_rgba(1, 0.07, 0.07, 0.07, 0.96 * a)
        ctx.set_source(g)
        ctx.paint()
        logo_mark(ctx, W / 2 - 150, 610, 64, light=True)
        font(ctx, "Inter Tight", 40, bold=True)
        ctx.set_source_rgba(*PAPER, a)
        tx = W / 2 - 70
        for ch in "FORMA":
            ctx.move_to(tx, 655)
            ctx.show_text(ch)
            tx += ctx.text_extents(ch).x_advance + 8
        font(ctx, "Playfair Display", 112, italic=True)
        text_center(ctx, "What should", W / 2, 840, PAPER, alpha=a)
        font(ctx, "Playfair Display", 112, italic=True)
        wy = text_center(ctx, "you be wearing?", W / 2, 960, PAPER, alpha=a)
        # accent on "you"
        ctx.set_source_rgba(0.95, 0.70, 0.56, a)
        ctx.move_to(W / 2 - wy / 2, 960)
        ctx.show_text("you")
        font(ctx, "Inter Tight", 42)
        text_center(ctx, "Your frame, colours and fits", W / 2, 1060, (0.88, 0.87, 0.85), alpha=a)
        text_center(ctx, "from two photos. Free preview.", W / 2, 1115, (0.88, 0.87, 0.85), alpha=a)
        from render import rounded
        rounded(ctx, W / 2 - 220, 1200, 440, 112, 56)
        ctx.set_source_rgba(*ACCENT, a)
        ctx.fill()
        font(ctx, "Inter Tight", 48, bold=True)
        text_center(ctx, "Link in bio →", W / 2, 1272, (1, 1, 1), alpha=a)
        mono_label(ctx, "ARJUN IS AN AI-GENERATED CHARACTER", W / 2, 1830, (1, 1, 1), alpha=0.45 * a, size=20)

    add("s13_endcard", b["end"], T_END, endcard)

    BADGE, FULL_R, CAP_R = [330, 80, 420, 60], [0, 0, W, H], [90, 1585, 900, 110]
    q = lambda v: round(v * 30) / 30  # noqa: E731  first frame at or after v
    same_image = {"diag", "col_fix"}  # these scene changes keep the same picture, so there is no visible cut to time
    events = [{"name": f"cut → {k}", "t": b[k], "region": FULL_R} for k in order[1:-1] if k not in same_image]
    events += [
        {"name": "badge INVERTED TRIANGLE", "t": q(w("inverted")), "word": w("inverted"), "region": BADGE},
        {"name": "badge PULLING AT CHEST", "t": q(w("pull")), "word": w("pull"), "region": BADGE},
        {"name": "badge LOOSE AT WAIST", "t": q(w("balloon")), "word": w("balloon"), "region": BADGE},
        {"name": "wipe reaches shirt on 'athletic'", "t": q(w("athletic")), "word": w("athletic"), "region": [180, 640, 720, 420]},
        {"name": "wipe reaches legs on 'chinos'", "t": q(w("chinos")), "word": w("chinos"), "region": [260, 1180, 560, 420]},
        {"name": "wipe reaches shirt on 'Olive'", "t": q(w("Olive")), "word": w("Olive"), "region": [80, 1180, 920, 500]},
        {"name": "badge TOP-HEAVY", "t": q(w("huge")), "word": w("huge"), "region": BADGE},
        {"name": "badge BALANCED", "t": q(w("balance")), "word": w("balance"), "region": BADGE},
        {"name": "badge WARM UNDERTONE", "t": q(w("warm")), "word": w("warm"), "region": BADGE},
        {"name": "swatch JET BLACK", "t": q(w("Black")), "word": w("Black"), "region": [330, 1320, 200, 200]},
        {"name": "swatch CAMEL", "t": q(w("camel")), "word": w("camel"), "region": [390, 1320, 150, 200]},
        {"name": "badge WARM COLOURS", "t": q(w("glow")), "word": w("glow"), "region": BADGE},
    ]
    # captions: each chunk's first word (skip ones that start exactly on a scene cut — the cut is measured instead)
    cuts = {round(b[k], 2) for k in order}
    for cs, _, txt in chunks:
        if all(abs(cs - c) > 0.2 for c in cuts) and cs < b["end"]:
            events.append({"name": f"caption '{txt[:22]}'", "t": q(cs), "word": cs, "region": CAP_R})
    events.sort(key=lambda e: e["t"])
    (work / "render").mkdir(exist_ok=True)
    (work / "render" / "events.json").write_text(json.dumps(events, indent=0))
    return scenes, b, T_END


def audio_track(work: Path, total: float) -> Path:
    narr, sr = sf.read(str(work / "voice" / "narration.wav"), dtype="float32")
    out = np.zeros(int(total * sr) + sr, dtype=np.float32)
    s = int(LEAD * sr)
    out[s : s + len(narr)] = narr[: len(out) - s]
    path = work / "render" / "audio.wav"
    path.parent.mkdir(parents=True, exist_ok=True)
    sf.write(path, out[: int(total * sr)], sr)
    return path


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("work", type=Path)
    ap.add_argument("--stills", action="store_true", help="write key frames as PNGs instead of encoding")
    ap.add_argument("--only", help="re-render a single scene by name")
    a = ap.parse_args()
    scenes, bounds, total = build(a.work)
    outdir = a.work / "render" / "scenes"
    print(json.dumps({k: round(v, 2) for k, v in bounds.items()}), f"total {total:.2f}s")
    if a.stills:
        for s in scenes:
            render_scene(s, a.work / "render" / "stills", only_frames=[min(s.duration - 0.05, f * s.duration) for f in (0.35, 0.92)])
        return
    files = []
    for s in scenes:
        f = outdir / f"{s.name}.mp4"
        if a.only in (None, s.name) or not f.exists():
            render_scene(s, outdir)
            print(f"  ✓ {s.name} {s.duration:.2f}s", flush=True)
        files.append(f)
    join(files, audio_track(a.work, total), a.work / "render" / "arjun_outfit_glowup.mp4")
    print("done:", a.work / "render" / "arjun_outfit_glowup.mp4")


if __name__ == "__main__":
    main()
