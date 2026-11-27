"""Word timestamps for a narration, checked against the script.

    python studio/lib/timeline.py voice_dir        # reads voice_dir/narration.wav, lines.json; writes words.json

Every script line must be heard back (≥ 85 % of its words, in its own time window). Lines that fail are
listed so they can be re-generated with:  python studio/lib/voice.py lines.txt voice_dir --only N
"""
import json
import os
import re
import sys
from pathlib import Path

CACHE = Path(os.environ.get("STUDIO_CACHE", Path.home() / ".cache" / "forma-studio"))
norm = lambda s: re.sub(r"[^a-z0-9]", "", s.lower())  # noqa: E731


def transcribe(wav: Path) -> list[dict]:
    from faster_whisper import WhisperModel

    m = WhisperModel(os.environ.get("STUDIO_WHISPER", "small.en"), device="cpu", compute_type="int8", download_root=str(CACHE / "whisper"))
    segs, _ = m.transcribe(str(wav), word_timestamps=True, vad_filter=False, condition_on_previous_text=False)
    return [{"word": w.word.strip(), "start": round(w.start, 3), "end": round(w.end, 3)} for s in segs for w in s.words]


def respell(words: list[dict], lines: list[dict]) -> list[dict]:
    """Keep Whisper's timings but the script's spelling (colour not color, tees not T's), so captions match the script.

    Script tokens are aligned to heard words per line with difflib; equal-length replace blocks map 1:1, and a
    script token heard as several words (Straight-leg → Straight, leg) takes the first word's start and last word's end.
    """
    import difflib

    out = []
    for ln in lines:
        seg = [w for w in words if w["start"] >= ln["start"] - 0.15 and w["end"] <= ln["end"] + 0.15]
        script = ln["text"].split()
        sm = difflib.SequenceMatcher(a=[norm(x) for x in script], b=[norm(w["word"]) for w in seg], autojunk=False)
        for op, i1, i2, j1, j2 in sm.get_opcodes():
            if op in ("equal", "replace") and (i2 - i1) == (j2 - j1):
                out += [{**seg[j1 + k], "word": script[i1 + k]} for k in range(i2 - i1)]
            elif op == "replace" and i2 - i1 == 1:
                out.append({"word": script[i1], "start": seg[j1]["start"], "end": seg[j2 - 1]["end"]})
            elif op == "replace" and j2 - j1 == 1:
                n = i2 - i1
                st, en = seg[j1]["start"], seg[j1]["end"]
                out += [{"word": script[i1 + k], "start": round(st + (en - st) * k / n, 3), "end": round(st + (en - st) * (k + 1) / n, 3)} for k in range(n)]
            elif op == "delete":  # script word not heard: give it a zero-length slot at the previous end
                t = out[-1]["end"] if out else ln["start"]
                out += [{"word": script[i1 + k], "start": t, "end": t} for k in range(i2 - i1)]
            # "insert" (heard but not in script) is dropped
    return out


def main():
    vd = Path(sys.argv[1])
    words = transcribe(vd / "narration.wav")
    lines = json.loads((vd / "lines.json").read_text())
    bad = []
    for ln in lines:
        heard = {norm(w["word"]) for w in words if w["start"] >= ln["start"] - 0.15 and w["end"] <= ln["end"] + 0.15}
        # hyphenated script words may come back split ("Straight-leg" → "Straight", "-leg")
        want = [norm(x) for x in re.split(r"[\s]+", ln["text"]) if norm(x)]
        got = sum(1 for x in want if x in heard or any(x.startswith(h) and h for h in heard))
        score = got / len(want)
        flag = "ok " if score >= 0.85 else "BAD"
        print(f"  {flag} line {ln['line']}: {score:.0%}  {ln['text']}")
        if score < 0.85:
            bad.append(ln["line"])
    words = respell(words, lines)
    (vd / "words.json").write_text(json.dumps(words, indent=0))
    print(f"{len(words)} words → {vd / 'words.json'}")
    if bad:
        print("re-generate:", " ".join(f"--only {n}" for n in bad))
        sys.exit(2)


if __name__ == "__main__":
    main()
