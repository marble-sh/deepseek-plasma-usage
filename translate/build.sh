#!/bin/sh
# SPDX-FileCopyrightText: 2026 cassidy
# SPDX-License-Identifier: GPL-2.0-or-later
#
# Regenerates translate/*.po from the tables in translate/messages/ and compiles
# every catalogue into the package at
#
#     contents/locale/<locale>/LC_MESSAGES/plasma_applet_org.deepseek.plasma.usage.mo
#
# which is where Plasma looks for a plasmoid's own translations. The .mo files
# are committed, so ./install.sh works without gettext installed; this script
# only has to run when the strings or the translations change.
#
#   ./translate/build.sh            update .po and .mo
#   ./translate/build.sh --check    verify everything is up to date (CI use)

set -eu

DIR=$(cd -- "$(dirname -- "$0")" && pwd)
ROOT=$(cd -- "$DIR/.." && pwd)
DOMAIN=plasma_applet_org.deepseek.plasma.usage

tmpdir=$(mktemp -d)
trap 'rm -rf "$tmpdir"' EXIT

if [ "${1:-}" = "--check" ]; then
    # Fails if the .po files or LINGUAS would change.
    node "$DIR/generate.mjs" --check

    status=0
    for po in "$DIR"/*.po; do
        locale=$(basename "$po" .po)
        mo="$ROOT/contents/locale/$locale/LC_MESSAGES/$DOMAIN.mo"
        fresh="$tmpdir/$locale.mo"

        # The header warnings about the placeholder Language-Team are expected
        # until a real translation team adopts a catalogue, so only surface
        # msgfmt's output when it actually fails.
        if ! out=$(msgfmt --check --check-format -o "$fresh" "$po" 2>&1); then
            echo "$out" >&2
            status=1
            continue
        fi
        if [ ! -f "$mo" ]; then
            echo "missing ${mo#"$ROOT"/}" >&2
            status=1
        elif ! cmp -s "$fresh" "$mo"; then
            echo "stale ${mo#"$ROOT"/} (re-run translate/build.sh)" >&2
            status=1
        fi
    done

    if [ "$status" -ne 0 ]; then
        echo "translate/build.sh: catalogues are not up to date" >&2
        exit 1
    fi
    echo "translate/build.sh: all catalogues up to date"
    exit 0
fi

command -v msgfmt >/dev/null 2>&1 || {
    echo "translate/build.sh: msgfmt not found (install gettext)" >&2
    exit 1
}

node "$DIR/generate.mjs"

for po in "$DIR"/*.po; do
    locale=$(basename "$po" .po)
    target_dir="$ROOT/contents/locale/$locale/LC_MESSAGES"
    mkdir -p "$target_dir"
    msgfmt --check --check-format -o "$target_dir/$DOMAIN.mo" "$po" 2>/dev/null
    printf '  %-8s -> %s\n' "$locale" "${target_dir#"$ROOT"/}/$DOMAIN.mo"
done

echo "translate/build.sh: done"
