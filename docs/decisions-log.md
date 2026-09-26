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
| D18 | The Chinese-holiday table holds the **published schedule** (2026) and the widget reports **Unknown** rather than guessing | `CHINESE_HOLIDAYS` filled block-by-block with `addRange()` from the announced 2026 schedule; `state()` is tri-valued (`peak`/`offPeak`/`unknown`) and returns `unknown` when the table does not cover the year. Estimated future years are deliberately **not** added. | Revised from "ship an empty table": an empty table is *wrong* (not merely cautious) on the ~29 holiday days a year, and the user asked for accuracy. Guessing in either direction is a wrong answer, so the honest third state has to exist. | permanent |
| D19 | The per-key breakdown shows **only key names**, never the key id | The masked `sensitive_id` is no longer rendered. It is kept in the parsed data model (it is a grouping fallback in `api.js` and is asserted by tests). | User request: the masked id is not worth showing and it is still a fragment of a credential. | permanent |
| D20 | Evidence for the 2026 dates, and the block interpretation | Taken from publicholidays.cn, which cites the gov.cn release and flags 2027/2028 as *estimates*; only the fully-announced year was used. Each holiday's whole published **block** is listed (e.g. National Day 1–7 October), not just its statutory days. | DeepSeek is a Chinese company excluding its national holidays, the blocks are what the State Council publishes, and the user's own reference script used the same blocks. The reference script's 2025 list could not be verified from the same source, so it was not copied in — unused data that might be wrong is worse than absent data. | permanent |
| D21 | The scan horizon is **14 days**, not 8 | `SCAN_HORIZON_DAYS`; a test pins the Spring Festival case. | A holiday block can hold the schedule steady for over ten days (13 Feb 10:00 UTC → 24 Feb 01:00 UTC in 2026), so a 7- or 8-day horizon would have silently dropped the countdown every Spring Festival. | permanent |
| D22 | Two bugs found by rendering the new states, both fixed | (a) `readonly property real peakRemainingMs` coerces a JS `null` to `0`, so the unknown state rendered "Changes in 0 seconds" — the value is now kept in a JS block and the intermediate property is gone. (b) The 8-day horizon above. | Neither was reachable before the tri-state and the holiday data existed, which is exactly why they were rendered rather than assumed. | permanent |
| D23 | A test is used as the **maintenance alarm** for the holiday data | `the holiday table covers the current year` and `every covered year looks complete rather than half-filled` in `tests/peak.test.mjs`. | Accuracy has to be enforced by something that runs, not by a README line. The suite goes red as soon as the year rolls over, which is when the dates need adding anyway. | permanent |
| D24 | `nextChange` refuses to report a change it cannot substantiate | If the scan crosses an instant the holiday table does not cover, it returns `null` instead of reporting that instant as the change. Test: `nextChange refuses to scan across a gap in the holiday table`. | The end-of-window pre-check alone is not enough: a table with a missing year, or a horizon reaching past the announced years, can pass it and then report a boundary artefact as a rate change. Verified load-bearing — without the guard it returned `2026-12-31T16:00Z` (the China-day boundary), not a real change. | permanent |

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

### Verified during round 5 (level 1)

- `node --test` → **42/42** (26 api/format/wallet + 16 peak); `qmllint` → 0;
  `./translate/build.sh --check` → 0 (17 catalogues × 74 strings);
  `./install.sh` → 0. Re-run after the final documentation edit.
- The three states were **rendered on-device** rather than assumed: peak (red dot,
  `Peak`, countdown), off-peak (green dot), and unknown (neutral dot, `Unknown`,
  no countdown — the value that exposed the `null`-to-`0` coercion).

---

Round 6 — 2026-09-26 (CI, screenshots, README translations)

| # | Decision | Detail | Reasoning | Lifespan |
|---|----------|--------|-----------|----------|
| D25 | CI is four jobs on a stock Ubuntu runner, with **no Plasma or KDE packages** | `.github/workflows/ci.yml`: unit tests, `./translate/build.sh --check`, `qmllint`, and `./install.sh --pack` to prove the archive still builds. | Verified locally that Qt 6 `qmllint` resolves no imports (a bogus `import` still exits 0; a syntax error exits 255), so the QML job needs only `qt6-declarative-dev-tools`. The applet's logic is plain JS, so node runs it directly and every gate stays installable. | permanent |
| D26 | The holiday-table alarm runs **on a schedule, not on push** | `.github/workflows/holiday-alarm.yml`, monthly (`17 6 1 * *`) plus `workflow_dispatch`, running only `tests/peak.test.mjs`; a failure step writes the fix into the job summary. | The alarm is time-triggered, not change-triggered. A push-only run would never fire in the window where the table has gone stale, which is the only window that matters. | permanent |
| D27 | Screenshots are regenerated against the **dev mock**, never the live account | `PLATFORM_BASE` pointed at `tests/mock-platform-server.mjs` with a fake session token in KWallet; the popup additionally forced `preferredRepresentation: fullRepresentation`. Every edit reverted and confirmed by grepping for `TEMP-VERIFY` / `127.0.0.1:8731`. The panel chip is the compact representation, cropped from a `plasmawindowed` render. | The popup shows balances, so a live capture would publish them. In `full` mode the official endpoint is only a fallback, so pointing the platform base at the mock means the API key in KWallet is never sent anywhere. | permanent |
| D28 | One README translation **per language**; the regional catalogue variants share it | `README.{zh-CN,hi-IN,id-ID,fr-FR,ru-RU,es-ES}.md` plus English `README.md`, each carrying the identical badge row. Badge colour = the emoji flag's dominant colour; equal-height tricolours use the first non-white band, so France and Russia are both blue. | The app ships 17 catalogues but only 7 languages, so a file per regional variant would be six near-identical copies that drift immediately. `es-ES` is written in neutral Spanish to serve `es_419` and the four Latin-American codes. | until reviewed |

### Verified during round 6 (level 1)

- The seven README files were checked programmatically rather than by eye: the
extracted fenced-code regions are byte-identical to the English file's
(`diff` empty), the identifier counts match, and every relative link target
resolves on disk.
- The language-navigation block is byte-identical across all seven files.
- Both workflows parse under `yaml.safe_load`, and the CI file's four job ids are
as documented.
- The screenshots were captured and then **read back**: the popup shows the
aligned `Today`/`Last 30 days` columns, `Highest $1.29`, the `Off-peak` row with
a green dot and its countdown, and no masked key id (D19).

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
