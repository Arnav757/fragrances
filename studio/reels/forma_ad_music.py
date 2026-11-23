"""Original 145 BPM percussive bed + sound design for forma_ad.py (synthesised, no samples).

    python studio/reels/forma_ad_music.py studio/work/ad/render/music.wav
"""
import sys

import numpy as np
import soundfile as sf

SR = 48000
BEAT = 60 / 145
DUR = 15.0
rng = np.random.default_rng(7)


def env(n, a=0.002, d=0.2):
    t = np.arange(n) / SR
    return np.minimum(1, t / a) * np.exp(-t / d)


def kick(g=1.0):
    n = int(0.45 * SR)
    t = np.arange(n) / SR
    f = 45 + 95 * np.exp(-t / 0.035)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return g * np.sin(ph) * env(n, 0.001, 0.16)


def hat(g=0.25, d=0.035):
    n = int(0.12 * SR)
    x = rng.standard_normal(n)
    x = np.diff(np.concatenate([[0], x]))  # crude high-pass
    return g * x * env(n, 0.0005, d)


def clap(g=0.5):
    n = int(0.25 * SR)
    x = rng.standard_normal(n)
    e = np.zeros(n)
    for o in (0, 0.009, 0.018):
        i = int(o * SR)
        e[i:] += env(n - i, 0.0008, 0.05 if o < 0.018 else 0.11)
    x = np.convolve(x, np.ones(6) / 6, mode="same")
    return g * x * e


def pop(f=880, g=0.35):
    n = int(0.16 * SR)
    t = np.arange(n) / SR
    fr = f * (1 + 0.6 * np.exp(-t / 0.01))
    return g * np.sin(2 * np.pi * np.cumsum(fr) / SR) * env(n, 0.001, 0.04)


def whoosh(length, g=0.35):
    n = int(length * SR)
    x = rng.standard_normal(n)
    out = np.zeros(n)
    # rising band: one-pole low-pass whose cutoff sweeps up
    y = 0.0
    cut = np.linspace(0.02, 0.45, n)
    for i in range(n):
        y += cut[i] * (x[i] - y)
        out[i] = y
    out -= np.convolve(out, np.ones(40) / 40, mode="same")
    return g * out * np.linspace(0, 1, n) ** 2


def tone(freqs, length, g=0.12, a=0.02, d=1.2):
    n = int(length * SR)
    t = np.arange(n) / SR
    x = sum(np.sin(2 * np.pi * f * t) + 0.3 * np.sin(4 * np.pi * f * t) for f in freqs) / len(freqs)
    return g * x * np.minimum(1, t / a) * np.exp(-t / d)


def bass(f, length, g=0.28):
    n = int(length * SR)
    t = np.arange(n) / SR
    x = np.tanh(2.2 * np.sin(2 * np.pi * f * t))
    return g * x * np.minimum(1, t / 0.004) * np.exp(-t / 0.12)


def place(buf, x, t):
    i = int(t * SR)
    j = min(len(buf), i + len(x))
    if i < len(buf):
        buf[i:j] += x[: j - i]


def main(out):
    L = np.zeros(int(DUR * SR) + SR)
    b = lambda n: n * BEAT  # noqa: E731
    # pencil tick + dot pop at the open
    place(L, pop(1200, 0.4), 0.0)
    place(L, hat(0.4, 0.02), 0.08)
    roots = [55.0, 43.65, 65.41, 49.0]  # A F C G
    for n in range(3, 31):
        t = b(n)
        place(L, kick(0.9 if n % 4 == 3 else 0.75), t)
        if n >= 6:
            place(L, hat(0.18), t + BEAT / 2)
        if n >= 10 and n % 2 == 1:
            place(L, clap(0.45), t)
        r = roots[((n - 3) // 4) % 4]
        place(L, bass(r, BEAT * 0.45), t)
        place(L, bass(r, BEAT * 0.3, 0.18), t + BEAT / 2)
    # rapid ticks through the half-beat montage
    for k in range(8):
        place(L, hat(0.32, 0.02), b(19) + k * BEAT / 2)
        place(L, pop(1600 + 120 * k, 0.12), b(19) + k * BEAT / 2)
    # whooshes into the two zooms through the dot
    place(L, whoosh(0.3), b(3) - 0.3)
    place(L, whoosh(0.28), b(8) - 0.28)
    # dot pops: ? dot, logo dot
    place(L, pop(980, 0.35), b(6) + 0.2)
    place(L, pop(700, 0.45), b(28) + 0.9)
    # logo: kick + resolving chord, then let it ring out
    place(L, kick(1.0), b(31))
    place(L, tone([220.0, 277.18, 329.63, 440.0], DUR - b(31), 0.16, 0.01, 1.4), b(31))
    L = L[: int(DUR * SR)]
    fade = int(0.25 * SR)
    L[-fade:] *= np.linspace(1, 0, fade)
    L /= max(1e-6, np.abs(L).max()) / 0.9
    sf.write(out, np.stack([L, L], 1), SR)
    print("wrote", out)


if __name__ == "__main__":
    main(sys.argv[1])
