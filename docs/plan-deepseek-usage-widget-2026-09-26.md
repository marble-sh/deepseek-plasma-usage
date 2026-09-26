# Plan — DeepSeek Usage Plasmoid (Plasma 6 widget)

**Status:** DECISIONS LOCKED (2026-09-26) — executing. See `docs/decisions-log.md`.
**Created:** 2026-09-26
**Recommended executor:** DeepSeek V4.1 Flash (thinking mode). Task is small,
well-scoped, pure-QML + vanilla JS; no architecture risk after D1 is settled.
**Resume / launch line:** `Read docs/state/session-state.md and this plan, then
execute the accepted phases in order.`

---

## 1. Goal

A minimal KDE Plasma 6 widget (plasmoid) showing DeepSeek API usage/balance,
built to be as small and light as possible with **zero runtime dependencies**
beyond Plasma/Qt, styled per the KDE guidelines the user supplied as
source-of-truth:

- `community.kde.org/Plasma/PlasmoidGuidelines`
- `community.kde.org/Plasma/Plasma_6` (visual-style sections)
- `community.kde.org/Plasma`

Reference example for structure/patterns: `NoriWeather-main/` (well-reviewed,
pure-QML, uses `XMLHttpRequest` in `.js` files, `PlasmoidItem` root).
Reference for modern conventions: `/usr/share/plasma/plasmoids/` installed
plasmoids (`org.kde.plasma.systemmonitor`, `org.kde.plasma.minimizeall`).

## 2. Verified facts (observed this session — level 1/2)

- **Environment:** `plasmashell 6.7.5`, Qt `6.11.2`, `kpackagetool6 2.0`,
  `plasmawindowed`, `qmllint`, `qmlformat`, `qml`/`qml6`/`qmlscene`, `node
v24.20.0`. No build step required for a pure-QML plasmoid.
- **DeepSeek documented API surface** (from `api-docs.deepseek.com/sitemap.xml`):
  chat completions, completions, responses, files (create/list/retrieve/delete),
  `list-models`, and `GET /user/balance`. **There is no usage/token endpoint.**
- `GET https://api.deepseek.com/user/balance` → **401** without a key ⇒ exists,
  API-key authenticated; returns `{is_available, balance_infos:[{currency,
total_balance, granted_balance, topped_up_balance}]}`.
- `https://platform.deepseek.com/usage` → **403 CloudFront** to non-browser
  clients (bot-blocked).
- `https://platform.deepseek.com/api/v0/*` → a FastAPI-style backend **does**
  exist (unknown paths return JSON `{"detail":"Not Found"}`), but routes are
  undocumented and no `/openapi.json` is exposed; the usage page is
  session-authenticated (browser login), not API-key authenticated.
- **Ruled out (dead ends, do not retry):**
    - Route guessing on `/api/v0/...` — 5 candidate paths all returned 404.
    - Scraping the SPA `index.html` / JS bundle — CloudFront 403 / 202 empty.

## 3. Decisions (LOCKED — full detail in `docs/decisions-log.md`)

- **D1 = C (hybrid).** Official balance via API key (default/reliable); platform
  `api/v0` usage via session token (optional rich mode).
- **D2 = maximum data.** Balance, lifetime cost, period cost, tokens
  (in/out/cache), requests, per-key breakdown, estimated days-left.
- **D3 = KWallet** (`kdewallet`, folder `Plasma`) via `kwallet-query`; test key
  supplied.
- **D4 = `org.deepseek.plasma.usage`, GPL-2.0+.**
- **D5 = panel-first**, full detail in popup.
- **D6 = zero runtime deps** beyond Plasma/Qt.

Endpoint contract (observed): `docs/state/api-contract.md`.

## 4. Assumed defaults (override on request)

- Runtime deps: **none** beyond Plasma/Qt QML modules. Network via
  `XMLHttpRequest` (proven in the NoriWeather example). No Python, no helper
  binaries, no SQLite.
- Styling: `PlasmaCore.Theme.textColor`, `Kirigami.Theme`/`Kirigami.Units`,
  `Kirigami.Icon` from the system icon theme, default applet background via
  `Plasmoid.backgroundHints`. All strings through `i18n()`.
- Refresh: bounded timer (default 5 min) + manual refresh action; balance
  endpoint is cheap but we still cap frequency.
- Dev tooling only: `node:test` (built-in, no npm install) for pure-JS units.

## 5. Proposed architecture (mode A/C)

```
metadata.json                         # KPackageStructure Plasma/Applet; X-Plasma-API-Minimum-Version 6.0
contents/
  ui/
    main.qml                          # PlasmoidItem: wires provider, tooltip, actions, representations
    CompactRepresentation.qml         # panel: icon + primary number; H/V form factors
    FullRepresentation.qml            # desktop/expanded: detail rows
    ConfigGeneral.qml                 # key/token, interval, metric selection
    js/
      api.js                          # pure: build URL/headers, parse JSON -> view model (unit-tested)
      format.js                       # pure: money/number/date formatting (unit-tested)
  config/
    main.xml                          # kcfg entries
    config.qml                        # config category model
docs/                                 # this plan + state
test/                                 # node:test specs for js/ (dev-only)
README.md  LICENSE  install.sh
```

Data flow: `provider QtObject` (timer + `XMLHttpRequest`) → validated JSON →
pure `api.js` parse → properties consumed by both representations and tooltip.

## 6. Phases

- **P0 Scaffold:** metadata.json + config + minimal `PlasmoidItem`; install via
  `kpackagetool6 --install`; confirm `plasmawindowed` renders.
- **P1 Pure JS + tests (TDD):** `format.js`, `api.js` parsing; failing tests
  first under `node --test`; watch red → green.
- **P2 Network layer:** fetch with timeout/HTTP-error/parse-error states;
  no secrets in logs.
- **P3 Representations:** compact (H/V) + full + tooltip; form-factor matrix.
- **P4 Config:** credential storage (D3), interval, metric selection.
- **P5 Style + i18n pass** against the three source-of-truth pages.
- **P6 Package + gauntlet:** install script, README, LICENSE, `.plasmoid`
  build; run full verification below.

## 7. Verification gauntlet (every commit)

1. `qmllint` on every `.qml` → exit code 0.
2. `node --test test/` → exit code 0.
3. `kpackagetool6 --install` (or `--upgrade`) → exit code 0.
4. `plasmawindowed <id>` renders without QML errors (smoke).
5. Live fetch: real key if provided (D3), else a local mock endpoint.

## 8. Risks / notes

- Mode B depends on an undocumented, session-authenticated API that can change
  without notice; a leaked session token grants full account access.
- No official "usage" semantics ⇒ any spend/burn figure is derived/estimated
  and must be labelled as such in the UI.
- KWallet may prompt / be unavailable in some sessions.
