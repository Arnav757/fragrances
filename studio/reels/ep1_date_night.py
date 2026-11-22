"""Arjun's Fit, episode 1: Date night. One timeline, two asset sets (ChatGPT stills or Gemini stills + clip).

    python studio/reels/ep1_date_night.py studio/work/ep1 --variant gpt   # → render/gpt/ep1_date_night_gpt.mp4
    python studio/reels/ep1_date_night.py studio/work/ep1 --variant gem
    add --stills to write key frames only

<work>/voice: narration.wav, words.json (voice.py + timeline.py on reels/ep1_date_night.lines.txt)
gpt assets: ep1_a_before, ep1_b_after, ep1_c_location, ep1_d_colour_black, ep1_e_colour_blue, ep1_f_hem (.png)
gem assets: gem/before.png, gem/location.png, gem/vB_clean.mp4 (black → pale blue + navy wide trousers morph)
"""
import argparse
import json
import sys
from pathlib import Path

import cairo
import cv2
import numpy as np
import soundfile as sf

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "lib"))
from render import (  # noqa: E402
    ACCENT, INK, PAPER, W, H, Clip, Img, Scene, badge, caption, caption_at, caption_chunks, clamp, ease_in_out, find_word,
    font, join, logo_mark, measure_line, mono_label, paint, polyline, prog, render_scene, rounded, swatch_row, text_center,
    tiles, zoom_point,
)

ENDCARD, LEAD, FULL = 2.6, 0.25, 0.86
BAD = (1, 0.42, 0.38)
GOOD = (0.55, 0.95, 0.65)
# Gemini morph clip (vB): black outfit held to 1.0 s, shirt changes 1.0–2.3 s, trousers 3.5–5.0 s, then holds.
GEM_SHIRT = (1.0, 2.3)
GEM_TROUSERS = (3.5, 5.0)


def body_points(bgr):
    """Shoulder and ankle outline points (canvas pixels of the cover-fitted image) from MediaPipe pose + segmentation."""
    import mediapipe as mp
    from silhouette import run_at

    with mp.solutions.pose.Pose(static_image_mode=True, model_complexity=2, enable_segmentation=True) as pose:
        r = pose.process(cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB))
    lm = r.pose_landmarks.landmark
    mask = cv2.GaussianBlur(r.segmentation_mask, (5, 5), 0)
    P = lambda i: (lm[i].x * W, lm[i].y * H)  # noqa: E731
    ls, rs = P(11), P(12)
    sy = (ls[1] + rs[1]) / 2 + 25
    sx0, sx1 = run_at(mask, sy, (ls[0] + rs[0]) / 2)
    la, ra = P(27), P(28)
    ay = (la[1] + ra[1]) / 2 - 25
    ankles = sorted([run_at(mask, ay, la[0]), run_at(mask, ay, ra[0])])
    return {"shoulder": (sx0, sx1, sy), "ankles": ankles, "ankle_y": ay}


def face_crop(path: Path, out: Path):
    """Head-and-shoulders 9:16 crop around the detected face (for the Gemini colour proof)."""
    import mediapipe as mp

    im = cv2.imread(str(path))
    with mp.solutions.face_detection.FaceDetection(model_selection=1) as fd:
        d = fd.process(cv2.cvtColor(im, cv2.COLOR_BGR2RGB)).detections[0].location_data.relative_bounding_box
    h, w = im.shape[:2]
    fx, fy, fw, fh = d.xmin * w, d.ymin * h, d.width * w, d.height * h
    cw = fw * 3.0
    ch = cw * 16 / 9
    x0 = int(max(0, fx + fw / 2 - cw / 2))
    y0 = int(max(0, fy - fh * 0.9))
    crop = im[y0 : y0 + int(ch), x0 : x0 + int(cw)]
    cv2.imwrite(str(out), cv2.resize(crop, (W, H), interpolation=cv2.INTER_LANCZOS4))


