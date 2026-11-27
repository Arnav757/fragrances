"""Align a generated clip to the still it was made from (Gemini/Veo often reframes slightly).

    python studio/lib/align.py <work> <clip.mp4> <clip_time> <still_key> pose|face  → prints a 2×3 matrix

Points are measured on both, cover-fitted to the 1080×1920 canvas: body (shoulders + hips) for full-length
shots, face (eye corners, nose tip, chin) for head-and-shoulders. A similarity transform (scale, rotation,
shift) maps the clip onto the still, so cutting from the still to the clip doesn't jump.
"""
import json
import sys
from pathlib import Path

import cv2
import mediapipe as mp
import numpy as np

from facemap import cover

POSE_IDS, FACE_IDS = (11, 12, 23, 24), (33, 263, 1, 152, 61, 291)


def points(bgr, kind):
    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
    h, w = bgr.shape[:2]
    if kind == "pose":
        with mp.solutions.pose.Pose(static_image_mode=True, model_complexity=1) as p:
            lm = p.process(rgb).pose_landmarks.landmark
        return np.array([[lm[i].x * w, lm[i].y * h] for i in POSE_IDS], np.float32)
    with mp.solutions.face_mesh.FaceMesh(static_image_mode=True, refine_landmarks=True) as f:
        lm = f.process(rgb).multi_face_landmarks[0].landmark
    return np.array([[lm[i].x * w, lm[i].y * h] for i in FACE_IDS], np.float32)


def frame_at(path, t):
    cap = cv2.VideoCapture(str(path))
    cap.set(cv2.CAP_PROP_POS_FRAMES, round(t * cap.get(cv2.CAP_PROP_FPS)))
    ok, f = cap.read()
    assert ok, f"no frame at {t}s"
    return cover(f, 1080, 1920)


def align(work, clip, t, still_key, kind):
    still = cover(cv2.imread(str(Path(work) / "assets" / f"{still_key}.png")), 1080, 1920)
    src, dst = points(frame_at(clip, t), kind), points(still, kind)
    M, _ = cv2.estimateAffinePartial2D(src, dst, method=cv2.LMEDS)
    err = np.linalg.norm((src @ M[:, :2].T + M[:, 2]) - dst, axis=1)
    return M, float(err.max())


if __name__ == "__main__":
    work, clip, t, key, kind = sys.argv[1], sys.argv[2], float(sys.argv[3]), sys.argv[4], sys.argv[5]
    M, err = align(work, clip, t, key, kind)
    s = float(np.hypot(*M[0, :2]))
    print(json.dumps({"matrix": M.tolist(), "scale": round(s, 4), "max_point_error_px": round(err, 1)}))
