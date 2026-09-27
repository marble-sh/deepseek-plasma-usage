#!/bin/sh
# SPDX-FileCopyrightText: 2026 cassidy
# SPDX-License-Identifier: GPL-2.0-or-later
#
# Compose the repository's social preview card, docs/images/social-preview.png.
#
#   scripts/social-preview.sh
#
# GitHub has no API for this image: it is uploaded once in the web UI, under
# Settings -> General -> Social preview. So the PNG is committed and this script
# exists so the card can be regenerated after a UI change instead of remade by
# hand in GIMP.
#
# GitHub wants 1280x640 and refuses anything over 1 MB; the card is exactly that
# size, and it is a flat-colour composition, so it lands far below the limit.
#
# Needs ImageMagick 7 (`magick`) and the DejaVu fonts, which is what a stock Linux
# box already has. The screenshots it mounts are the ones committed by
# tests/capture-screenshots.sh, so regenerate those first if the UI has changed.
set -eu

cd "$(dirname -- "$0")/.."

out=docs/images/social-preview.png
shot=docs/images/rich-mode.png
chip=docs/images/panel-mode.png

command -v magick >/dev/null 2>&1 || {
    echo "social-preview.sh: needs ImageMagick 7 (magick)" >&2
    exit 1
}

for image in "$shot" "$chip"; do
    [ -s "$image" ] || {
        echo "social-preview.sh: missing $image -- run tests/capture-screenshots.sh first" >&2
        exit 1
    }
done

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT INT TERM

# Colours: the panel's own background, DeepSeek's brand blue for the rule, and two
# greys that match the widget's popup text.
bg="#14161B"
accent="#4D6BFE"
ink="#F2F3F5"
muted="#A9B0BE"

# The popup, scaled down, with a hairline border so the rounded card reads against
# the background. It is placed so its clipped bottom edge falls exactly on the
# card's bottom edge: the capture is cropped there, and letting it bleed off the
# canvas reads as deliberate rather than as a cut.
magick "$shot" -resize 470x470 \
    -bordercolor "#2A2F3A" -border 1 "$work/shot.png"

# Everything on the left is drawn with -annotate rather than caption: so the
# wrapping and the baselines are explicit and the card does not reflow when a
# version of ImageMagick measures text slightly differently.
magick -background none -font DejaVu-Sans -pointsize 22 -kerning 1.2 -fill "$muted" \
    label:"UNOFFICIAL, UNAFFILIATED COMMUNITY WIDGET" "$work/eyebrow.png"

magick -size 1280x640 "xc:$bg" \
    -fill "$accent" -draw "rectangle 0,0 1280,10" \
    -gravity NorthWest \
    \( "$work/shot.png" \) -geometry +800+170 -composite \
    \( "$work/eyebrow.png" \) -geometry +82+150 -composite \
    \( "$chip" \) -geometry +84+445 -composite \
    -font DejaVu-Sans-Bold -pointsize 68 -fill "$ink" \
    -annotate +80+210 "DeepSeek Usage" \
    -font DejaVu-Sans -pointsize 30 -fill "$muted" \
    -annotate +82+330 "Balance and usage for every API key," \
    -annotate +82+368 "right on your Plasma panel" \
    -font DejaVu-Sans -pointsize 26 -fill "$ink" \
    -annotate +84+540 "Peak / off-peak rate  ·  daily sparkline" \
    -annotate +84+578 "7 languages  ·  no runtime dependencies" \
    -strip "$out"

identify -format 'social-preview.sh: %f %wx%h %B bytes\n' "$out"
