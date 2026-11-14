#!/bin/sh
# Record the demo clips: ./demo.sh <out-dir> [edit defaults filters]. Needs the second instance
# (test-logseq-desktop) on :9333 with qb-e2e-persona open, and ffmpeg.
cd "$(dirname "$0")"
OUT="${1:?out dir}"; shift
FRAME="${FRAME:-$HOME/.claude/skills/test-logseq-desktop/scripts/frame.mjs}"
mkdir -p "$OUT"
for clip in "${@:-edit defaults filters}"; do for c in $clip; do
  CLIP="$c" OUT="$OUT/$c" node "$FRAME" demo.js --port 9333 --frame logseq-query-builder || exit 1
  [ -f "$OUT/$c/frames.txt" ] || { echo "no frames for $c" >&2; exit 1; }
  ffmpeg -y -loglevel error -f concat -safe 0 -i "$OUT/$c/frames.txt" -vf "fps=15,scale=1280:-2:flags=lanczos" -c:v libx264 -pix_fmt yuv420p -crf 22 -movflags +faststart "$OUT/query-builder-$c.mp4"
  echo "$OUT/query-builder-$c.mp4"
done; done
