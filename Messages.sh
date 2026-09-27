#! /usr/bin/env bash
# SPDX-FileCopyrightText: 2026 cassidy
# SPDX-License-Identifier: GPL-2.0-or-later
#
# Entry point for KDE's translation infrastructure. KDE's l10n scripts (Scripty)
# run this file with $XGETTEXT and $podir set, then merge the result into KDE's
# translation repositories. See translate/README.md for the whole route.
#
# $XGETTEXT already carries the KDE keyword set (-ki18n:1 -ki18nc:1c,2
# -ki18np:1,2 -ki18ncp:1c,2,3) and --from-code=UTF-8, hence the small
# invocation. The pot's basename is the message domain the applet loads at
# runtime, so it must stay plasma_applet_<KPlugin.Id>.
#
# QML and the js/ modules need different gettext parsers, exactly as in
# translate/merge.sh, so this runs twice and joins the results.

domain=plasma_applet_sh.marble.deepseek.usage
pot="$podir/$domain.pot"

$XGETTEXT $(find contents -name '*.qml' | sort) -C -o "$pot"

$XGETTEXT $(find contents -name '*.js' | sort) --language=JavaScript -j -o "$pot"
