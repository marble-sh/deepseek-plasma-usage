#!/bin/sh
# SPDX-FileCopyrightText: 2026 cassidy
# SPDX-License-Identifier: GPL-2.0-or-later
#
# Re-extracts the translatable strings from the widget into template.pot.
# Run this after adding, changing or removing an i18n() call, then update the
# tables in translate/messages/ and run translate/build.sh.
#
# Extraction runs in two passes because gettext needs a different parser for
# each language: QML is parsed as C++-like, the js/ modules as JavaScript.
# (Parsing the js/ modules with the C++ parser produces a spurious
# "unterminated character constant" warning for wallet.js's shell quoting.)
#
# Keywords are the KDE set: i18n(msgid), i18nc(context, msgid),
# i18np(msgid, plural), i18ncp(context, msgid, plural).

set -eu

DIR=$(cd -- "$(dirname -- "$0")" && pwd)
ROOT=$(cd -- "$DIR/.." && pwd)

KEYWORDS="-ci18n -ki18n:1 -ki18nc:1c,2 -ki18np:1,2 -ki18ncp:1c,2,3"
COMMON="--from-code=UTF-8 --width=200 --add-location=file --package-name=deepseek-usage -kde"

tmpdir=$(mktemp -d)
trap 'rm -rf "$tmpdir"' EXIT

# --- pass 1: QML ----------------------------------------------------------
# Relative paths so the "#:" references in the catalogues stay portable.
cd "$ROOT"
find contents -name '*.qml' | sort > "$DIR/infiles.list"
if [ -s "$DIR/infiles.list" ]; then
    xgettext $COMMON $KEYWORDS -C \
        --files-from="$DIR/infiles.list" \
        -o "$tmpdir/qml.pot"
fi

# --- pass 2: JavaScript ---------------------------------------------------
find contents -name '*.js' | sort > "$DIR/infiles.list"
if [ -s "$DIR/infiles.list" ]; then
    xgettext $COMMON $KEYWORDS --language=JavaScript \
        --files-from="$DIR/infiles.list" \
        -o "$tmpdir/js.pot"
fi

rm -f "$DIR/infiles.list"

# --- merge ----------------------------------------------------------------
set -- "$tmpdir"/*.pot
if [ "$#" -eq 1 ]; then
    cp "$1" "$DIR/template.pot"
else
    msgcat --use-first -o "$DIR/template.pot" "$@"
fi

printf 'Wrote %s (%s strings)\n' "$DIR/template.pot" "$(grep -c '^msgid ' "$DIR/template.pot")"
