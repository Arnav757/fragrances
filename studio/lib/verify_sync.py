"""Measure when visual events actually start in a rendered video and compare with when they should.

    python studio/lib/verify_sync.py video.mp4 events.json [--tol 0.08]

events.json: [{"name", "t" (expected onset, s), "word" (spoken-word time, s, optional), "region": [x, y, w, h]}]
Method: pre = the frame 100 ms before the expected onset, post = 267 ms after (animations settled). Only the
pixels that differ between pre and post (the element itself) are watched; onset = first frame where ≥ 25 % of
them have moved at least halfway from pre to post. An element that appeared too early has no pre state and
fails as "no change"; a late one is measured up to +300 ms. Exit code 1 if any |onset - t| > tol.
"""
import argparse
import json
import sys

import cv2
import numpy as np


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("video")
    ap.add_argument("events")
    ap.add_argument("--tol", type=float, default=0.08)
    a = ap.parse_args()
    cap = cv2.VideoCapture(a.video)
    fps = cap.get(cv2.CAP_PROP_FPS)
    frames = []
    while True:
        ok, f = cap.read()
        if not ok:
            break
        frames.append(cv2.cvtColor(cv2.resize(f, (540, 960)), cv2.COLOR_BGR2GRAY).astype(np.float32))
    evs = json.loads(open(a.events).read())
    worst, fails = 0.0, 0
    print(f"{'event':34} {'expected':>8} {'onset':>8} {'delta':>7}  {'vs word':>7}")
    for e in evs:
        x, y, w, h = (v // 2 for v in e["region"])
        R = lambda i: frames[max(0, min(len(frames) - 1, i))][y : y + h, x : x + w]  # noqa: E731
        k = round(e["t"] * fps)
        pre, post = R(k - 3), R(k + 8)
        delta_px = post - pre
        mask = np.abs(delta_px) > 20
        if mask.mean() < 0.004:
            print(f"{e['name'][:34]:34} {e['t']:8.3f} {'—':>8}  no change before→after (appeared early?)  ← OFF")
            fails += 1
            continue
        onset = None
        for i in range(k - 3, k + 10):
            moved = (R(i) - pre)[mask] / delta_px[mask]
            if (moved >= 0.5).mean() >= 0.25:
                onset = i / fps
                break
        if onset is None:
            print(f"{e['name'][:34]:34} {e['t']:8.3f} {'—':>8}  never settled  ← OFF")
            fails += 1
            continue
        delta = onset - e["t"]
        worst = max(worst, abs(delta))
        vs = f"{(onset - e['word']) * 1000:+6.0f}ms" if e.get("word") is not None else ""
        flag = "" if abs(delta) <= a.tol else "  ← OFF"
        fails += abs(delta) > a.tol
        print(f"{e['name'][:34]:34} {e['t']:8.3f} {onset:8.3f} {delta * 1000:+6.0f}ms {vs:>8}{flag}")
    print(f"\n{len(evs)} events, worst |delta| {worst * 1000:.0f} ms, {fails} outside ±{a.tol * 1000:.0f} ms")
    sys.exit(1 if fails else 0)


if __name__ == "__main__":
    main()