def build(work: Path, variant: str):
    words = json.loads((work / "voice" / "words.json").read_text())
    lines = json.loads((work / "voice" / "lines.json").read_text())
    narr_len = sf.info(str(work / "voice" / "narration.wav")).duration
    chunks = caption_chunks(words, LEAD)

    def w(tok, nth=1, after=-1.0):
        return find_word(words, tok, nth, after - LEAD if after >= 0 else -1) + LEAD

    L = [round((x["start"] + LEAD - (0.08 if i else LEAD)) * 30) / 30 for i, x in enumerate(lines)]  # line starts
    END = round((LEAD + narr_len + 0.45) * 30) / 30
    T_END = round((END + ENDCARD) * 30) / 30

    # ---------------------------------------------------------------- assets
    if variant == "gpt":
        A = lambda k, **kw: Img(work / f"ep1_{k}.png", **kw)  # noqa: E731
        before, after = A("a_before", fit=FULL), A("b_after", fit=FULL)
        loc, face_b, face_e, hem = A("c_location"), A("d_colour_black"), A("e_colour_blue"), A("f_hem")
        clip = None
    else:
        G = work / "gem"
        for src, dst in (("before.png", "face_black.png"), ("after.png", "face_blue.png")):
            if not (G / dst).exists():
                face_crop(G / src, G / dst)
        clip = Clip(G / "vB_clean.mp4", 0.0, 10.0, fit=FULL)
        before, after = clip.at(0.3), clip.at(8.0)
        before = Img(bgr=clip.frames[clip.index(0.3)].copy(), fit=FULL)
        after = Img(bgr=clip.frames[clip.index(8.0)].copy(), fit=FULL)
        loc = Img(G / "location.png")
        face_b, face_e = Img(G / "face_black.png"), Img(G / "face_blue.png")
        hem = None

    # body measurements on the plain cover-fitted images, mapped through the headroom fit
    def raw(im):
        return cv2.resize(im.bgr, (W, H)) if im.fit == 1 else None

    if variant == "gpt":
        src_before = cv2.imread(str(work / "ep1_a_before.png"))
        src_after = cv2.imread(str(work / "ep1_b_after.png"))
        from render import cover

        pb, pa = body_points(cover(src_before)), body_points(cover(src_after))
    else:
        from render import cover

        pb, pa = body_points(clip.frames[clip.index(0.3)]), body_points(clip.frames[clip.index(8.0)])

    def mp_(pt, z, im, cx=W / 2, cy=1000):
        return zoom_point(*im.map(*pt), z, cx, cy)

    def cap(ctx, ta):
        txt, age = caption_at(chunks, ta)
        caption(ctx, txt, None, age)

    def brand(ctx):
        logo_mark(ctx, 36, 226, 58)

    scenes = []

    def add(name, start, end, fn):
        scenes.append(Scene(name, start, end - start, lambda ctx, t, T, s=start: fn(ctx, t, T, s + t)))

    ZC = (W / 2, 1000)

    # S0 hook + title: the finished fit on location ("Arjun's date night fit.")
    def hook(ctx, t, T, ta):
        paint(ctx, loc, 1.08 - 0.05 * clamp(t / T), W / 2, 900)
        g = cairo.LinearGradient(0, 0, 0, 820)
        g.add_color_stop_rgba(0, 0, 0, 0, 0.62)
        g.add_color_stop_rgba(1, 0, 0, 0, 0)
        ctx.set_source(g)
        ctx.rectangle(0, 0, W, 820)
        ctx.fill()
        a1, a2 = prog(t, 0.0, 0.3), prog(t, w("date") - ta + t - 0.05, 0.3)
        font(ctx, "Playfair Display", 92, italic=True)
        text_center(ctx, "Arjun’s", W / 2, 330, (1, 1, 1), alpha=a1, shadow=True)
        font(ctx, "Syne", 118, bold=True)
        text_center(ctx, "DATE NIGHT", W / 2, 465, (1, 1, 1), alpha=a2, shadow=True, tracking=3)
        text_center(ctx, "FIT", W / 2, 590, (1, 1, 1), alpha=prog(t, w("fit") - ta + t - 0.05, 0.3), shadow=True, tracking=3)
        mono_label(ctx, "EPISODE 01 · ARJUN IS AN AI-GENERATED CHARACTER", W / 2, 205, (1, 1, 1), alpha=0.7 * a1, size=19)
        brand(ctx)

    add("s00_hook", 0, L[1], hook)

    # S1 the mistake: all black
    def mistake(ctx, t, T, ta):
        paint(ctx, before, 1.0 + 0.03 * t / T, *ZC)
        badge(ctx, "ALL BLACK", False, ta - w("black"))
        brand(ctx)
        cap(ctx, ta)

    add("s01_mistake", L[1], L[2], mistake)

    # S2 colour problem: black against warm skin, close up
    def colour(ctx, t, T, ta):
        paint(ctx, face_b, 1.02 + 0.04 * t / T, W / 2, 700)
        badge(ctx, "WARM UNDERTONE", None, ta - w("warm"))
        swatch_row(ctx, [("Jet black", "#0a0a0a", ta - w("black", 2))], False, 1330, crossed=prog(ta, w("harsh"), 0.35))
        brand(ctx)
        cap(ctx, ta)

    add("s02_colour_problem", L[2], L[3], colour)

    # S3 skinny jeans → top-heavy: measured shoulder width, lines down to the narrow ankles
    def skinny(ctx, t, T, ta):
        z = 1.0 + 0.03 * t / T
        paint(ctx, before, z, *ZC)
        sx0, sx1, sy = pb["shoulder"]
        s0, s1 = mp_((sx0, sy), z, before), mp_((sx1, sy), z, before)
        (l0, l1), (r0, r1) = pb["ankles"]
        a0, a1 = mp_((l0, pb["ankle_y"]), z, before), mp_((r1, pb["ankle_y"]), z, before)
        t_sk, t_sh, t_hu = w("skinny") - ta + t, w("shoulders") - ta + t, w("huge") - ta + t
        for x0, x1 in pb["ankles"]:
            p0, p1 = mp_((x0, pb["ankle_y"]), z, before), mp_((x1, pb["ankle_y"]), z, before)
            measure_line(ctx, p0[0], p1[0], p0[1], prog(t, t_sk, 0.35), "", BAD)
        measure_line(ctx, s0[0], s1[0], s0[1], prog(t, t_sh, 0.4), "SHOULDERS")
        polyline(ctx, [s0, a0], prog(t, t_sh + 0.25, 0.6), BAD, 4.5)
        polyline(ctx, [s1, a1], prog(t, t_sh + 0.25, 0.6), BAD, 4.5)
        badge(ctx, "TOP-HEAVY", False, t - t_hu)
        brand(ctx)
        cap(ctx, ta)

    add("s03_skinny", L[3], L[4], skinny)

    # S4–S5 the fix. gpt: two-stage scan wipe (shirt on "pale", trousers on "navy"); gem: the Gemini morph,
    # time-remapped so the shirt changes on "pale" and the trousers on "navy".
    t_pale, t_navy = w("pale"), w("navy")
    SHIRT_Y, LEG_Y = 1010, H + 60  # wipe stops just below the belt, then finishes the legs

    def fix_frame(ta):
        if variant == "gem":
            if ta < t_pale:
                c = GEM_SHIRT[0]
            elif ta < t_navy - 0.1:
                c = min(GEM_SHIRT[1], GEM_SHIRT[0] + (ta - t_pale) * 1.15)
            else:
                c = min(10.0, GEM_TROUSERS[0] + (ta - (t_navy - 0.1)) * 1.3)
                if c > GEM_TROUSERS[1]:
                    c = GEM_TROUSERS[1] + (c - GEM_TROUSERS[1]) / 1.3
            return clip.at(c)
        return None

    def fix(ctx, t, T, ta):
        z = 1.0 + 0.02 * (ta - L[4]) / (L[6] - L[4])
        fr = fix_frame(ta)
        if fr is not None:
            paint(ctx, fr, z, *ZC)
        else:
            p1 = ease_in_out(prog(ta, t_pale - 0.15, 0.9))
            p2 = ease_in_out(prog(ta, t_navy - 0.15, 0.8))
            y = -60 + p1 * (SHIRT_Y + 60) + p2 * (LEG_Y - SHIRT_Y)
            paint(ctx, before, z, *ZC)
            if y > 0:
                ctx.save()
                ctx.rectangle(0, 0, W, y)
                ctx.clip()
                paint(ctx, after, z, *ZC)
                ctx.restore()
            moving = (0 < p1 < 1) or (0 < p2 < 1)
            if moving:
                band = 150
                g = cairo.LinearGradient(0, y - band, 0, y)
                g.add_color_stop_rgba(0, 1, 1, 1, 0)
                g.add_color_stop_rgba(1, 1, 1, 1, 0.22)
                ctx.set_source(g)
                ctx.rectangle(0, y - band, W, band)
                ctx.fill()
            if moving or (p1 >= 1 and p2 <= 0):
                ctx.set_source_rgba(1, 1, 1, 0.95 if moving else 0.5)
                ctx.set_line_width(4)
                ctx.move_to(0, y)
                ctx.line_to(W, y)
                ctx.stroke()
        if ta < t_navy:
            badge(ctx, "PALE BLUE SHIRT", True, ta - w("shirt"))
        else:
            badge(ctx, "NAVY WIDE TROUSERS", True, ta - (w("wide") - 0.1))
        brand(ctx)
        cap(ctx, ta)

    add("s04_shirt", L[4], L[5], fix)
    # hem proof: gpt cuts to the hem close-up on "wide"; gem pushes in on the hem in the clip
    t_wide = w("wide")

    def trousers(ctx, t, T, ta):
        if variant == "gpt" and ta >= t_wide - 0.05:
            k = ta - (t_wide - 0.05)
            paint(ctx, hem, 1.0 + 0.05 * k / max(0.1, L[6] - t_wide), W / 2, 1300)
            badge(ctx, "HEM ON THE SHOE", True, k - 0.2)
        elif variant == "gem" and ta >= t_wide + 0.25:
            k = ta - (t_wide + 0.25)
            u = ease_in_out(clamp(k / 0.8))
            fr = fix_frame(ta)
            paint(ctx, fr, 1.0 + 0.9 * u, W / 2, 1000 + 700 * u)
            badge(ctx, "HEM ON THE SHOE", True, k - 0.5)
        else:
            fix(ctx, t, T, ta)
            return
        brand(ctx)
        cap(ctx, ta)

    add("s05_trousers", L[5], L[6], trousers)

    # S6 breakdown: the full look, swatches on the words, then the face comparison tiles
    def breakdown(ctx, t, T, ta):
        im = clip.at(5.2 + t * 0.8) if clip else after
        paint(ctx, im, 1.0 + 0.03 * t / T, *ZC)
        t_b1, t_b2 = w("belt"), w("loafers")
        swatch_row(
            ctx,
            [("Pale blue", "#c9d8ee", ta - (L[6] + 0.05)), ("Navy", "#1f2a44", ta - (L[6] + 0.2)), ("Brown", "#5b3a26", ta - t_b1)],
            True, 300, size=130,
        )
        badge(ctx, "BROWN LEATHER", True, ta - t_b2)
        t_f = w("face")
        tiles(ctx, (face_b, (240, 260, 600, 600), "BLACK"), (face_e, (240, 260, 600, 600), "PALE BLUE"), ta - (w("Nothing") - 0.05), t_f - w("Nothing") + 0.3, y=1250)
        brand(ctx)
        cap(ctx, ta)

    add("s06_breakdown", L[6], L[7], breakdown)

    # S7 payoff on location
    def payoff(ctx, t, T, ta):
        paint(ctx, loc, 1.0 + 0.06 * ease_in_out(t / T), W / 2, 950)
        if ta < w("Date") - 0.05:
            if ta < w("balanced"):
                badge(ctx, "LONG LEG LINE", True, ta - w("Long"))
            else:
                badge(ctx, "BALANCED SHOULDERS", True, ta - w("balanced"))
        else:
            badge(ctx, "DATE READY", True, ta - w("Date"))
        if t < 0.12:
            ctx.set_source_rgba(1, 1, 1, 0.3 * (1 - t / 0.12))
            ctx.paint()
        brand(ctx)
        cap(ctx, ta)

    add("s07_payoff", L[7], END, payoff)

    blur = {}

    def endcard(ctx, t, T, ta):
        if "im" not in blur:
            bgr = cv2.GaussianBlur(loc.bgr, (0, 0), 28)
            blur["im"] = Img(bgr=bgr)
        paint(ctx, blur["im"], 1.05)
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
        font(ctx, "Playfair Display", 104, italic=True)
        text_center(ctx, "What’s your", W / 2, 840, PAPER, alpha=a)
        text_center(ctx, "date night fit?", W / 2, 960, PAPER, alpha=a)
        font(ctx, "Inter Tight", 42)
        text_center(ctx, "Your frame, colours and fits", W / 2, 1060, (0.88, 0.87, 0.85), alpha=a)
        text_center(ctx, "from two photos. Free preview.", W / 2, 1115, (0.88, 0.87, 0.85), alpha=a)
        rounded(ctx, W / 2 - 220, 1200, 440, 112, 56)
        ctx.set_source_rgba(*ACCENT, a)
        ctx.fill()
        font(ctx, "Inter Tight", 48, bold=True)
        text_center(ctx, "Link in bio →", W / 2, 1272, (1, 1, 1), alpha=a)
        mono_label(ctx, "ARJUN IS AN AI-GENERATED CHARACTER", W / 2, 1830, (1, 1, 1), alpha=0.45 * a, size=20)

    add("s08_endcard", END, T_END, endcard)

    q = lambda v: round(v * 30) / 30  # noqa: E731
    FULL_R, BADGE = [0, 0, W, H], [300, 80, 480, 60]
    events = [{"name": f"cut → {s.name}", "t": s.start, "region": FULL_R} for s in scenes[1:] if s.name not in ("s05_trousers",)]
    for tok, nth, name in [("black", 1, "badge ALL BLACK"), ("warm", 1, "badge WARM UNDERTONE"), ("huge", 1, "badge TOP-HEAVY"),
                           ("shirt", 1, "badge PALE BLUE SHIRT"), ("loafers", 1, "badge BROWN LEATHER"), ("Date", 1, "badge DATE READY")]:
        events.append({"name": name, "t": q(w(tok, nth)), "word": w(tok, nth), "region": BADGE})
    events.append({"name": "shirt starts changing on 'pale'", "t": q(t_pale), "word": t_pale, "region": [200, 560, 680, 300]})
    (work / "render" / variant).mkdir(parents=True, exist_ok=True)
    (work / "render" / variant / "events.json").write_text(json.dumps(events, indent=0))
    return scenes, T_END


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("work", type=Path)
    ap.add_argument("--variant", choices=["gpt", "gem"], required=True)
    ap.add_argument("--stills", action="store_true")
    a = ap.parse_args()
    scenes, total = build(a.work, a.variant)
    out = a.work / "render" / a.variant
    print(" ".join(f"{s.name}@{s.start:.2f}" for s in scenes), f"total {total:.2f}s")
    if a.stills:
        for s in scenes:
            render_scene(s, out / "stills", only_frames=[min(s.duration - 0.05, f * s.duration) for f in (0.3, 0.9)])
        return
    files = [render_scene(s, out / "scenes") for s in scenes]
    narr, sr = sf.read(str(a.work / "voice" / "narration.wav"), dtype="float32")
    track = np.zeros(int(total * sr), np.float32)
    s0 = int(LEAD * sr)
    track[s0 : s0 + len(narr)] = narr[: len(track) - s0]
    sf.write(out / "audio.wav", track, sr)
    final = out / f"ep1_date_night_{a.variant}.mp4"
    join(files, out / "audio.wav", final)
    print("done:", final)


if __name__ == "__main__":
    main()
