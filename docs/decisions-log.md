# Decisions log — DeepSeek Usage Plasmoid

Round 1 — 2026-09-26 (kickoff answers, LOCKED)

| # | Decision | Detail | Reasoning | Lifespan |
|---|----------|--------|-----------|----------|
| D1 | Data source = **C (hybrid)** | Default = official `GET /user/balance` with an API key. Optional rich mode = platform `api/v0` endpoints with a browser session token. | Official API has no usage endpoint; platform has usage but needs a session token. Hybrid degrades gracefully. | permanent |
| D2 | **Maximum data, judgement on layout** | Show balance, lifetime cost, today/period cost, tokens (in/out/cache), requests, per-key breakdown, and an estimated days-left. | User asked for "as much data as possible". | permanent |
| D3 | **KWallet** for the API key + session token; user supplied a test API key | `kwallet-query` read/write, wallet `kdewallet`, folder `Plasma`. | User chose KWallet. | permanent |
| D4 | id `org.deepseek.plasma.usage`, license **GPL-2.0+** | | User approved. | permanent |
| D5 | **Panel-first**; full detail in popup | Compact panel rep (icon + primary number); Full representation for the detailed view. | User: "If I can't have both, then Panel". | permanent |
| D6 | Runtime deps: **none** beyond Plasma/Qt | Network via QML `XMLHttpRequest`; secrets via `kwallet-query` through `plasma5support` executable engine; pure-JS parsing. `node:test` for tests (dev-only). | User's "minimal (preferably none) dependencies". | permanent |

## Ratified technical facts (from the user-supplied HAR + live probes)

- Platform endpoints (contract in `docs/state/api-contract.md`):
  `GET /api/v0/users/get_user_summary`, `GET /api/v0/usage/by_api_key/amount`,
  `GET /api/v0/usage/by_api_key/cost`. Auth = `authorization: Bearer <session token>` only.
- Platform API returns **HTTP 200 for auth failures** with `code:40003` → must
  branch on JSON `code`.
- Official `/user/balance` works with the supplied test key.

## SUPERSEDED
- (none)

---

Round 2 — 2026-09-26 (internationalization)

| # | Decision | Detail | Reasoning | Lifespan |
|---|----------|--------|-----------|----------|
| D7 | i18n via **gettext/KI18n**, in-package catalogue | Domain `plasma_applet_org.deepseek.plasma.usage`, `.mo` files committed under `contents/locale/<locale>/LC_MESSAGES/`. | The mechanism is proven live (see below); no system-wide install; `./install.sh` keeps working without gettext. | permanent |
| D8 | **`translate/messages/<locale>.json` is the source of truth**, `.po` files are generated | `generate.mjs` enforces completeness, plural counts and `%n` integrity. Escape hatch: adopting a translation platform makes the `.po` files authoritative and the tables redundant. | ~3× cheaper to author, structurally cannot drift from the pot, and the es/ru alias families stop being near-duplicate files. | until a platform is adopted |
| D9 | Locales shipped: **17** | The 12 requested (`zh_CN`, `en_IN`, `hi_IN`, `id_ID`, `fr_FR`, `ru_RU`, `ru_BY`, `es_ES`, `es_CL`, `es_AR`, `es_MX`, `es_CU`) plus bare-language aliases `ru`, `fr`, `id`, `hi` and `es_419`. No bare `es` (ES vs LA is genuinely ambiguous — better to fall back to English than to silently pick one). `es_CL/AR/MX/CU` are **deliberate aliases** of `es_419`: none of the current strings differ between them. | Region codes alone leave generic-`<lang>` users in English (Qt tries `<lang>_<REGION>` then `<lang>`). | permanent |
| D10 | Add **`msgctxt`** to the ambiguous short strings | Token-table row labels and the Save/Clear buttons. | `In`/`Out`/`Cost` are genuinely ambiguous for a translator without context. | permanent |
| D11 | `qmlformat --check` **dropped from the gauntlet** | It reorders imports alphabetically and strips the blank lines that group declarations, which fights the KDE QML style the project follows. `qmllint` remains the gate. | A gate that forces worse code is not a gate. | permanent |
| D12 | **Do not sign up to Crowdin/Transifex on the user's behalf** | Config files committed (`translate/crowdin.yml`, `translate/.tx/config`, both explicitly marked never-run) and the trade-offs documented instead. | Creating an account, applying for an open-source plan and inviting translators are human actions. Transifex's OSS terms were verified from its own page; Crowdin's page 404'd, so its terms are stated as unverified. KDE's own l10n/WebLate is noted as the most idiomatic route for a plasmoid. | permanent |

### Verified during round 2 (live, level 1)

- The in-package catalogue path works: a 3-string probe `.mo` at
  `contents/locale/es_CL/LC_MESSAGES/…` rendered translated strings under
  `LANG=es_CL.utf8` while untranslated strings stayed English.
- The domain is `plasma_applet_` + plugin id — confirmed against 3477
  `plasma_applet_*.mo` files in `/usr/share/locale/*/LC_MESSAGES/` and
  `Plasma::Applet::translationDomain()` in `libPlasma.so`.
- All 17 catalogues render correctly on-device (screenshots in the i18n
  commit message thread); Russian's three-form plural resolves correctly for
  n=30 (`за 30 дней`, form 2), and the Hindi/French plural forms resolve too.
- `translate/build.sh --check` was negative-tested: it fails on a hand-edited
  `.po` and on a hand-edited `.mo`, and passes when clean.
