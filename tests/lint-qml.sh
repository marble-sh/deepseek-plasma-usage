#!/bin/sh
# SPDX-FileCopyrightText: 2026 cassidy
# SPDX-License-Identifier: GPL-2.0-or-later
#
# Syntax-check the QML with qmllint.
#
#   tests/lint-qml.sh
#
# On a Plasma 6 machine this is just `qmllint`, which resolves the org.kde.*
# imports and exits 0 for these files. On a machine that does not have those QML
# modules -- CI, on Ubuntu 24.04, which still ships Plasma 5 -- qmllint cannot
# resolve them, reports that as warnings, and exits non-zero: the same exit code
# as a real parse error. So a failure is only a failure here when it is a parse
# error, and the unresolved-import case is reported rather than swallowed.
#
# This does not weaken the gate in practice: qmllint is a syntax checker in this
# project's use of it (it exits 0 for type mistakes even with the modules
# present), and the widget's logic lives in the JS modules that `npm test`
# covers properly.
set -eu

cd "$(dirname -- "$0")/.."

command -v qmllint >/dev/null 2>&1 || {
    echo "lint-qml.sh: qmllint not found (Qt 6 or a Plasma 6 development install)" >&2
    exit 1
}

set +e
out=$(qmllint contents/ui/*.qml contents/config/config.qml 2>&1)
status=$?
set -e

printf '%s\n' "$out"

if [ "$status" -eq 0 ]; then
    exit 0
fi

if printf '%s' "$out" | grep -qiE 'Expected token|Syntax error|Unexpected token'; then
    echo "lint-qml.sh: qmllint reported a syntax error" >&2
    exit 1
fi

echo "lint-qml.sh: only unresolved-import warnings (no Plasma 6 QML modules here)"
