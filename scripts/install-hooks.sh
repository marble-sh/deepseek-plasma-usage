#!/bin/sh
# SPDX-FileCopyrightText: 2026 cassidy
# SPDX-License-Identifier: GPL-2.0-or-later
#
# Turns on the repository's git hooks, so the CI jobs run locally before a push
# instead of after it.
#
#   scripts/install-hooks.sh              install
#   scripts/install-hooks.sh --uninstall  restore git's default hooks directory
#   scripts/install-hooks.sh --status     say what is set up, change nothing
#
# The hooks live in scripts/hooks/ and are tracked, so they are reviewable and stay in
# step with the workflows. Git only looks in .git/hooks by default, which cannot be
# tracked, so this points `core.hooksPath` at the tracked directory -- once per clone.
set -eu

cd "$(dirname -- "$0")/.."
ROOT=$(git rev-parse --show-toplevel)
HOOKS="$ROOT/scripts/hooks"

case "${1:-}" in
--status)
    current=$(git config --get core.hooksPath || true)
    if [ "$current" = "$HOOKS" ]; then
        echo "hooks are installed ($current)"
    elif [ -n "$current" ]; then
        echo "hooks are pointed elsewhere: $current"
    else
        echo "hooks are NOT installed (git is using .git/hooks)"
    fi
    exit 0
    ;;
--uninstall)
    if [ "$(git config --get core.hooksPath || true)" = "$HOOKS" ]; then
        git config --unset core.hooksPath
        echo "Uninstalled: git is back to .git/hooks"
    else
        echo "Nothing to uninstall: core.hooksPath was not $HOOKS"
    fi
    exit 0
    ;;
--help | -h)
    sed -n '5,13p' "$0" | sed 's/^# \{0,1\}//'
    exit 0
    ;;
"")
    ;;
*)
    echo "install-hooks.sh: unknown option '$1'" >&2
    exit 2
    ;;
esac

for hook in pre-commit pre-push; do
    [ -x "$HOOKS/$hook" ] || chmod +x "$HOOKS/$hook"
done

# Absolute, because a relative core.hooksPath is resolved against the working
# directory in some git versions and the repository root in others. Re-run this if the
# clone moves.
git config core.hooksPath "$HOOKS"

echo "Installed: core.hooksPath = $HOOKS"
echo
echo "  pre-commit  scripts/gauntlet.sh --fast   (tests, formatting, QML, catalogues, audit)"
echo "  pre-push    scripts/gauntlet.sh          (all of that plus the fixture and the package)"
echo
echo "Skip either with --no-verify. CI runs the same things and remains the authority."
