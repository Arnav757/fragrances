"""Cut the Saif reel's footage from the supplied phone screen recordings (1320x2868, 60 fps) into clean 9:16 clips.

    python studio/reels/saif_clips.py studio/work/saif [names...]

Each recording has app UI on top of the video (status bar, back/search icons, the right-hand like/comment column,
the caption and comment box); the crop windows below sit inside the clean picture area. Clips keep 60 fps so the reel
can slow them down smoothly. Writes <work>/clips/<name>.mp4 (1080x1920) + <name>.json (face track in output px).
"""
import json
import subprocess
import sys
from pathlib import Path

import cv2
import numpy as np

OUT_W, OUT_H = 1080, 1920
IG = dict(x0=25, y0=340, w=1119, h=1990)     # Instagram recordings: below the back/search row, left of the icon column, above the caption
YT = dict(x0=191, y0=540, w=979, h=1740)     # YouTube-in-browser recording: below the player's top bar, above the channel row

# name: (source, start s, end s, crop)
CLIPS = {
    "door":    ("v4.mov", 3.8, 7.7, IG),
    "carwalk": ("v4.mov", 8.4, 13.7, IG),
    "smirk":   ("v3.mov", 0.0, 4.7, IG),
    "shoes":   ("v3.mov", 5.0, 6.3, IG),
    "suit":    ("v3.mov", 6.45, 8.4, IG),
    "airport": ("v1.mp4", 0.0, 7.2, IG),
    "step":    ("v2.mp4", 0.0, 5.6, YT),
    "walk":    ("v2.mp4", 7.4, 14.8, YT),
}


def main(work: Path):
    import mediapipe as mp

    det = mp.solutions.face_detection.FaceDetection(model_selection=1, min_detection_confidence=0.4)
    out = work / "clips"
    out.mkdir(exist_ok=True)
    only = set(sys.argv[2:])
    for name, (src, t0, t1, c) in CLIPS.items():
        if only and name not in only:
            continue
        fps = 60.0
        vf = f"crop={c['w']}:{c['h']}:{c['x0']}:{c['y0']},scale={OUT_W}:{OUT_H}:flags=lanczos,fps={fps}"
        dec = subprocess.Popen(["ffmpeg", "-v", "error", "-ss", str(t0), "-t", str(t1 - t0), "-i", str(work / "src" / src), "-vf", vf,
                                "-f", "rawvideo", "-pix_fmt", "bgr24", "-"], stdout=subprocess.PIPE)
        p = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{OUT_W}x{OUT_H}", "-r", f"{fps}", "-i", "-",
                              "-c:v", "libx264", "-preset", "slow", "-crf", "14", "-pix_fmt", "yuv420p", str(out / f"{name}.mp4")], stdin=subprocess.PIPE)
        raw, n = [], 0
        cx, cy = OUT_W / 2, OUT_H * 0.3
        fsize = OUT_W * OUT_H * 3
        while True:
            buf = dec.stdout.read(fsize)
            if len(buf) < fsize:
                break
            fr = np.frombuffer(buf, np.uint8).reshape(OUT_H, OUT_W, 3)
            if n % 2 == 0:
                r = det.process(cv2.cvtColor(cv2.resize(fr, (540, 960)), cv2.COLOR_BGR2RGB))
                if r.detections:
                    best = max(r.detections, key=lambda d: d.location_data.relative_bounding_box.width)
                    b = best.location_data.relative_bounding_box
                    nx, ny = (b.xmin + b.width / 2) * OUT_W, (b.ymin + b.height / 2) * OUT_H
                    if abs(nx - cx) < 350 or n == 0:
                        cx, cy = nx, ny
            raw.append((cx, cy))
            p.stdin.write(fr.tobytes())
            n += 1
        dec.wait()
        p.stdin.close()
        assert p.wait() == 0
        xs, ys = np.array(raw).T
        k = 15
        ker = np.ones(k) / k
        xs = np.convolve(np.pad(xs, k // 2, mode="edge"), ker, mode="valid")
        ys = np.convolve(np.pad(ys, k // 2, mode="edge"), ker, mode="valid")
        (out / f"{name}.json").write_text(json.dumps({"fps": fps, "n": n, "track": list(zip(xs.tolist(), ys.tolist()))}))
        print(name, n, "frames @", round(fps, 2), flush=True)


if __name__ == "__main__":
    main(Path(sys.argv[1]))
