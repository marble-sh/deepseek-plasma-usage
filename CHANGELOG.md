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

Nothing user-visible yet. Internal work since 0.1.0: a dependency audit and a CodeQL
scan in CI, protection for `v*` release tags, a release workflow that publishes from
a tag, and the repository's community-health files.

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
