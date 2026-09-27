#!/bin/sh
# SPDX-FileCopyrightText: 2026 cassidy
# SPDX-License-Identifier: GPL-2.0-or-later
#
# Move to the next version everywhere it is written down, so the three copies cannot
# disagree: package.json (what npm and `gh release` read), metadata.json's
# `KPlugin.Version` (what Plasma shows in the widget's About) and CHANGELOG.md.
#
#   scripts/bump-version.sh 0.1.2
#
# `tests/version.test.mjs` is the check that the three agree, and it is what the CI job
# and the pre-commit hook run. This is the way to keep them agreeing, because the part
# that goes wrong is remembering all three.
#
# It refuses three things, each of which has produced a bad release somewhere:
#
#   * a version that is not SemVer,
#   * one that is not greater than the current version,
#   * one with nothing under [Unreleased] -- an empty release section is a release
#     nobody can read, and the tag would still be pushed.
#
# It edits the values in place, so the files keep whatever formatting they have; the
# Prettier check is the thing that owns that.
set -eu

cd "$(dirname -- "$0")/.."

new=${1:-}
if [ -z "$new" ]; then
    echo "usage: bump-version.sh <version>   e.g. bump-version.sh 0.1.2" >&2
    exit 2
fi

printf '%s' "$new" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$' || {
    echo "bump-version.sh: '$new' is not a SemVer version" >&2
    exit 1
}

current=$(sed -n 's/.*"version": "\([^"]*\)".*/\1/p' package.json)
if [ -z "$current" ]; then
    echo "bump-version.sh: could not read the version from package.json" >&2
    exit 1
fi

# `sort -V` rather than string comparison, so 0.10.0 sorts above 0.9.0.
if [ "$(printf '%s\n%s\n' "$current" "$new" | sort -V | tail -1)" != "$new" ] || [ "$new" = "$current" ]; then
    echo "bump-version.sh: $new is not greater than the current version $current" >&2
    echo "  (edit the files by hand if you really mean to go backwards)" >&2
    exit 1
fi

if [ "$(awk '
    /^## \[Unreleased\]$/ { inside = 1; next }
    inside && /^## / { exit }
    inside && NF { print "has content"; exit }
' CHANGELOG.md)" != "has content" ]; then
    echo "bump-version.sh: CHANGELOG.md has nothing under [Unreleased] -- nothing to release" >&2
    exit 1
fi

today=$(date +%F)

# Anchored on the key alone rather than on indentation, and each key occurs once.
sed -i "s/\"version\": \"[^\"]*\"/\"version\": \"$new\"/" package.json
sed -i "s/\"Version\": \"[^\"]*\"/\"Version\": \"$new\"/" metadata.json
sed -i "s|^## \[Unreleased\]$|## [Unreleased]\\n\\n## [$new] - $today|" CHANGELOG.md

printf 'package.json    %s -> %s\n' "$current" "$new"
printf 'metadata.json   KPlugin.Version -> %s\n' "$new"
printf 'CHANGELOG.md    [Unreleased] is now the %s section, dated %s\n' "$new" "$today"
printf '\n'

# The guard, run rather than described.
node --test tests/version.test.mjs

cat <<EOF

Next:
  git add package.json metadata.json CHANGELOG.md
  git commit -m "..."
  git tag -s v$new -m "v$new"
  git push origin v$new      # the tag publishes the release
EOF
