#!/usr/bin/env bash
# Regenerate the Marketplace icon and hero image from their source SVGs.
# Sources of truth: assets/logo/icon.svg and assets/logo/hero.svg
# (logo direction 1a "Lens over lines"). Requires ImageMagick 7 (`convert`).
set -euo pipefail
cd "$(dirname "$0")/.."

convert -background none -density 384 assets/logo/icon.svg \
  -resize 128x128 -depth 8 -strip PNG32:assets/icon.png
echo "Wrote assets/icon.png ($(identify -format '%wx%h' assets/icon.png))"

# Marketplace / GitHub social-preview hero (1280x640)
convert -background none -density 144 assets/logo/hero.svg \
  -resize 1280x640 -depth 8 -strip PNG32:assets/hero.png
echo "Wrote assets/hero.png ($(identify -format '%wx%h' assets/hero.png))"
