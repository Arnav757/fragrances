#!/usr/bin/env bash
# One-time setup for the FORMA content studio (Claude Code on macOS or Linux).
# Installs: the reanimate + video-making skills, a Python 3.11 env with the voice/vision/drawing
# tools, the fonts, and pre-downloads the speech models. Safe to re-run.
#
#   bash studio/setup.sh            # everything
#   STUDIO_SKIP_CHATTERBOX=1 bash studio/setup.sh   # skip the large Chatterbox/PyTorch install
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HERE/.." && pwd)"
SKILLS="$HOME/.claude/skills"
VENV="${STUDIO_VENV:-$HOME/.venvs/studio}"
REANIMATE_COMMIT="3f7a55a2986a84ca2173e86ee9127eefe31d046d"   # pinned; reviewed 2026-11-21
FONT_DIR="$HOME/.local/share/fonts/studio"; [[ "$(uname)" == "Darwin" ]] && FONT_DIR="$HOME/Library/Fonts"

say() { printf "\n\033[1m▸ %s\033[0m\n" "$*"; }
need() { command -v "$1" >/dev/null || { echo "Missing: $1. $2"; exit 1; }; }

say "Checking prerequisites"
need git "Install Xcode Command Line Tools (macOS) or git."
need ffmpeg "macOS: brew install ffmpeg · Linux: apt-get install ffmpeg"
command -v bun >/dev/null || { echo "Installing bun…"; npm i -g bun; }
command -v uv >/dev/null || { echo "Installing uv…"; curl -LsSf https://astral.sh/uv/install.sh | sh; export PATH="$HOME/.local/bin:$PATH"; }

say "Skill: reanimate (pinned $REANIMATE_COMMIT)"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
git clone -q https://github.com/NiazMorshed2007/reanimate "$TMP/reanimate"
git -C "$TMP/reanimate" checkout -q "$REANIMATE_COMMIT"
mkdir -p "$SKILLS"; rm -rf "$SKILLS/reanimate"; cp -r "$TMP/reanimate/skills/reanimate" "$SKILLS/"
bash "$SKILLS/reanimate/scripts/setup.sh"

say "Skill: video-making"
mkdir -p "$SKILLS/video-making"; cp "$HERE/skills/video-making/SKILL.md" "$SKILLS/video-making/SKILL.md"

say "Python 3.11 env at $VENV"
uv venv -q --allow-existing --python 3.11 "$VENV"
# shellcheck disable=SC1091
source "$VENV/bin/activate"
# pkuseg (a Chatterbox dependency) needs numpy at build time but doesn't declare it.
uv pip install -q "numpy==1.26.4" "setuptools<81" wheel cython
uv pip install -q -r "$HERE/requirements.txt"
if [[ -z "${STUDIO_SKIP_CHATTERBOX:-}" ]]; then
  uv pip install -q --no-build-isolation "pkuseg==0.0.25"
  if [[ "$(uname)" == "Darwin" ]]; then
    uv pip install -q -r "$HERE/requirements-voice.txt"           # Apple Silicon uses MPS automatically
  else
    uv pip install -q --extra-index-url https://download.pytorch.org/whl/cpu --index-strategy unsafe-best-match \
      "torch==2.6.0+cpu" "torchaudio==2.6.0+cpu" -r "$HERE/requirements-voice.txt"
  fi
fi

say "Fonts → $FONT_DIR"
mkdir -p "$FONT_DIR"
B=https://raw.githubusercontent.com/google/fonts/main/ofl
for p in "playfairdisplay/PlayfairDisplay%5Bwght%5D.ttf" "playfairdisplay/PlayfairDisplay-Italic%5Bwght%5D.ttf" \
         "ibmplexmono/IBMPlexMono-Regular.ttf" "ibmplexmono/IBMPlexMono-Medium.ttf" "ibmplexmono/IBMPlexMono-SemiBold.ttf" \
         "syne/Syne%5Bwght%5D.ttf"; do
  n="$(basename "$p" | sed 's/%5B/[/; s/%5D/]/')"
  [[ -f "$FONT_DIR/$n" ]] || curl -sfL "$B/$p" -o "$FONT_DIR/$n"
done
command -v fc-cache >/dev/null && fc-cache -f "$FONT_DIR" >/dev/null 2>&1 || true

say "Models (downloaded once, cached)"
python "$HERE/tools/fetch_models.py"

say "Self-test"
python "$HERE/tools/selftest.py"
echo
echo "Studio ready. Activate with: source $VENV/bin/activate"
