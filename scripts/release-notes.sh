#!/bin/sh
# SPDX-FileCopyrightText: 2026 cassidy
# SPDX-License-Identifier: GPL-2.0-or-later
#
# Print one version's section from CHANGELOG.md, for a release's notes.
#
#   scripts/release-notes.sh 0.1.0
#
# Everything between "## [0.1.0] - <date>" and the next "## " heading, without the
# heading itself. Exits 1 with a message when the version has no section, so a tag
# cannot quietly publish empty notes.
set -eu

version=${1:-}
[ -n "$version" ] || {
    echo "usage: release-notes.sh <version>" >&2
    exit 2
}

cd "$(dirname -- "$0")/.."

notes=$(
    awk -v want="$version" '
        $0 ~ "^## \\[" want "\\]" { inside = 1; next }
        inside && /^## / { exit }
        inside { print }
    ' CHANGELOG.md
)

if [ -z "$(printf '%s' "$notes" | tr -d '[:space:]')" ]; then
    echo "release-notes.sh: CHANGELOG.md has no section for $version" >&2
    exit 1
fi

printf '%s\n' "$notes"
