"""Cut the Salman reel's footage: face-tracked 9:16 crops (and one wide crop) from the supplied archive video.

    python studio/reels/salman_clips.py studio/work/salman

Source: <work>/src/video.mp4 (1920x1080, letterboxed: picture rows 170..909, no audio).
Writes <work>/clips/<name>.mp4 and <name>.json (per-frame face centre in output pixels).
Only red-carpet / event / candid moments are cut. The police, court and van footage in the source is deliberately unused.
"""
import json
import subprocess
import sys
from pathlib import Path

import cv2
import numpy as np

TOP, BOT = 170, 910
CH = BOT - TOP                       # 740 px of picture
VW = int(round(CH * 9 / 16 / 2) * 2)  # 416 px wide for 9:16
OUT_W, OUT_H = 1080, 1920

# name: (start s, end s, seed face x in source px, mode, zoom)  — zoom > 1 crops tighter
CLIPS = {
    "phone":   (51.1, 55.4, 690, "v", 1.0),
    "crowd":   (34.0, 38.7, 1320, "w", 1.0),
    "phone2":  (58.8, 62.4, 660, "v", 1.0),
    "white":   (63.0, 64.9, 900, "v", 1.0),
    "blacktee": (146.2, 148.6, 1530, "v", 1.0),
    "glow":    (12.2, 15.2, 900, "v", 1.0),
    "grin":    (27.0, 29.9, 990, "v", 1.0),
    "laugh":   (165.2, 167.8, 990, "v", 1.0),
    "wave":    (72.4, 74.8, 760, "v", 1.0),
    "sip":     (149.6, 151.9, 1260, "v", 1.0),
    "tee2":    (140.9, 142.9, 1290, "v", 1.0),
}


def main(work: Path):
    import mediapipe as mp

    det = mp.solutions.face_detection.FaceDetection(model_selection=1, min_detection_confidence=0.35)
    out_dir = work / "clips"
    out_dir.mkdir(exist_ok=True)
    only = set(sys.argv[2:])
    for name, (t0, t1, seed, mode, zoom) in CLIPS.items():
        if only and name not in only:
            continue
        cap = cv2.VideoCapture(str(work / "src" / "video.mp4"))
        cap.set(cv2.CAP_PROP_POS_MSEC, t0 * 1000)
        fps = cap.get(cv2.CAP_PROP_FPS)
        frames = []
        while cap.get(cv2.CAP_PROP_POS_MSEC) < t1 * 1000:
            ok, f = cap.read()
            if not ok:
                break
            frames.append(f[TOP:BOT])
        # face track: nearest detection to the previous centre, then smoothed both ways
        cx, cy = float(seed), CH * 0.38
        raw = []
        for f in frames:
            r = det.process(cv2.cvtColor(cv2.resize(f, (960, CH // 2)), cv2.COLOR_BGR2RGB))
            best = None
            if r.detections:
                for d in r.detections:
                    b = d.location_data.relative_bounding_box
                    x, y = (b.xmin + b.width / 2) * 1920, (b.ymin + b.height / 2) * CH
                    dist = abs(x - cx) + 0.5 * abs(y - cy)
                    if dist < 260 and (best is None or dist < best[2]):
                        best = (x, y, dist, b.width * 1920)
            if best:
                cx, cy = best[0], best[1]
            raw.append((cx, cy))
        xs = np.array([p[0] for p in raw])
        ys = np.array([p[1] for p in raw])
        k = 9
        ker = np.ones(k) / k
        xs = np.convolve(np.pad(xs, k // 2, mode="edge"), ker, mode="valid")
        ys = np.convolve(np.pad(ys, k // 2, mode="edge"), ker, mode="valid")
        track = []
        if mode == "v":
            w = VW / zoom
            h = CH / zoom
            W_, H_ = OUT_W, OUT_H
        else:
            w, h = 1920, CH
            W_, H_ = 1920, CH
        p = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{W_}x{H_}", "-r", f"{fps}", "-i", "-",
                              "-c:v", "libx264", "-preset", "slow", "-crf", "13", "-pix_fmt", "yuv420p", str(out_dir / f"{name}.mp4")], stdin=subprocess.PIPE)
        for f, x, y in zip(frames, xs, ys):
            x0 = int(np.clip(x - w / 2, 0, 1920 - w))
            y0 = int(np.clip(y - h * 0.4, 0, CH - h)) if zoom > 1 else 0
            crop = f[y0:y0 + int(h), x0:x0 + int(w)]
            if mode == "v":
                crop = cv2.bilateralFilter(crop, 5, 18, 5)
                up = cv2.resize(crop, (W_, H_), interpolation=cv2.INTER_CUBIC)
                bl = cv2.GaussianBlur(up, (0, 0), 2.0)
                up = cv2.addWeighted(up, 1.45, bl, -0.45, 0)
                s = W_ / w
                track.append(((x - x0) * s, (y - y0) * s))
            else:
                up = crop
                track.append((x, y))
            p.stdin.write(np.ascontiguousarray(up).tobytes())
        p.stdin.close()
        assert p.wait() == 0
        (out_dir / f"{name}.json").write_text(json.dumps({"fps": fps, "n": len(frames), "track": track}))
        print(name, len(frames), "frames", "x range", int(xs.min()), int(xs.max()), flush=True)


if __name__ == "__main__":
    main(Path(sys.argv[1]))
