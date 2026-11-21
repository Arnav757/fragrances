"""Remove a static semi-transparent white overlay (e.g. a generator's corner sparkle) from a video.

    python studio/lib/unwatermark.py estimate flat_clip.mp4 [moving_clip.mp4 …] alpha.npy --box x y w h
    python studio/lib/unwatermark.py apply in.mp4 out.mp4 alpha.npy --box x y w h

The overlay is modelled per pixel as obs = a·C + (1−a)·orig (C = the overlay's own grey level, a = its opacity).
`estimate` fits a and C by least squares over every frame of the given clips, using the inpainted surroundings
as the estimate of orig; clips where the background under the mark changes (moving pavement) make the fit
well-conditioned. The mark's shape comes from a top-hat on the median frame of the first (flat) clip. `apply` inverts the blend on every frame (recovering real texture under the
mark), then inpaints a thin ring at the mark's anti-aliased edge. Where the surroundings are flat (std < 6), the
whole mark is simply inpainted instead, which is invisible on plain backdrops and fabric. Output is lossless-ish (CRF 12) at the
source size and frame rate, audio dropped.
"""
import argparse
import subprocess

import cv2
import numpy as np


def frames(path):
    cap = cv2.VideoCapture(path)
    while True:
        ok, f = cap.read()
        if not ok:
            return
        yield f


def estimate(clips, out, box):
    """Opacity map from the flat first clip; one overlay grey level C fitted over all clips (robust to noise)."""
    x, y, w, h = box
    pad = 24
    X, Y, Wd, Hd = x - pad, y - pad, w + 2 * pad, h + 2 * pad
    first = np.stack([f[Y : Y + Hd, X : X + Wd] for f in frames(clips[0])]).astype(np.float32)
    med = np.median(first, 0)
    grey = cv2.cvtColor(med.astype(np.uint8), cv2.COLOR_BGR2GRAY)
    top = cv2.morphologyEx(grey, cv2.MORPH_TOPHAT, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (31, 31)))
    mask = cv2.dilate((top > 4).astype(np.uint8), np.ones((3, 3), np.uint8), iterations=2)
    bg = cv2.cvtColor(cv2.inpaint(med.astype(np.uint8), mask * 255, 9, cv2.INPAINT_TELEA), cv2.COLOR_BGR2GRAY).astype(np.float32)
    mg = cv2.cvtColor(med.astype(np.uint8), cv2.COLOR_BGR2GRAY).astype(np.float32)
    obs, est = [], []
    for c in clips:
        for i, f in enumerate(frames(c)):
            if i % 3 == 0:
                roi = f[Y : Y + Hd, X : X + Wd]
                obs.append(cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY).astype(np.float32))
                est.append(cv2.cvtColor(cv2.inpaint(roi, mask * 255, 7, cv2.INPAINT_TELEA), cv2.COLOR_BGR2GRAY).astype(np.float32))
    O, E = np.stack(obs), np.stack(est)
    C = 255.0
    for _ in range(3):  # alternate: opacity from the flat clip given C, then C from every frame given opacity
        a = np.where(mask > 0, np.clip((mg - bg) / np.maximum(C - bg, 1), 0, 0.9), 0).astype(np.float32)
        num = (a * (O - (1 - a) * E)).sum()
        den = (a * a).sum() * len(O)
        C = float(np.clip(num / den, 150, 255))
    a = cv2.GaussianBlur(a, (3, 3), 0)
    print(f"opacity peak {a.max():.2f}; overlay grey C = {C:.0f}; {len(O)} frames")
    np.save(out, {"alpha": a, "C": np.full(mask.shape, C, np.float32), "origin": (X, Y), "mask": mask})


def apply(src, dst, alpha_file, fps_hint=None):
    d = np.load(alpha_file, allow_pickle=True).item()
    a, (X, Y), mask = d["alpha"][..., None], d["origin"], d["mask"]
    C = d.get("C", np.full(mask.shape, 255, np.float32))[..., None]
    Hd, Wd = mask.shape
    edge = cv2.morphologyEx(mask, cv2.MORPH_GRADIENT, np.ones((3, 3), np.uint8))
    ring = cv2.dilate(edge, np.ones((3, 3), np.uint8), iterations=2).astype(np.uint8) * 255
    # surroundings used to correct any brightness residue left inside the mark (the blend isn't perfectly linear)
    near = (cv2.dilate(mask, np.ones((3, 3), np.uint8), iterations=7) - cv2.dilate(mask, np.ones((3, 3), np.uint8), iterations=3)).astype(bool)
    inner = cv2.erode(mask, np.ones((3, 3), np.uint8), iterations=2).astype(bool)
    wgt = (a[..., 0] / max(float(a.max()), 1e-3))[..., None]
    cap = cv2.VideoCapture(src)
    fps = cap.get(cv2.CAP_PROP_FPS)
    W, H = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)), int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    p = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{W}x{H}", "-r", f"{fps}", "-i", "-",
                          "-c:v", "libx264", "-crf", "12", "-preset", "medium", "-pix_fmt", "yuv420p", dst], stdin=subprocess.PIPE)
    n = 0
    for f in frames(src):
        roi = f[Y : Y + Hd, X : X + Wd].astype(np.float32)
        recf = np.clip((roi - a * C) / (1 - a), 0, 255)
        if inner.any():
            # per-channel residue (the blend isn't perfectly linear); median + cap so a nearby object (a sleeve, a shoe)
            # can't drag the correction
            offset = np.clip(np.median(recf[near], 0) - np.median(recf[inner], 0), -10, 10)
            recf = np.clip(recf + wgt * offset * 0.85, 0, 255)
        rec = cv2.inpaint(recf.astype(np.uint8), ring, 4, cv2.INPAINT_TELEA)
        if roi[near].std(0).max() < 6:  # flat surroundings (backdrop, plain fabric): plain inpainting is invisible there
            rec = cv2.inpaint(roi.astype(np.uint8), cv2.dilate(mask, np.ones((3, 3), np.uint8), iterations=2) * 255, 6, cv2.INPAINT_TELEA)
        f[Y : Y + Hd, X : X + Wd] = rec
        p.stdin.write(f.tobytes())
        n += 1
    p.stdin.close()
    if p.wait() != 0:
        raise SystemExit("ffmpeg failed")
    print(f"{dst}: {n} frames")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("mode", choices=["estimate", "apply"])
    ap.add_argument("args", nargs="+")
    ap.add_argument("--box", nargs=4, type=int, required=True)
    a = ap.parse_args()
    if a.mode == "estimate":  # estimate clip1 [clip2 …] out.npy
        estimate(a.args[:-1], a.args[-1], a.box)
    else:
        apply(a.args[0], a.args[1], a.args[2])
