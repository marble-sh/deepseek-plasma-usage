# Changelog

Versions follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html), and the
format is [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

What the numbers mean here:

- **Major** — a change a user cannot ignore: a setting that changes meaning, a
  figure that starts or stops being shown, a credential the widget no longer
  accepts.
- **Minor** — new capability: another metric, another section, another locale.
- **Patch** — fixes and internal work: a wrong figure, a layout bug, a
  translation update, a dependency bump.

## [Unreleased]

### Added

- **The settings page says where the session token is, and opens the site that holds
  it.** A “How to get it” hint names the `userToken` entry and its DevTools path
  (Application/Storage → Local Storage) beside a button that opens
  `platform.deepseek.com` in the browser, so the token can be copied without hunting
  through the README first.

### Changed

- **Rich mode still needs a pasted session token: a username/password login is not
  possible and was not built.** The platform's login routes (`/auth-api/v0/*`) answer
  every request, browser-like or not, with an AWS WAF challenge that only a browser
  can pass, so no widget-side login window can work; the evidence and the A/B control
  are recorded in `docs/decisions-log.md` (D70). No password is stored.

### Fixed

- **The cost period can no longer be set past what the platform answers.** The
  settings offered 1–90 days, but the platform refuses any usage window longer than
  **31 days** with `code:0` and a business status of `INVALID_PARAM` — a refusal that
  arrives the same way for every token, so it reads as a broken credential. It is the
  second window bug of this kind: the replies carry no payload, and before the
  business-status handling landed both were reported as "Missing payload".
  `Api.MAX_USAGE_DAYS` is now the single ceiling, read by the spinner, the KConfigXT
  bound and the request, and a stored value above it is clamped rather than sent.
- **The session token is peeled no matter how it was copied.** `normalizeSessionToken`
  already handled the storage wrapper, a quoted copy and a whole `Bearer …` header, but
  not the wrapper whose quotes came out escaped (what `JSON.stringify(userToken)` in
  the console, or a log line, gives) or a hand-typed single-quoted object. Both still
  carry the wrapper's own `value` key, so both are peeled now; anything that does not
  begin with `{` is still returned untouched.

## [0.2.0] - 2026-09-27

### Added

- **Descriptions in every language the READMEs ship.** `metadata.json`
  `Description` is what the widget list and the default tooltip show, so a language
  with a README but no description is a language whose users see English in Plasma.
  `tests/metadata.test.mjs` now fails if a `README.<lang>.md` has no
  `Description[<locale>]`, or if that entry is still the English text.
- **`scripts/bump-version.sh`**, which moves the version in all three places it is
  written down — `package.json`, `metadata.json`'s `KPlugin.Version` and the newest
  `CHANGELOG.md` heading — and refuses the three ways that goes wrong: a version that
  is not SemVer, one that is not greater than the current one, and one with nothing
  under `[Unreleased]`.
- **Local git hooks** that run the CI jobs before a commit and a push, so a broken push
  is found in seconds rather than after a GitHub Actions round trip:
  `scripts/install-hooks.sh` points git at the tracked `scripts/hooks/`, and
  `scripts/gauntlet.sh` is the one implementation both hooks call.
- **Two guards for mistakes nothing was catching.** `translate/merge.sh --check` fails
  when an `i18n()` call has been added, changed or removed without re-extracting, which
  would otherwise leave a string out of the template and so out of all 17 catalogues.
  `tests/metadata.test.mjs` checks `metadata.json` against the keys KDE documents and
  against the plugin id's other four homes: the widget's namespace, the install
  script's `PLUGIN_ID`, the catalogue domain and the compiled `.mo` filenames.

### Fixed

- **A session token copied from the browser now works.** The platform's `userToken`
  entry stores a JSON object, `{"value":"…","__version":"0"}`, not the token, so
  copying it literally sent `Bearer {"value":…,"__version":"0"}` and the platform
  answered `Authorization Failed (invalid token)`. The widget unwraps the entry before
  use — as it does a quoted copy or a whole `Bearer …` header pasted from the network
  tab — and the READMEs now say which part of the entry is the token.
- **The usage window survives a daylight-saving change.** `start` was "local midnight
  N days ago" and `end` was tomorrow's, so a window spanning a transition was not
  exactly N days long and its two ends implied different offsets — while the request
  carries only one. The platform refused the whole window with `biz_code 1`,
  `INVALID_PARAM`. `start` is now derived from `end` by subtraction, which is also
  what the platform's own page asks for.
- **The platform's own reason is surfaced.** `parseEnvelope` honours the
  business-level `biz_code`/`biz_msg` inside `data`; reading only the outer `code`
  reported `INVALID_PARAM` as a generic "Missing payload", which named neither the
  fault nor the field at fault.

## [0.1.1] - 2026-09-27

Nothing inside the widget changed. This release is the documentation and the
repository around it, which is why it is a patch and not a minor: no new metric, no
new section, no locale.

### Added

- A **How to get the session token** section in all seven READMEs: where the value
  lives in the browser, and the name of the key it is stored under. The credentials
  table previously said only "the value the platform site keeps after you log in".

### Changed

- The **README screenshots render invented figures.** They were taken from a snapshot
  of a real account's usage page, which published that account's balance, its spend
  and the names of its API keys in every translated README.
- The development mock serves invented figures for the same reason, and its `--check`
  still recomputes every headline total from the same tables, so the fixture cannot
  drift from the numbers it declares.
- **Commits and tags are now signed** on `main` and on `v*`, the merge guard accepts
  squash only, and a separate ruleset requires a review from a code owner.

## [0.1.0] - 2026-09-26

First public release.

### Added

- Panel chip with a configurable metric (balance, today's spend, today's tokens,
  period spend, lifetime spend) and a peak / off-peak rate indicator.
- Popup with balance, today / period / lifetime spend, an estimated time left, a
  daily-spend sparkline, a token breakdown and a per-API-key breakdown.
- Two data sources: the official balance endpoint with an API key, and the
  platform usage API with a browser session token, falling back to the balance
  when the token stops working.
- Secrets in KWallet, never in the widget's configuration.
- 17 catalogues across 7 languages, with the README translated into each.
- Numbers, money and dates rendered in each locale's own conventions.
