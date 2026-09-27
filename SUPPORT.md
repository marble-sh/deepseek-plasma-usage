# Support

## Before asking

Most questions are answered in the documentation that already exists:

- **Installing, configuring, what the numbers mean, why a rate says "Unknown"** —
  [`README.md`](README.md), and its translation if your locale has one.
- **Which credential you need and what it exposes** — the Credentials section of
  the README. The API key gives the balance; the platform session token adds usage,
  and it is as powerful as your password.
- **The figures disagree with the platform website** — the README says why: the
  usage API is undocumented, cost and tokens are derived, and the platform itself
  rounds its per-day tooltips to cents.
- **Build failures, the gauntlet, formatting, how to release** —
  [`CONTRIBUTING.md`](CONTRIBUTING.md).
- **Translating, or reviewing a machine translation** —
  [`translate/README.md`](translate/README.md).

The widget's own About page shows the version Plasma loaded, which is the first
thing to quote in any report.

## Asking anyway

Open an issue using the bug report or feature request form. Those forms ask for the
things that otherwise turn into a round trip: Plasma and Qt versions, which
credential is configured, your locale, and the error text from the popup.

If your question is really "where does this number come from", include what
<https://platform.deepseek.com/usage> shows next to what the widget shows. That
comparison has found real bugs.

## What this project is not

Unofficial and unaffiliated with DeepSeek. Nothing here is endorsed by them, and
issues about their service, pricing or API changes belong with them — the widget
only reports what their APIs return.

There is no commercial support, no paid tier and no funding of any kind. It is a
spare-time project, so replies can take a few days.
