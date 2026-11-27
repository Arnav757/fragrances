"""Body-outline widths from MediaPipe selfie/pose segmentation, for measurement overlays.

    from silhouette import body_mask, run_at
    mask = body_mask(img_bgr)               # HxW float 0..1
    x0, x1 = run_at(mask, y, x_center)      # left/right edge of the body run containing x_center at row y
"""
import cv2
import mediapipe as mp
import numpy as np

_pose = None


def body_mask(img_bgr: np.ndarray) -> np.ndarray:
    global _pose
    if _pose is None:
        _pose = mp.solutions.pose.Pose(static_image_mode=True, model_complexity=1, enable_segmentation=True)
    r = _pose.process(cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB))
    if r.segmentation_mask is None:
        raise RuntimeError("no person found")
    return cv2.GaussianBlur(r.segmentation_mask, (5, 5), 0)


def run_at(mask: np.ndarray, y: float, xc: float, thresh: float = 0.5) -> tuple[float, float]:
    row = mask[int(round(y))] > thresh
    x = int(round(xc))
    if not row[x]:
        raise ValueError(f"centre {x},{y} is not on the body")
    l = x
    while l > 0 and row[l - 1]:
        l -= 1
    r = x
    while r < len(row) - 1 and row[r + 1]:
        r += 1
    return float(l), float(r)


def measure(work: str, keys: list[str]) -> dict:
    """Shoulder / chest / waist and per-leg knee / ankle outline widths for full-body images, from landmarks.json."""
    import json
    from pathlib import Path

    from facemap import cover

    L = json.loads((Path(work) / "landmarks.json").read_text())
    out = {}
    for k in keys:
        img = cover(cv2.imread(str(Path(work) / "assets" / f"{k}.png")), 1080, 1920)
        m = body_mask(img)
        p = L[k]["pose"]
        P = lambda i: p[i][:2]  # noqa: E731
        sy = (P(11)[1] + P(12)[1]) / 2
        hy = (P(23)[1] + P(24)[1]) / 2
        cx = (P(11)[0] + P(12)[0] + P(23)[0] + P(24)[0]) / 4
        rows = {"shoulder": sy - 8, "chest": sy + 0.28 * (hy - sy), "waist": sy + 0.80 * (hy - sy)}
        res = {n: run_at(m, y, cx) for n, y in rows.items()}
        for side, (ki, ai) in {"L": (25, 27), "R": (26, 28)}.items():
            res[f"knee{side}"] = run_at(m, P(ki)[1], P(ki)[0])
            res[f"ankle{side}"] = run_at(m, P(ai)[1] - 40, P(ai)[0])
        out[k] = {n: (round(a), round(b), round(b - a)) for n, (a, b) in res.items()}
        out[k] |= {"rows": {n: round(y) for n, y in rows.items()}, "kneeY": round(P(25)[1]), "ankleY": round(P(27)[1] - 40)}
    return out


if __name__ == "__main__":
    import json
    import sys
    from pathlib import Path

    if len(sys.argv) < 3:
        sys.exit("usage: python studio/lib/silhouette.py <work_dir> <image_key> [...]   → <work_dir>/silhouette.json")
    res = measure(sys.argv[1], sys.argv[2:])
    (Path(sys.argv[1]) / "silhouette.json").write_text(json.dumps(res))
    for k, v in res.items():
        print(k, {n: x[2] for n, x in v.items() if isinstance(x, tuple)})
