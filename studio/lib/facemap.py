"""Body + face landmarks for still images, in output-canvas pixels.

    python studio/lib/facemap.py out.json img1.png img2.png ... [--size 1080x1920]

For each image: MediaPipe Pose (33 body points) and Face Mesh (478 points with irises), measured after
the image is fitted (cover) to the output canvas, so overlays can be drawn directly in render space.
Also writes derived measurements (shoulder/hip/ankle widths, eye line) used for overlays and alignment.
"""
import argparse
import json
import math

import cv2
import mediapipe as mp
import numpy as np


def cover(img: np.ndarray, W: int, H: int) -> np.ndarray:
    h, w = img.shape[:2]
    s = max(W / w, H / h)
    r = cv2.resize(img, (round(w * s), round(h * s)), interpolation=cv2.INTER_LANCZOS4)
    y, x = (r.shape[0] - H) // 2, (r.shape[1] - W) // 2
    return r[y : y + H, x : x + W]


def analyse(path: str, W: int, H: int, pose, face) -> dict:
    img = cover(cv2.imread(path), W, H)
    rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    out: dict = {"file": path}
    p = pose.process(rgb)
    if p.pose_landmarks:
        pts = [(l.x * W, l.y * H, l.visibility) for l in p.pose_landmarks.landmark]
        out["pose"] = [[round(x, 1), round(y, 1), round(v, 2)] for x, y, v in pts]
        P = lambda i: pts[i][:2]  # noqa: E731
        out["measure"] = {
            "shoulder_w": round(math.dist(P(11), P(12)), 1),
            "hip_w": round(math.dist(P(23), P(24)), 1),
            "ankle_w": round(math.dist(P(27), P(28)), 1),
            "shoulder_y": round((P(11)[1] + P(12)[1]) / 2, 1),
            "hip_y": round((P(23)[1] + P(24)[1]) / 2, 1),
        }
    f = face.process(rgb)
    if f.multi_face_landmarks:
        lm = f.multi_face_landmarks[0].landmark
        fp = [(l.x * W, l.y * H) for l in lm]
        out["face"] = [[round(x, 1), round(y, 1)] for x, y in fp]
        le = np.mean([fp[i] for i in (33, 133)], axis=0)
        re = np.mean([fp[i] for i in (362, 263)], axis=0)
        out["eyes"] = [[round(float(le[0]), 1), round(float(le[1]), 1)], [round(float(re[0]), 1), round(float(re[1]), 1)]]
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("out")
    ap.add_argument("images", nargs="+")
    ap.add_argument("--size", default="1080x1920")
    a = ap.parse_args()
    W, H = map(int, a.size.split("x"))
    res = {}
    with mp.solutions.pose.Pose(static_image_mode=True, model_complexity=1) as pose, mp.solutions.face_mesh.FaceMesh(
        static_image_mode=True, refine_landmarks=True, max_num_faces=1
    ) as face:
        for path in a.images:
            r = analyse(path, W, H, pose, face)
            res[path.rsplit("/", 1)[-1].rsplit(".", 1)[0]] = r
            m = r.get("measure", {})
            print(f"{path.rsplit('/', 1)[-1]:28} pose={'pose' in r} face={'face' in r} {m}")
    with open(a.out, "w") as fh:
        json.dump(res, fh)


if __name__ == "__main__":
    main()
