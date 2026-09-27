<!--
    SPDX-FileCopyrightText: 2026 cassidy
    SPDX-License-Identifier: GPL-2.0-or-later
-->

## What changed, and why

<!-- The reasoning matters more than the diff: what problem does this solve, and
     what did you consider instead? -->

## Checklist

- [ ] `npm test` passes
- [ ] `npm run format:check` passes (or `npm run format` was run)
- [ ] `npm run lint:qml` passes
- [ ] `npm run check:po` passes
- [ ] The widget was loaded and looked at, not just built
- [ ] There is no credential, key or session token anywhere in this PR

If the UI changed:

- [ ] `tests/capture-screenshots.sh` was run and the images committed
- [ ] `tests/capture-locales.sh` was run for Hindi and Russian, which are the
      longest strings, and nothing overflows

If a string or translation changed:

- [ ] The tables in `translate/messages/` were edited, not the generated `.po`
      files
- [ ] The README translations, if the change affects them

If this settles a design question:

- [ ] `docs/decisions-log.md` has an entry saying why
