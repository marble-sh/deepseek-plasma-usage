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

### Fixed

- **A session token copied from the browser now works.** The platform's `userToken`
  entry stores a JSON object, `{"value":"…","__version":"0"}`, not the token, so
  copying it literally sent `Bearer {"value":…,"__version":"0"}` and the platform
  answered `Authorization Failed (invalid token)`. The widget unwraps the entry before
  use — as it does a quoted copy or a whole `Bearer …` header pasted from the network
  tab — and the READMEs now say which part of the entry is the token.

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
