"""Original score + sound design for scimplify_mreo.py (synthesised, no samples), mixed with the footage's ambience.

    python studio/reels/scimplify_mreo_audio.py studio/work/scimplify
"""
import subprocess
import sys
from pathlib import Path

import numpy as np
import soundfile as sf

SR = 48000
DUR = 23.5
CUTS = [3.167, 6.083, 10.0, 13.167, 14.458, 16.0, 17.917]
BPM = 96
BEAT = 60 / BPM
rng = np.random.default_rng(11)


def t_(n):
    return np.arange(n) / SR


def env(n, a, d):
    t = t_(n)
    return np.minimum(1, t / max(a, 1e-4)) * np.exp(-t / d)


def lowpass(x, alpha):
    y = np.zeros_like(x)
    acc = 0.0
    for i, v in enumerate(x):
        acc += alpha * (v - acc)
        y[i] = acc
    return y


def pad(freqs, length, swell=2.0):
    n = int(length * SR)
    t = t_(n)
    x = np.zeros(n)
    for f in freqs:
        for det in (-0.12, 0.0, 0.12):  # slight detune for width
            x += np.sin(2 * np.pi * (f + det) * t + rng.uniform(0, 6.28))
            x += 0.25 * np.sin(2 * np.pi * 2 * (f + det) * t)
    x /= len(freqs) * 3
    return x * np.minimum(1, t / swell)


def pulse(f=55, g=0.5):
    n = int(0.5 * SR)
    t = t_(n)
    fr = f + 40 * np.exp(-t / 0.03)
    return g * np.sin(2 * np.pi * np.cumsum(fr) / SR) * env(n, 0.003, 0.18)


def tick(f=2400, g=0.12):
    n = int(0.08 * SR)
    return g * np.sin(2 * np.pi * f * t_(n)) * env(n, 0.0005, 0.012)


def whoosh(length, g=0.3):
    n = int(length * SR)
    x = rng.standard_normal(n)
    y = np.zeros(n)
    acc = 0.0
    cut = np.linspace(0.01, 0.25, n)
    for i in range(n):
        acc += cut[i] * (x[i] - acc)
        y[i] = acc
    return g * y * np.linspace(0, 1, n) ** 2.2


def boom(g=0.6):
    n = int(1.6 * SR)
    t = t_(n)
    fr = 38 + 30 * np.exp(-t / 0.08)
    body = np.sin(2 * np.pi * np.cumsum(fr) / SR) * env(n, 0.004, 0.55)
    air = lowpass(rng.standard_normal(n), 0.05) * env(n, 0.002, 0.25) * 0.6
    return g * (body + air)


def shimmer(freqs, length, g=0.12):
    n = int(length * SR)
    t = t_(n)
    x = sum(np.sin(2 * np.pi * f * t) * (1 + 0.3 * np.sin(2 * np.pi * 5.5 * t + k)) for k, f in enumerate(freqs)) / len(freqs)
    return g * x * np.minimum(1, t / 0.02) * np.exp(-t / 1.6)


def place(buf, x, at):
    i = int(at * SR)
    j = min(len(buf), i + len(x))
    if 0 <= i < len(buf):
        buf[i:j] += x[: j - i]


def main(work: Path):
    n = int(DUR * SR)
    music = np.zeros(n)
    # harmony: A minor → F → C → G, one chord per process section, sustained pads
    chords = [(0.0, [110.0, 164.81, 220.0, 261.63]), (6.083, [87.31, 130.81, 174.61, 220.0]), (13.167, [130.81, 196.0, 261.63, 329.63]),
              (17.917, [98.0, 146.83, 196.0, 246.94])]
    for i, (st, fr) in enumerate(chords):
        en = chords[i + 1][0] + 0.8 if i + 1 < len(chords) else 20.4
        p = pad(fr, en - st, 1.2 if i else 2.5)
        fade = int(0.8 * SR)
        p[-fade:] *= np.linspace(1, 0, fade)
        place(music, 0.16 * lowpass(p, 0.25), st)
    # pulse from the first cut, building through the process
    t = 3.167
    k = 0
    while t < 19.3:
        g = 0.22 + 0.25 * min(1, (t - 3) / 14)
        place(music, pulse(55, g), t)
        if t > 10:
            place(music, tick(3200, 0.05), t + BEAT / 2)
        t += BEAT
        k += 1
    # cuts: riser into each, soft boom on it, tick when the stage tile rolls
    for c in CUTS:
        place(music, whoosh(0.45, 0.16), c - 0.45)
        place(music, boom(0.32), c)
        place(music, tick(2600, 0.1), c + 0.02)
    # opening: tile frame draws + title
    place(music, tick(1800, 0.1), 0.35)
    place(music, shimmer([440.0, 659.25], 2.5, 0.05), 0.2)
    # white wipe into the end card, logo resolves
    place(music, whoosh(0.75, 0.3), 19.25)
    place(music, boom(0.55), 20.0)
    place(music, shimmer([220.0, 277.18, 329.63, 440.0, 659.25], 3.5, 0.16), 20.0)
    place(music, tick(2200, 0.12), 20.55)
    place(music, tick(2900, 0.12), 21.25)

    # footage ambience (Gemini's lab sound) under the score, faded before the card
    amb = np.zeros(n)
    a_path = work / "render" / "amb.wav"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(work / "in" / "src.mp4"), "-vn", "-ac", "1", "-ar", str(SR), str(a_path)], check=True)
    a, _ = sf.read(a_path)
    a = a[: int(20.0 * SR)]
    a[-int(0.8 * SR):] *= np.linspace(1, 0, int(0.8 * SR))
    amb[: len(a)] = a
    mix = music + 0.55 * amb / max(1e-6, np.abs(amb).max()) * 0.35
    fade = int(0.6 * SR)
    mix[-fade:] *= np.linspace(1, 0, fade)
    mix /= np.abs(mix).max() / 0.9
    out = work / "render" / "audio.wav"
    sf.write(out, np.stack([mix, mix], 1), SR)
    print("wrote", out)


if __name__ == "__main__":
    main(Path(sys.argv[1]))
