# Security policy

## What this widget touches

It is worth being precise about the risk surface, because it is small but not zero:

- It stores an **API key** and optionally a **platform session token** in KWallet.
  It never writes either to its configuration file, and it never logs them. The
  session token is as powerful as your password.
- It reaches KWallet by running `kwallet-query` through Plasma's executable data
  engine. That means the secret is interpolated into a shell command — it is
  base64-encoded and single-quoted rather than pasted raw, and `js/wallet.js`
  builds it, but it is the one place where a quoting mistake would matter.
- It talks to `api.deepseek.com` and `platform.deepseek.com` over HTTPS with
  `XMLHttpRequest`, and to nothing else. In rich mode the official endpoint is
  only a fallback.
- It renders figures, never HTML, so there is no injection path through the API's
  response beyond parsing numbers.

## Reporting a vulnerability

Use GitHub's private reporting: **<https://github.com/marble-sh/deepseek-plasma-usage/security/advisories/new>**

Please do not open a public issue for anything involving credentials, command
construction or the KWallet round-trip. A private advisory is visible only to the
maintainer until it is published, and it gives us a place to prepare a fix and a
release together.

Include what you can: the version (`plasmashell` reports it in the widget's About),
your Plasma and Qt versions, and the smallest reproduction you have. If the report
involves a credential, **rotate it first** and paste only the masked form.

Expect an acknowledgement within a few days — this is a spare-time project, so
please say so in the advisory if you need a faster response and a reason why.

## Supported versions

Fixes land on `main` and go out in the next release; there are no maintenance
branches. The newest release is the supported one.

## Out of scope

- **DeepSeek's own services.** The widget is unofficial and unaffiliated; an
  outage, a price change, or the platform API changing shape is not a
  vulnerability here. Report those as ordinary issues.
- **A credential you exposed yourself** — in an issue, a screenshot, a shell
  history, or on the platform. Rotate it on the DeepSeek site.
- **Someone with local access to your unlocked session.** KWallet being unlocked,
  or a keylogger, is outside what this widget can defend against.
- **A key with more scope than you intended.** The platform session token grants
  full account access; that is DeepSeek's design, and the widget says so in the
  README and in the settings page.
