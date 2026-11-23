"""Remove burned-in labels (white text, leader lines, ✗ icons, colour dots) that a video generator drew over a
studio shot, and its corner sparkle.

    python studio/lib/untext.py in.mp4 out.mp4 [--debug dir]

Per frame: the person is segmented (MediaPipe selfie segmentation). Overlay pixels are
  - bright strokes: grey > 228 and ≥ 16 above a 25 px median of the frame (text, lines, dots), anywhere;
  - outside the person only: anything ≥ 18 away from a 41 px median (red ✗ icons, colour dots, glyph shadows).
Bright strokes inside the person are kept only when they connect to an overlay outside the person (a leader
line running onto the shirt), or in the lower band below the hands (text drawn over dark trousers); so shirt
buttons and highlights survive. The mask is dilated 3 px and inpainted. Output CRF 12, no audio.
"""
import argparse
import subprocess
from pathlib import Path

import cv2
import mediapipe as mp
import numpy as np


def overlay_mask(f, seg, lower_band_y=None):  # noqa: C901
    g = cv2.cvtColor(f, cv2.COLOR_BGR2GRAY)
    fi = f.astype(int)
    mx, mn = fi.max(2), fi.min(2)
    person = seg > 0.5
    person_dil = cv2.dilate(person.astype(np.uint8), np.ones((15, 15), np.uint8)) > 0
    # 1. white, colourless, thin strokes anywhere (text, leader lines, dots): top-hat picks features < 15 px wide
    th = cv2.morphologyEx(g, cv2.MORPH_TOPHAT, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 15)))
    white = (mn > 200) & (mx - mn < 22) & (th > 26)
    # 2. off the person: anything that departs from the smooth backdrop (red icons, colour dots, glyph shadows)
    med = cv2.medianBlur(f, 41)
    far = np.abs(fi - med).max(2) > 16
    m = white | (far & ~person_dil) | ((mx - mn > 28) & ~person_dil)
    # 3. thin light leader lines over dark fabric: far brighter than pinstripes (which sit ~40 above the navy)
    dark = cv2.medianBlur(g, 21) < 90
    m |= dark & (th > 80) & (mx - mn < 40)
    if lower_band_y is not None:  # text drawn over the dark trousers late in the clip
        band = np.zeros_like(person)
        band[lower_band_y:] = True
        m |= band & person & (g > 140) & (mx - mn < 30)
    m = cv2.dilate(m.astype(np.uint8) * 255, np.ones((5, 5), np.uint8))
    return m


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("dst")
    ap.add_argument("--band-from", type=float, default=7.3, help="clip time from which the lower band applies")
    ap.add_argument("--lower-band", type=float, default=0.86, help="fraction of height below which bright pixels on the person are text")
    ap.add_argument("--window", type=float, default=0.75, help="seconds either side whose masks are merged")
    ap.add_argument("--debug")
    a = ap.parse_args()
    cap = cv2.VideoCapture(a.src)
    fps = cap.get(cv2.CAP_PROP_FPS)
    w, h = int(cap.get(3)), int(cap.get(4))
    proc = subprocess.Popen(
        ["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{w}x{h}", "-r", str(fps), "-i", "-",
         "-c:v", "libx264", "-crf", "12", "-pix_fmt", "yuv420p", "-an", a.dst],
        stdin=subprocess.PIPE,
    )
    seg = mp.solutions.selfie_segmentation.SelfieSegmentation(model_selection=0)
    frames, masks, bodies = [], [], []
    while True:
        ok, f = cap.read()
        if not ok:
            break
        i = len(frames)
        sm = seg.process(cv2.cvtColor(f, cv2.COLOR_BGR2RGB)).segmentation_mask
        frames.append(f)
        bodies.append(cv2.dilate((sm > 0.5).astype(np.uint8), np.ones((9, 9), np.uint8)) > 0)
        masks.append(overlay_mask(f, sm, int(a.lower_band * h) if i / fps >= a.band_from else None) > 0)
    # labels are drawn in screen space and fade in/out: a pixel flagged in any frame within ±window is treated as
    # overlay, so the faint fading frames are covered too
    k = int(a.window * fps)
    for i, f in enumerate(frames):
        near = np.logical_or.reduce(masks[max(0, i - k) : i + k + 1]) & ~bodies[i]  # neighbours' masks, off the body only
        m = (masks[i] | near).astype(np.uint8) * 255
        out = cv2.inpaint(f, m, 5, cv2.INPAINT_TELEA)
        if a.debug and i % 12 == 0:
            Path(a.debug).mkdir(parents=True, exist_ok=True)
            cv2.imwrite(f"{a.debug}/{i:03d}.jpg", np.hstack([f, cv2.cvtColor(m, cv2.COLOR_GRAY2BGR), out]))
        proc.stdin.write(out.tobytes())
    i = len(frames)
    proc.stdin.close()
    proc.wait()
    print(f"{a.dst}: {i} frames")


if __name__ == "__main__":
    main()
