#!/bin/sh
# SPDX-FileCopyrightText: 2026 cassidy
# SPDX-License-Identifier: GPL-2.0-or-later
#
# Installs, upgrades, packs or removes the DeepSeek Usage widget for the
# current user.
#
#   ./install.sh              install (or upgrade) it
#   ./install.sh --pack       write deepseek-usage.plasmoid next to this script
#   ./install.sh --uninstall  remove it
#   ./install.sh --help

set -eu

PLUGIN_ID=org.deepseek.plasma.usage
HERE=$(cd -- "$(dirname -- "$0")" && pwd)
STAGE="$HERE/build/package"

help() {
    cat <<'EOF'
Installs, upgrades, packs or removes the DeepSeek Usage widget.

  ./install.sh              install (or upgrade) it for the current user
  ./install.sh --pack       write deepseek-usage.plasmoid next to this script
  ./install.sh --uninstall  remove it
  ./install.sh --help

Nothing is copied outside the user's KDE data directories; the widget has no
runtime dependencies beyond Plasma and Qt.
EOF
}

# KPackage wants a directory containing only the package, but the repository
# also holds docs and tests, so stage a clean copy first.
stage() {
    rm -rf "$STAGE"
    mkdir -p "$STAGE"
    cp "$HERE/metadata.json" "$STAGE/"
    cp -R "$HERE/contents" "$STAGE/"
}

case "${1:-}" in
--help | -h)
    help
    exit 0
    ;;
--uninstall)
    kpackagetool6 --type Plasma/Applet --remove "$PLUGIN_ID"
    exit 0
    ;;
--pack)
    stage
    OUT="$HERE/deepseek-usage.plasmoid"
    rm -f "$OUT"
    (cd "$STAGE" && zip -qr "$OUT" .)
    echo "Wrote $OUT"
    exit 0
    ;;
"")
    ;;
*)
    echo "install.sh: unknown option '$1'" >&2
    help >&2
    exit 2
    ;;
esac

stage

if kpackagetool6 --type Plasma/Applet --upgrade "$STAGE"; then
    echo "Upgraded $PLUGIN_ID"
else
    kpackagetool6 --type Plasma/Applet --install "$STAGE"
    echo "Installed $PLUGIN_ID"
fi
