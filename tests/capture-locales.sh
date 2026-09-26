#!/bin/sh
# Dev-only: render the applet once per locale and save a screenshot, so the
# translations can be checked for mojibake and for layout overflow (Hindi and
# Russian strings are much longer than the English originals).
#
# The window title is itself translated, so the window is located by matching
# _NET_WM_PID against the plasmawindowed process instead of by name.
#
#   tests/capture-locales.sh <out-dir> <locale> [locale...]
#
# Requires a running session and ImageMagick's `import`.
set -eu

OUT=$1
shift
mkdir -p "$OUT"
ROOT=$(cd -- "$(dirname -- "$0")/.." && pwd)

capture() {
    locale=$1
    pkill -f 'plasmawindowed org.deepseek.plasma.usage' 2>/dev/null || true
    sleep 1

    QT_QPA_PLATFORM=xcb LANG="$locale.utf8" LANGUAGE="$locale" \
        plasmawindowed org.deepseek.plasma.usage >"$OUT/$locale.log" 2>&1 &
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

    if [ -n "$window" ]; then
        import -window "$window" "$OUT/$locale.png" && echo "  $locale: captured $window"
    else
        echo "  $locale: NO WINDOW FOUND (pid $pid)" >&2
    fi

    kill "$pid" 2>/dev/null || true
    sleep 1
}

cd "$ROOT"
for locale in "$@"; do
    capture "$locale"
done

pkill -f 'plasmawindowed org.deepseek.plasma.usage' 2>/dev/null || true
echo "captured into $OUT"
