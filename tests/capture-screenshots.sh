#!/bin/sh
# SPDX-FileCopyrightText: 2026 cassidy
# SPDX-License-Identifier: GPL-2.0-or-later
#
# Dev-only: regenerate the README screenshots, in every language the widget
# ships, against the mock platform API. It never talks to the live account.
#
#   tests/capture-screenshots.sh              # every language below
#   tests/capture-screenshots.sh zh_CN ru_RU  # just these
#
# For each locale it writes into docs/images/:
#
#   rich-mode[.<tag>].png   the popup, one per locale (FullRepresentation)
#   panel-mode.png          the panel chip, shared by every README
#
# where <tag> is the BCP-47 spelling of the locale (zh_CN -> zh-CN) and is
# omitted for English. The chip is deliberately not per-locale: with data present
# it renders only the formatted number, which is locale-independent, so seven
# pixel-identical files would imply a difference that does not exist. The popup
# is per-locale because its labels really are translated.
#
# Four things happen behind the scenes, all undone on exit by a trap:
#   * tests/mock-platform-server.mjs runs and PLATFORM_BASE points at it, so
#     the screenshots carry fake figures and the real key is never sent
#     anywhere (in "full" mode the official endpoint is only a fallback),
#   * the KWallet session token is backed up and replaced with a fake one,
#     because the widget needs *a* token to enter full mode,
#   * for the popup pass only, main.qml's preferredRepresentation is forced to
#     fullRepresentation — one installed copy can prefer only one, so the two
#     representations need two passes (and two installs),
#   * the widget is re-installed after every edit.
#
# Requires a running Plasma session, ImageMagick and Qt's `plasmawindowed`.
# The window is located by matching _NET_WM_PID, never by title, because the
# title is itself translated.
set -eu

ROOT=$(cd -- "$(dirname -- "$0")/.." && pwd)
cd "$ROOT"

PORT=8731
OUT=docs/images
WORK=$(mktemp -d)
MOCK_PID=

# ImageMagick 7 renamed the front end.
IM=convert
command -v magick >/dev/null 2>&1 && IM=magick

locales=${*:-"en_US zh_CN hi_IN id_ID fr_FR ru_RU es_ES"}

# en_US is always needed for the shared chip, whatever the caller asked for.
for locale in en_US $locales; do
    if ! locale -a | grep -qx "$locale.utf8"; then
        echo "capture-screenshots.sh: $locale.utf8 is not generated on this system" >&2
        echo "  (the widget would silently fall back to English)" >&2
        exit 1
    fi
done

cleanup() {
    [ -n "$MOCK_PID" ] && kill "$MOCK_PID" 2>/dev/null || true
    pkill -f 'plasmawindowed sh.marble.deepseek.usage' 2>/dev/null || true
    cp "$WORK/api.js" contents/ui/js/api.js 2>/dev/null || true
    cp "$WORK/main.qml" contents/ui/main.qml 2>/dev/null || true
    kwallet-query -w deepseek-session-token -f Plasma kdewallet < "$WORK/token" 2>/dev/null || true
    ./install.sh >/dev/null 2>&1 || true
    rm -rf "$WORK"
}
trap cleanup EXIT INT TERM

cp contents/ui/js/api.js "$WORK/api.js"
cp contents/ui/main.qml "$WORK/main.qml"
if ! kwallet-query -r deepseek-session-token -f Plasma kdewallet > "$WORK/token" 2>/dev/null; then
    : > "$WORK/token"
fi

# Point the platform client at the mock and give the widget a session token.
sed -i "s#^var PLATFORM_BASE = .*#var PLATFORM_BASE = \"http://127.0.0.1:$PORT/api/v0\";#" \
    contents/ui/js/api.js
node tests/mock-platform-server.mjs "$PORT" > "$WORK/mock.log" 2>&1 &
MOCK_PID=$!
sleep 1
printf '%s' mock-session-token | kwallet-query -w deepseek-session-token -f Plasma kdewallet

tag_for() {
    case $1 in
    en*) echo "" ;;
    *) echo ".$(printf '%s' "$1" | tr '_' '-')" ;;
    esac
}

# Renders the applet once for `locale` and captures its window to `$2`.
shoot() {
    locale=$1
    out=$2

    pkill -f 'plasmawindowed sh.marble.deepseek.usage' 2>/dev/null || true
    sleep 1

    QT_QPA_PLATFORM=xcb LANG="$locale.utf8" LANGUAGE="$locale" \
        plasmawindowed sh.marble.deepseek.usage > "$WORK/$locale.log" 2>&1 &
    pid=$!
    sleep 9

    window=""
    for id in $(xprop -root _NET_CLIENT_LIST 2>/dev/null | tr ',' '\n' | grep -o '0x[0-9a-f]*'); do
        wpid=$(xprop -id "$id" _NET_WM_PID 2>/dev/null | grep -o '[0-9]*$' || true)
        if [ "$wpid" = "$pid" ]; then
            window=$id
            break
        fi
    done

    if [ -z "$window" ]; then
        echo "  $locale: no window found (pid $pid)" >&2
        kill "$pid" 2>/dev/null || true
        return 1
    fi

    import -window "$window" "$out"
    kill "$pid" 2>/dev/null || true
    sleep 1
    echo "  $locale -> ${out#"$ROOT"/}"
}

# ---------------------------------------------------- pass 1: the panel chip
# The default (compact) representation, which is what a panel shows. Captured
# once, in English, because the chip carries no translatable text in the data
# state. The window is a large uniform canvas with a small centred chip, so trim
# the canvas away, put an even margin back, and round the corners so it reads as
# a panel chip.
./install.sh >/dev/null
shoot en_US "$WORK/panel.raw.png"
$IM "$WORK/panel.raw.png" -trim +repage -bordercolor '#202326' -border 14x13 "$WORK/panel.flat.png"
w=$($IM -format '%w' "$WORK/panel.flat.png" info:)
h=$($IM -format '%h' "$WORK/panel.flat.png" info:)
$IM "$WORK/panel.flat.png" \( +clone -alpha extract \
    -fill black -draw "rectangle 0,0 $w,$h" \
    -fill white -draw "roundrectangle 0,0 $((w - 1)),$((h - 1)) 9,9" \) \
    -alpha off -compose CopyOpacity -composite "$OUT/panel-mode.png"

# --------------------------------------------------------- pass 2: the popup
sed -i 's#^    preferredRepresentation: .*#    preferredRepresentation: fullRepresentation#' \
    contents/ui/main.qml
./install.sh >/dev/null
for locale in $locales; do
    tag=$(tag_for "$locale")
    shoot "$locale" "$OUT/rich-mode$tag.png"
done

echo "capture-screenshots.sh: done"
