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
| D12 | **Do not sign up to Crowdin/Transifex on the user's behalf** | Config files committed (`translate/crowdin.yml`, `translate/.tx/config`, both explicitly marked never-run) and the trade-offs documented instead. | Creating an account, applying for an open-source plan and inviting translators are human actions. Transifex's OSS terms were verified from its own page; Crowdin's page 404'd, so its terms are stated as unverified. | permanent, but see D13 |
| D13 | Translation route = **KDE's own l10n teams** (user's choice) | `Messages.sh` added at the repo root as the entry point KDE's automation runs; `translate/README.md` documents the precondition (the widget must live in a KDE repository) and the ordered steps. Crowdin/Transifex configs demoted to a documented fallback. | It is the only route that produces **reviewed** translations by speakers of the language — the entire point of the exercise, given D14. | until the widget enters KDE |
| D14 | The machine-generated catalogues are **explicitly marked unreviewed**, with **hi/ru/zh as the review priority** | Every `.po` carries `Last-Translator: Unreviewed machine translation` and the gettext placeholder `Language-Team`; the README and `translate/README.md` say so prominently and name the priority languages. | They are unreviewed, and silently shipping them as if they were finished would misrepresent their quality. | until reviewed |

### Correction (recorded, not hidden)

Earlier in this session I described **WebLate** as the tool KDE uses. The KDE
wiki page I later read states that KDE stores translations in **SVN** and that
translators use **Lokalize**; it does not document WebLate. That claim was
unsupported and has been corrected in `translate/README.md` and `README.md`.
The `Infrastructure/Scripty` wiki page is empty, so the exact current procedure
for getting a project picked up by KDE's translation automation is **not
verified** and is flagged as such.

### Verified during round 3 (level 1)

- The KDE `Messages.sh` convention was taken from a real, installed KDE file
  (`/usr/share/sddm/themes/breeze/Messages.sh`: `$XGETTEXT … -o $podir/<domain>.pot`)
  rather than from memory.
- Our `Messages.sh` was **smoke-tested** with a simulated `$XGETTEXT`/`$podir`
  environment: it produces a pot containing the **same 70 msgids** as
  `translate/merge.sh` (`diff` of the sorted msgid sets is empty), named
  `plasma_applet_org.deepseek.plasma.usage.pot` — i.e. the two extraction paths
  agree and cannot drift.

---

Round 4 — 2026-09-26 (UI fixes)

| # | Decision | Detail | Reasoning | Lifespan |
|---|----------|--------|-----------|----------|
| D15 | The token and per-key tables use **one `GridLayout`**, never a layout per row | Cells are emitted as a flat list (`tokenCells`, `perKeyCells`) and placed by a single grid. | A per-row layout sizes its own columns from its own contents, so no two rows agreed on where a column ended — which is exactly the misalignment reported. A grid shares columns between rows. | permanent |
| D16 | Peak / off-peak **rate indicator** | Green/red dot on the panel chip; state plus time left in the popup and tooltip. Logic in new pure module `contents/ui/js/peak.js`, 10 unit tests. | The rate halves off-peak, so this is the one number that changes what the widget's figures *mean*. | permanent |
| D17 | The duration string comes from **`KCoreAddons.Format.formatSpelloutDuration`** | Not `formatDuration`, and not new i18n strings. | `formatDuration` returns a clock (`26:33:05`), which reads as a time of day for spans over 24 h. The spellout form keeps the two most significant units (`3 hours and 15 minutes`, `1 day and 2 hours`) and is localized by KDE's own translations, so it costs no new strings. | permanent |
| D18 | The Chinese-holiday table ships **empty** and the limitation is documented loudly | `CHINESE_HOLIDAYS` in `js/peak.js`; README explains the failure mode and how to fill it. | The State Council publishes the dates ~a month before each year and can revise them, and DeepSeek's pricing page states the rule without listing them. Shipping a stale 2025 list would be dead data that *looks* current; an empty table errs pessimistic and never claims a discount that is not there. | until the dates are published |
| D19 | The per-key breakdown shows **only key names**, never the key id | The masked `sensitive_id` is no longer rendered. It is kept in the parsed data model (it is a grouping fallback in `api.js` and is asserted by tests). | User request: the masked id is not worth showing and it is still a fragment of a credential. | permanent |

### Verified during round 4 (level 1)

- Column alignment was checked on-device with the platform mock:
  `Today`/`Last 30 days` now sit directly over their figures, and the per-key
  figures line up down the column.
- The peak countdown was checked **against the schedule, not just for
  presence**: at Sat 2026-09-26 22:27 UTC the widget read `26:33:05`, i.e.
  1 d 2 h 33 m, and an independent node computation of `msUntilChange` gave the
  same value with a next change of **Mon 2026-09-28 01:00 UTC** — the first peak
  window of the next weekday, as the documented rule requires.
- `KCoreAddons.Format.formatSpelloutDuration` was read back on-device for both
  a multi-day span (`1 day and 2 hours`) and a peak-window span
  (`3 hours and 15 minutes`).
- A real QML error was caught and fixed this way: assigning the `font` group and
  then `font.bold` on the same object is invalid
  ("Property has already been assigned a value"), which the per-key grid hit
  first.
- `node --test` is now 36 assertions (26 + 10 peak). One of the new tests was
  itself wrong at first — it asserted that the China-date conversion changes the
  answer, and checking that revealed it cannot, because both peak windows end
  before 16:00 UTC. The test now checks the conversion directly and says why.

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
