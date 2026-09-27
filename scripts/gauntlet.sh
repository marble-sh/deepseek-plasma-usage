#!/bin/sh
# SPDX-FileCopyrightText: 2026 cassidy
# SPDX-License-Identifier: GPL-2.0-or-later
#
# Runs the CI jobs locally, so a push does not have to wait for GitHub Actions to
# answer. The bracketed names are the required status checks each step stands in for;
# keeping the mapping explicit is the point, because a check that exists only in CI is
# a check nobody runs.
#
#   scripts/gauntlet.sh          everything (what the pre-push hook runs)
#   scripts/gauntlet.sh --fast   the quick subset (what the pre-commit hook runs)
#
# These run against the *working tree*, like CI runs against a commit. Anything
# unstaged is therefore included, which is the useful half of the trade: the failure
# is real, it just may not be in what you are about to commit.
#
# Not covered: Analyze JavaScript (CodeQL). It needs the CodeQL bundle, a large
# download of its own, so `gh run watch` after pushing is the honest answer for it.
set -u

cd "$(dirname -- "$0")/.." || exit 2

fast=
if [ "${1:-}" = "--fast" ]; then
    fast=1
fi

failures=0

step() {
    name=$1
    shift
    printf '\n== %s\n' "$name"
    if "$@"; then
        printf '   ok\n'
    else
        printf '   FAILED\n' >&2
        failures=$((failures + 1))
    fi
}

if [ ! -d node_modules ]; then
    printf 'scripts/gauntlet.sh: node_modules is missing -- run `npm install` first.\n' >&2
    exit 2
fi

step "Unit tests (node)" npm test
step "Prettier" npm run --silent format:check
step "QML syntax" npm run --silent lint:qml
step "Translations up to date (catalogues)" npm run --silent check:po
step "Translations up to date (template.pot)" npm run --silent check:pot
step "Dependency audit" npm run --silent audit

if [ -z "$fast" ]; then
    step "the development fixture still reconciles" node tests/mock-platform-server.mjs --check
    step "Pack the plasmoid" ./install.sh --pack
    # The CI job asserts the archive is not empty; so does this.
    if [ -s deepseek-usage.plasmoid ]; then
        printf '   deepseek-usage.plasmoid is %s bytes\n' "$(wc -c < deepseek-usage.plasmoid | tr -d ' ')"
    else
        printf '   FAILED: deepseek-usage.plasmoid is missing or empty\n' >&2
        failures=$((failures + 1))
    fi
fi

if [ "$failures" -gt 0 ]; then
    printf '\nscripts/gauntlet.sh: %s check(s) failed.\n' "$failures" >&2
    exit 1
fi

printf '\nscripts/gauntlet.sh: everything passed'
if [ -n "$fast" ]; then
    printf ' (fast subset; the pre-push hook runs the rest)'
fi
printf '.\n'
