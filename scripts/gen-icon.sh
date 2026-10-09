#!/usr/bin/env bash
# Regenerate the Marketplace icon (assets/icon.png) from the source SVG.
# Source of truth: assets/logo/icon.svg (logo direction 1a "Lens over lines").
# Requires ImageMagick 7 (`convert`).
set -euo pipefail
cd "$(dirname "$0")/.."

convert -background none -density 384 assets/logo/icon.svg \
  -resize 128x128 -depth 8 -strip PNG32:assets/icon.png

echo "Wrote assets/icon.png ($(identify -format '%wx%h' assets/icon.png))"
