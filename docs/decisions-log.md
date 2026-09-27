# Decisions log — DeepSeek Usage Plasmoid

Round 1 — 2026-09-26 (kickoff answers, LOCKED)

| #   | Decision                                                                  | Detail                                                                                                                                                       | Reasoning                                                                                                     | Lifespan  |
| --- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- | --------- |
| D1  | Data source = **C (hybrid)**                                              | Default = official `GET /user/balance` with an API key. Optional rich mode = platform `api/v0` endpoints with a browser session token.                       | Official API has no usage endpoint; platform has usage but needs a session token. Hybrid degrades gracefully. | permanent |
| D2  | **Maximum data, judgement on layout**                                     | Show balance, lifetime cost, today/period cost, tokens (in/out/cache), requests, per-key breakdown, and an estimated days-left.                              | User asked for "as much data as possible".                                                                    | permanent |
| D3  | **KWallet** for the API key + session token; user supplied a test API key | `kwallet-query` read/write, wallet `kdewallet`, folder `Plasma`.                                                                                             | User chose KWallet.                                                                                           | permanent |
| D4  | id `org.deepseek.plasma.usage`, license **GPL-2.0+**                      |                                                                                                                                                              | User approved.                                                                                                | permanent |
| D5  | **Panel-first**; full detail in popup                                     | Compact panel rep (icon + primary number); Full representation for the detailed view.                                                                        | User: "If I can't have both, then Panel".                                                                     | permanent |
| D6  | Runtime deps: **none** beyond Plasma/Qt                                   | Network via QML `XMLHttpRequest`; secrets via `kwallet-query` through `plasma5support` executable engine; pure-JS parsing. `node:test` for tests (dev-only). | User's "minimal (preferably none) dependencies".                                                              | permanent |

## Ratified technical facts (from the user-supplied HAR + live probes)

- Platform endpoints (contract in `docs/state/api-contract.md`):
  `GET /api/v0/users/get_user_summary`, `GET /api/v0/usage/by_api_key/amount`,
  `GET /api/v0/usage/by_api_key/cost`. Auth = `authorization: Bearer <session token>` only.
- Platform API returns **HTTP 200 for auth failures** with `code:40003` → must
  branch on JSON `code`.
- Official `/user/balance` works with the supplied test key.

## SUPERSEDED

- **D39** — classic branch protection on `main`. Replaced by the repository rulesets
  in D43, which also cover tags and admit no bypass. `docs/state/protection.json`
  is kept as history, not as configuration.

---

Round 2 — 2026-09-26 (internationalization)

| #   | Decision                                                                                                        | Detail                                                                                                                                                                                                                                                                                                                                                                                                             | Reasoning                                                                                                                                                                                                             | Lifespan                    |
| --- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| D7  | i18n via **gettext/KI18n**, in-package catalogue                                                                | Domain `plasma_applet_org.deepseek.plasma.usage`, `.mo` files committed under `contents/locale/<locale>/LC_MESSAGES/`.                                                                                                                                                                                                                                                                                             | The mechanism is proven live (see below); no system-wide install; `./install.sh` keeps working without gettext.                                                                                                       | permanent                   |
| D8  | **`translate/messages/<locale>.json` is the source of truth**, `.po` files are generated                        | `generate.mjs` enforces completeness, plural counts and `%n` integrity. Escape hatch: adopting a translation platform makes the `.po` files authoritative and the tables redundant.                                                                                                                                                                                                                                | ~3× cheaper to author, structurally cannot drift from the pot, and the es/ru alias families stop being near-duplicate files.                                                                                          | until a platform is adopted |
| D9  | Locales shipped: **17**                                                                                         | The 12 requested (`zh_CN`, `en_IN`, `hi_IN`, `id_ID`, `fr_FR`, `ru_RU`, `ru_BY`, `es_ES`, `es_CL`, `es_AR`, `es_MX`, `es_CU`) plus bare-language aliases `ru`, `fr`, `id`, `hi` and `es_419`. No bare `es` (ES vs LA is genuinely ambiguous — better to fall back to English than to silently pick one). `es_CL/AR/MX/CU` are **deliberate aliases** of `es_419`: none of the current strings differ between them. | Region codes alone leave generic-`<lang>` users in English (Qt tries `<lang>_<REGION>` then `<lang>`).                                                                                                                | permanent                   |
| D10 | Add **`msgctxt`** to the ambiguous short strings                                                                | Token-table row labels and the Save/Clear buttons.                                                                                                                                                                                                                                                                                                                                                                 | `In`/`Out`/`Cost` are genuinely ambiguous for a translator without context.                                                                                                                                           | permanent                   |
| D11 | `qmlformat --check` **dropped from the gauntlet**                                                               | It reorders imports alphabetically and strips the blank lines that group declarations, which fights the KDE QML style the project follows. `qmllint` remains the gate.                                                                                                                                                                                                                                             | A gate that forces worse code is not a gate.                                                                                                                                                                          | permanent                   |
| D12 | **Do not sign up to Crowdin/Transifex on the user's behalf**                                                    | Config files committed (`translate/crowdin.yml`, `translate/.tx/config`, both explicitly marked never-run) and the trade-offs documented instead.                                                                                                                                                                                                                                                                  | Creating an account, applying for an open-source plan and inviting translators are human actions. Transifex's OSS terms were verified from its own page; Crowdin's page 404'd, so its terms are stated as unverified. | permanent, but see D13      |
| D13 | Translation route = **KDE's own l10n teams** (user's choice)                                                    | `Messages.sh` added at the repo root as the entry point KDE's automation runs; `translate/README.md` documents the precondition (the widget must live in a KDE repository) and the ordered steps. Crowdin/Transifex configs demoted to a documented fallback.                                                                                                                                                      | It is the only route that produces **reviewed** translations by speakers of the language — the entire point of the exercise, given D14.                                                                               | until the widget enters KDE |
| D14 | The machine-generated catalogues are **explicitly marked unreviewed**, with **hi/ru/zh as the review priority** | Every `.po` carries `Last-Translator: Unreviewed machine translation` and the gettext placeholder `Language-Team`; the README and `translate/README.md` say so prominently and name the priority languages.                                                                                                                                                                                                        | They are unreviewed, and silently shipping them as if they were finished would misrepresent their quality.                                                                                                            | until reviewed              |

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

| #   | Decision                                                                                                                  | Detail                                                                                                                                                                                                                                                                 | Reasoning                                                                                                                                                                                                                                                                                                                                   | Lifespan  |
| --- | ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| D15 | The token and per-key tables use **one `GridLayout`**, never a layout per row                                             | Cells are emitted as a flat list (`tokenCells`, `perKeyCells`) and placed by a single grid.                                                                                                                                                                            | A per-row layout sizes its own columns from its own contents, so no two rows agreed on where a column ended — which is exactly the misalignment reported. A grid shares columns between rows.                                                                                                                                               | permanent |
| D16 | Peak / off-peak **rate indicator**                                                                                        | Green/red dot on the panel chip; state plus time left in the popup and tooltip. Logic in new pure module `contents/ui/js/peak.js`, 10 unit tests.                                                                                                                      | The rate halves off-peak, so this is the one number that changes what the widget's figures _mean_.                                                                                                                                                                                                                                          | permanent |
| D17 | The duration string comes from **`KCoreAddons.Format.formatSpelloutDuration`**                                            | Not `formatDuration`, and not new i18n strings.                                                                                                                                                                                                                        | `formatDuration` returns a clock (`26:33:05`), which reads as a time of day for spans over 24 h. The spellout form keeps the two most significant units (`3 hours and 15 minutes`, `1 day and 2 hours`) and is localized by KDE's own translations, so it costs no new strings.                                                             | permanent |
| D18 | The Chinese-holiday table holds the **published schedule** (2026) and the widget reports **Unknown** rather than guessing | `CHINESE_HOLIDAYS` filled block-by-block with `addRange()` from the announced 2026 schedule; `state()` is tri-valued (`peak`/`offPeak`/`unknown`) and returns `unknown` when the table does not cover the year. Estimated future years are deliberately **not** added. | Revised from "ship an empty table": an empty table is _wrong_ (not merely cautious) on the ~29 holiday days a year, and the user asked for accuracy. Guessing in either direction is a wrong answer, so the honest third state has to exist.                                                                                                | permanent |
| D19 | The per-key breakdown shows **only key names**, never the key id                                                          | The masked `sensitive_id` is no longer rendered. It is kept in the parsed data model (it is a grouping fallback in `api.js` and is asserted by tests).                                                                                                                 | User request: the masked id is not worth showing and it is still a fragment of a credential.                                                                                                                                                                                                                                                | permanent |
| D20 | Evidence for the 2026 dates, and the block interpretation                                                                 | Taken from publicholidays.cn, which cites the gov.cn release and flags 2027/2028 as _estimates_; only the fully-announced year was used. Each holiday's whole published **block** is listed (e.g. National Day 1–7 October), not just its statutory days.              | DeepSeek is a Chinese company excluding its national holidays, the blocks are what the State Council publishes, and the user's own reference script used the same blocks. The reference script's 2025 list could not be verified from the same source, so it was not copied in — unused data that might be wrong is worse than absent data. | permanent |
| D21 | The scan horizon is **14 days**, not 8                                                                                    | `SCAN_HORIZON_DAYS`; a test pins the Spring Festival case.                                                                                                                                                                                                             | A holiday block can hold the schedule steady for over ten days (13 Feb 10:00 UTC → 24 Feb 01:00 UTC in 2026), so a 7- or 8-day horizon would have silently dropped the countdown every Spring Festival.                                                                                                                                     | permanent |
| D22 | Two bugs found by rendering the new states, both fixed                                                                    | (a) `readonly property real peakRemainingMs` coerces a JS `null` to `0`, so the unknown state rendered "Changes in 0 seconds" — the value is now kept in a JS block and the intermediate property is gone. (b) The 8-day horizon above.                                | Neither was reachable before the tri-state and the holiday data existed, which is exactly why they were rendered rather than assumed.                                                                                                                                                                                                       | permanent |
| D23 | A test is used as the **maintenance alarm** for the holiday data                                                          | `the holiday table covers the current year` and `every covered year looks complete rather than half-filled` in `tests/peak.test.mjs`.                                                                                                                                  | Accuracy has to be enforced by something that runs, not by a README line. The suite goes red as soon as the year rolls over, which is when the dates need adding anyway.                                                                                                                                                                    | permanent |
| D24 | `nextChange` refuses to report a change it cannot substantiate                                                            | If the scan crosses an instant the holiday table does not cover, it returns `null` instead of reporting that instant as the change. Test: `nextChange refuses to scan across a gap in the holiday table`.                                                              | The end-of-window pre-check alone is not enough: a table with a missing year, or a horizon reaching past the announced years, can pass it and then report a boundary artefact as a rate change. Verified load-bearing — without the guard it returned `2026-12-31T16:00Z` (the China-day boundary), not a real change.                      | permanent |

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

| #   | Decision                                                                          | Detail                                                                                                                                                                                                                                                                                                                                                   | Reasoning                                                                                                                                                                                                                                                              | Lifespan       |
| --- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| D25 | CI is four jobs on a stock Ubuntu runner, with **no Plasma or KDE packages**      | `.github/workflows/ci.yml`: unit tests, `./translate/build.sh --check`, `qmllint`, and `./install.sh --pack` to prove the archive still builds.                                                                                                                                                                                                          | Verified locally that Qt 6 `qmllint` resolves no imports (a bogus `import` still exits 0; a syntax error exits 255), so the QML job needs only `qt6-declarative-dev-tools`. The applet's logic is plain JS, so node runs it directly and every gate stays installable. | permanent      |
| D26 | The holiday-table alarm runs **on a schedule, not on push**                       | `.github/workflows/holiday-alarm.yml`, monthly (`17 6 1 * *`) plus `workflow_dispatch`, running only `tests/peak.test.mjs`; a failure step writes the fix into the job summary.                                                                                                                                                                          | The alarm is time-triggered, not change-triggered. A push-only run would never fire in the window where the table has gone stale, which is the only window that matters.                                                                                               | permanent      |
| D27 | Screenshots are regenerated against the **dev mock**, never the live account      | `PLATFORM_BASE` pointed at `tests/mock-platform-server.mjs` with a fake session token in KWallet; the popup additionally forced `preferredRepresentation: fullRepresentation`. Every edit reverted and confirmed by grepping for `TEMP-VERIFY` / `127.0.0.1:8731`. The panel chip is the compact representation, cropped from a `plasmawindowed` render. | The popup shows balances, so a live capture would publish them. In `full` mode the official endpoint is only a fallback, so pointing the platform base at the mock means the API key in KWallet is never sent anywhere.                                                | permanent      |
| D28 | One README translation **per language**; the regional catalogue variants share it | `README.{zh-CN,hi-IN,id-ID,fr-FR,ru-RU,es-ES}.md` plus English `README.md`, each carrying the identical badge row. Badge colour = the emoji flag's dominant colour; equal-height tricolours use the first non-white band, so France and Russia are both blue.                                                                                            | The app ships 17 catalogues but only 7 languages, so a file per regional variant would be six near-identical copies that drift immediately. `es-ES` is written in neutral Spanish to serve `es_419` and the four Latin-American codes.                                 | until reviewed |

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

---

Round 7 — 2026-09-26 (README polish)

| #   | Decision                                                                                           | Detail                                                                                                                                                                                                                                                                                                           | Reasoning                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Lifespan  |
| --- | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| D29 | Each README omits **its own language** from the language-navigation row                            | The badge row lists the other six files, never the one being read.                                                                                                                                                                                                                                               | A link to the page you are already on is a no-op that reads like a mistake, and its absence doubles as a "you are here".                                                                                                                                                                                                                                                                                                                                                                                                               | permanent |
| D30 | Every translated README carries a popup **rendered in its own language**; the panel chip is shared | `docs/images/rich-mode[.<tag>].png`, `<tag>` the BCP-47 spelling of the locale (`zh_CN` → `zh-CN`), English unsuffixed; `docs/images/panel-mode.png` is used by all seven.                                                                                                                                       | A translated page that illustrates itself with an English UI is a poor example, and it hides real layout differences: Hindi and Russian strings run much longer than the English ones. The chip is _not_ duplicated because in the data state it renders only the formatted number — the seven per-locale chips came out **pixel-identical** (`compare -metric AE` = 0), and seven copies would imply a difference that does not exist. A chip in the unconfigured or error state does carry text and would have to become per-locale. | permanent |
| D31 | Screenshot capture is a **committed, self-restoring script**                                       | `tests/capture-screenshots.sh`: starts the mock, redirects `PLATFORM_BASE`, backs up and fakes the KWallet token, runs the compact pass, then forces `preferredRepresentation` and runs the popup pass, re-installing between them. A `trap` restores both source files, the wallet and the install on any exit. | One installed copy can prefer only one representation, so two passes are unavoidable; and 14 images will go stale again, so the recipe belongs in the repository rather than in a chat log.                                                                                                                                                                                                                                                                                                                                            | permanent |

### Verified during round 7 (level 1)

- All eight images exist, and every popup was read back rather than assumed: the
  UI, the peak/off-peak row and the token table are translated in each language,
  and the two longest (Hindi, Russian) still fit without the table being pushed off
  the bottom.
- The per-locale chips were generated and then dropped: they were
  **pixel-identical** to the English one (`compare -metric AE` = 0), because only
  the locale-independent number is rendered. A differing `md5sum` had suggested
  otherwise; it was PNG encoding, not pixels. Seven files that differ only in
  encoding would imply a difference that does not exist.
- Each badge row holds six entries and never the file's own name; the fenced code
  blocks remain byte-identical to the English file's, and every referenced image
  path resolves.

---

Round 8 — 2026-09-26 (accuracy audit against a real account)

| #   | Decision                                                            | Detail                                                                                                                                                                                                                                                                                            | Reasoning                                                                                                                                                                                                                                                                                                                                                                    | Lifespan  |
| --- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| D32 | The usage window is **periodDays days, not periodDays+1**           | `Api.usageWindow(now, days)` = `{ start: daysAgo(now, days - 1), end: startOfToday(now) + 86400 }`; `ApiClient` only consumes it.                                                                                                                                                                 | `end` is tomorrow's local midnight, so starting at `daysAgo(now, days)` asked for 31 days while the widget said "Last 30 days": spend on the oldest day was folded into every period figure. The recorded live probe (`start=1787886000` = 2026-08-28, `end=1790478000`) is a 30-day window and matches the platform page, so the probe is the reference the code now obeys. | permanent |
| D33 | The **popup shows exact counts**; the panel chip stays compact      | `Fmt.grouped()` for the token and request figures in `FullRepresentation`; `Fmt.tokens()`/`compactNumber()` remain for the panel metric. Also routes the Requests rows through `shown()`, which they had bypassed.                                                                                | `297,270,684` rendered as `297.3M` cannot be checked against the platform's page, which is the whole point of the detailed view. The chip has to fit a number into a panel and is not where anyone compares figures. The bypass was a privacy-mode leak: "Hide all amounts" hid every other figure but left request counts readable.                                         | permanent |
| D34 | The dev mock is a **snapshot of a real account**, and checks itself | `tests/mock-platform-server.mjs` pins the totals in its header, derives per-key/per-day figures with a largest-remainder split, and `--check` recomputes them; `api.test.mjs` pushes the payloads through `parseEnvelope`/`parseSummary`/`aggregateUsage` and asserts the platform's own figures. | Invented mock numbers are why the screenshots could not be validated against anything. Real ones make every screenshot and every regression test checkable by hand, and `--check` keeps the snapshot consistent instead of trusting a comment that says it is.                                                                                                               | permanent |
| D35 | The sparkline places bars **by date**, not by array index           | The Canvas computes `(bucket.time - windowStart) / 86400` against the requested window, which `ApiClient` exposes as `windowStart`/`windowEnd`.                                                                                                                                                   | Spacing by index is invisible while every day has spend and wrong when few do: four recent days were drawn across a whole month, which reads as steady month-long usage. The platform's own chart leaves the empty days empty.                                                                                                                                               | permanent |

### Findings recorded, not changed

- **`money()` shows 3 decimals below $1**, where the platform shows 2. Kept: for
  this account it only affects values the platform does not display (per-key
  costs), and it avoids `$0.00` for genuinely tiny amounts. Worth revisiting if a
  _card_ value ever falls below a dollar.
- **The platform's own page is inconsistent by 2 cents**: its four day bars
  (0.29 + 1.14 + 0.75 + 1.05) sum to $3.23 while its card says $3.25, because the
  tooltips round each day to cents. The mock keeps full precision so its parts sum
  to its whole, which is the property the widget's totals rely on.
- **The `tz` sign rests on the recorded probe.** `tzOffsetSeconds()` sends the UTC
  offset in seconds (-10800 for GMT-3), the probe's buckets come back at local
  midnights, and its `start`/`end` match `usageWindow()`. That is self-consistent,
  but the raw probe command was not kept, so a live re-run with a working session
  token is still the only way to be certain.

### Verified during round 8 (level 1)

- `node tests/mock-platform-server.mjs --check` → cost 3.2500, requests 1325,
  tokens 297270684, "consistent".
- The pipeline test asserts those same three figures **after** `parseEnvelope` →
  `parseSummary` → `aggregateUsage`, plus today's bucket at $1.0602 and that every
  bucket is day-aligned to the window.
- The popup was read back: `$6.74`, no bonus line, `$1.06` today, `$3.25` period
  and lifetime, `Highest $1.14`, and `295,784,330` in + `1,486,354` out = the
  platform's `297,270,684`, with `1,325` requests.
- The sparkline was read back: four bars, all within the last five of thirty slots.
- Full gauntlet green: `qmllint` 0, `node --test` 47/47, `--check` 0,
  `./install.sh` 0.
- **Not verified:** a live platform response — the session token in KWallet is
  empty, so the reconciliation runs against a fixture built from the account's own
  usage page rather than a fresh fetch.

---

Round 9 — 2026-09-26 (number and money localisation)

| #   | Decision                                                             | Detail                                                                                                                                                                                                                      | Reasoning                                                                                                                                                                                                                                                                                                                                                | Lifespan  |
| --- | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| D36 | Numbers and money follow **CLDR per locale**, from an explicit table | `format.js` gains `NUMBER_FORMATS` (separators, grouping style, sign position and its gap) and `formatNumber`/`money` that take a locale; `Qt.locale().name` is read once in `main.qml` and passed to the three formatters. | The UI was English-formatted everywhere: `1,234,567.89`, sign always first. Everything the widget ships breaks at least one rule — `1.234.567,89` and `1 234 567,89` for separators, `12,34,567.89` for Indian grouping, `US$`/`$US`/`USD` for the sign and where it goes. Separators are locale data, not text, so they do not belong in the catalogue. | permanent |
| D37 | The table is **transcribed from ICU and asserted locale by locale**  | The provenance one-liner is in the `format.js` header; `tests/format.test.mjs` carries a 19-locale table of expected number and money strings, with the separator and gap characters as escapes.                            | Whether the gap is `U+202F`, `U+00A0` or a plain space is invisible in a screenshot and impossible to remember; a bad transcription has to fail the suite, not merely look odd.                                                                                                                                                                          | permanent |

### Findings recorded, not changed

- **Bare `es` follows Spain, not Latin America** (ICU: `1.234.567,89 US$`), the
  opposite of what D9 assumed when it refused to alias a bare `es` catalogue. Only
  reachable when the locale really is plain `es`.
- **`money()` still shows three decimals below $1** where CLDR's currency pattern
  is two. That is now visible in the screenshots (a French per-key cost reads
  `0,885 $US`), making it the one remaining CLDR deviation on a card-level value.
  Left alone again deliberately: it is a product choice that avoids `$0.00` for
  tiny amounts, not a missing separator, and changing it moves every small figure.
- **The compact panel form keeps Latin K/M/B suffixes** (documented on
  `compactNumber`). CLDR's compact forms have their own divisors and suffixes per
  locale (`zh` 3亿, `hi` 29.7 क॰, `ru` 297,3 млн, `fr` 297,3 k) — a table of its
  own for the one metric that uses it, the panel's token count.

### Verified during round 9 (level 1)

- A dev-only script (`docs/state/verify-format.mjs`, since deleted) compared the
  table against `Intl` for 21 locale spellings × 4 numbers × 3 currencies:
  **168 values, 0 mismatches**. The generic symbol list differs from ICU's English
  names by design (RUB, SEK, PLN, HUF, ... render as the sign, not the code).
- `format.test.mjs` pins the same expectations a locale at a time, including the
  no-break and narrow-no-break characters as escapes.
- Screenshots read back: `fr-FR` (`6,74 $US`, `151 220 605`), `hi-IN`
  (`29,57,84,330`), `zh-CN` (`US$6.74`).
- Full gauntlet green: `qmllint` 0, `node --test` 51/51, `--check` 0,
  `./install.sh` 0.

---

Round 10 — 2026-09-26 (public repository, GitHub configuration, Prettier)

| #   | Decision                                                                                                                                             | Detail                                                                                                                                                                                                                                                                  | Reasoning                                                                                                                                                                                                                                                                                                                                                                       | Lifespan                             |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| D38 | Published as **`marble-sh/deepseek-plasma-usage`**, public, wiki off                                                                                 | `gh repo create --public --source . --disable-wiki` with the description as given; topics `plasma kde plasmoid deepseek qt i18n`; GitHub detects the GPL-2.0 licence from `LICENSE`.                                                                                    | A widget this size needs an issue tracker and a place for release archives, not a wiki that would immediately go stale beside the READMEs.                                                                                                                                                                                                                                      | permanent                            |
| D39 | `main` is protected: a PR is required, the five CI checks are required, history is linear, force pushes and deletions are refused, admins are exempt | `docs/state/protection.json`, applied with `gh api -X PUT .../branches/main/protection`. Merge commits are disabled repository-wide so the UI cannot offer a button the linear-history rule rejects, and merged branches are deleted.                                   | A solo maintainer cannot approve their own PR, so requiring an approval would block every merge; zero approvals still gets the PR workflow, the required checks and a record of the discussion. Admins stay exempt so one wedged check cannot lock the branch. `strict: false` because requiring branches to be up to date would mean a rebase per push on a project this size. | permanent                            |
| D40 | **SemVer**, policy in `CHANGELOG.md`, guarded by a test                                                                                              | The version is in `package.json` and in `metadata.json` as `KPlugin.Version`; `tests/version.test.mjs` fails if either disagrees with the newest `CHANGELOG.md` heading. A release is an annotated tag `v<version>`.                                                    | Three copies of one fact drift apart; the guard makes them one. Plasma reads `KPlugin.Version` for the widget's About, npm and `gh release` read `package.json`, so both have to be right.                                                                                                                                                                                      | permanent                            |
| D41 | The QML gate treats **only parse errors** as failures                                                                                                | `tests/lint-qml.sh` runs `qmllint` and, when it exits non-zero, fails only if the output contains a parse error; otherwise it says the imports could not be resolved.                                                                                                   | The runner cannot install Plasma 6 QML modules — Ubuntu 24.04 still ships Plasma 5 — and qmllint gives unresolvable imports the same exit status as a parse error. It is a syntax checker in this project's use of it anyway: with the modules present it exits 0 for these files.                                                                                              | until a Plasma 6 runner is available |
| D42 | Prettier is a **devDependency**, not a runtime one                                                                                                   | `prettier@3.9.9` pinned; `npm run format` / `format:check`; a CI job runs `npm ci` then `npm run format:check`. `.prettierignore` excludes QML, shell and gettext (unparsable) and the byte-managed generated files. `printWidth` is 120 and `proseWrap` is `preserve`. | The widget still ships with no runtime dependencies; this is tooling. The generated gettext files must not be rewritten or `translate/build.sh --check` would fail. See the `CONTRIBUTING.md` diff for the two odd-looking options.                                                                                                                                             | permanent                            |

### Correction (recorded, not hidden)

D25 claimed the `qmllint` CI job needed no KDE packages because _"qmllint on Qt 6
resolves no imports"_. That was tested against the Qt 6.11 installed here and does
not hold for the Qt 6.4 that Ubuntu 24.04 ships: it reports the unresolvable
`org.kde.*` imports as warnings and exits non-zero, the same status as a parse
error, so the first CI run failed for a reason that was not a defect. The claim was
wrong, not merely incomplete, and D41 is what replaces it.

### Verified during round 10 (level 1)

- The repository exists and the first push landed: `main` at `3402632`, five check
  runs green (`Unit tests (node)`, `Prettier`, `Translations up to date`,
  `QML syntax`, `Pack the plasmoid`).
- The first run **failed** on `QML syntax` and was read rather than re-run: the log
  showed `Failed to import org.kde.plasma.configuration` and exit 255. That is what
  produced D41 and the correction above; the second run is green.
- `gh repo view` reports `visibility: PUBLIC`, `has_wiki: false`,
  `licenseInfo: gpl-2.0`; the six topics are set; `mergeCommitAllowed` is false
  while squash and rebase remain enabled.
- The protection is read back from the API: five required contexts, zero required
  approvals and a PR requirement both present, `required_linear_history` true,
  force pushes and deletions false, admins not enforced.
- Locally: `npm test` 54/54, `translate/build.sh --check` 0, `prettier --check`
  clean, `tests/lint-qml.sh` exits 0 on this Plasma 6 machine.

---

Round 11 — 2026-09-26 (rulesets, dependency audit, release automation, community files)

| #   | Decision                                                                                    | Detail                                                                                                                                                                                                                                                                                                                                                                                                      | Reasoning                                                                                                                                                                                                                                                                                                                                                                                                              | Lifespan                                                  |
| --- | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| D43 | Branch and tag protection are **repository rulesets**, not classic protection               | `main` = ruleset 24055635 (`target: branch`, `~DEFAULT_BRANCH`); `release tags` = 24055636 (`target: tag`, `refs/tags/v*`). Bodies are `docs/state/ruleset-main.json` and `docs/state/ruleset-tags.json`, applied with `gh api -X PUT .../rulesets`. D39's classic protection was deleted, so there is one source of truth. `bypass_actors` is empty, and the API reports `current_user_can_bypass: never`. | Classic protection covers branches only, so protecting a tag pattern needs a ruleset anyway; keeping both would be two sources of truth for one rule. Classic also lets an admin bypass, which makes the branch only as protected as the maintainer's own discipline. The cost of removing the bypass is that a wedged check is fixed by editing the ruleset rather than by an admin override.                         | permanent                                                 |
| D44 | Tags matching `v*` can be **created, but not moved or deleted**                             | `release tags` ruleset, rules `deletion` + `update`. Creation is deliberately left open.                                                                                                                                                                                                                                                                                                                    | A release tag is what `gh release create`, the attached `.plasmoid` and every download URL point at; moving `v0.1.0` after publication silently changes what that version means. Creating one is how a release is made, so that stays allowed.                                                                                                                                                                         | permanent                                                 |
| D45 | The dependency gate is `npm audit --audit-level=high` over the **whole** lockfile           | CI job `Dependency audit`; no `--omit=dev`.                                                                                                                                                                                                                                                                                                                                                                 | With zero runtime dependencies, `--omit=dev` audits an empty tree and can never fail — theatre rather than a gate. The dev tree still runs on contributors' machines and in CI, so it is worth auditing. It fails on `high` and above only: a `moderate` advisory in a dev-only tool has no path to anyone using the widget, and there is nothing in the runtime tree to upgrade in response.                          | permanent                                                 |
| D46 | **CodeQL** scans the JavaScript                                                             | `codeql.yml`, `javascript-typescript`, `queries: security-and-quality`, on push to `main`, on pull requests, and weekly.                                                                                                                                                                                                                                                                                    | The surface is small but hand-written and real: shell command construction in `js/wallet.js`, and parsing in `js/api.js`. Free for public repositories.                                                                                                                                                                                                                                                                | permanent                                                 |
| D47 | Dependabot opens **one grouped PR a week per ecosystem**                                    | `dependabot.yml`, `github-actions` and `npm`, `groups: { patterns: ["*"] }`, `versioning-strategy: increase`.                                                                                                                                                                                                                                                                                               | One PR per action would be four notifications for one maintenance chore. Prettier's formatting is asserted by the `Prettier` check, so a formatting-changing major arrives as a red check rather than as a silent reformat of the repository.                                                                                                                                                                          | permanent                                                 |
| D48 | A **tag publishes the release**                                                             | `release.yml` on `push: tags: ["v*"]`: refuses a tag that is not `v<package.json version>`, re-runs the test suite, packs the `.plasmoid`, takes the notes from `CHANGELOG.md` through `scripts/release-notes.sh`, and attaches the archive with `gh release create --verify-tag`.                                                                                                                          | The tag and the manifest are the same fact and must not be able to disagree. Notes written for humans belong in the changelog; reconstructing them from commit titles produces a worse changelog and rewards bad commit messages.                                                                                                                                                                                      | permanent                                                 |
| D49 | Community-health files are **purpose-written and short**, and there is **no `FUNDING.yml`** | `SECURITY.md`, `CODE_OF_CONDUCT.md`, `SUPPORT.md`, three issue-form files, a pull-request template, `CODEOWNERS`, and **private vulnerability reporting enabled** (`PUT /repos/.../private-vulnerability-reporting`) so that `SECURITY.md`'s only reporting route actually works.                                                                                                                           | The Contributor Covenant would be four times the length of the code most visitors arrive to read. `CODEOWNERS` requests a review but is not a gate: `main` requires zero approvals (a solo maintainer cannot approve their own PR), so `require_code_owner_review` would deadlock every merge. Funding is omitted because nothing is set up to receive money, and a button that leads nowhere is worse than no button. | permanent (CODEOWNERS until there is a second maintainer) |
| D50 | The social preview card is **generated by a script**, then uploaded by hand                 | `scripts/social-preview.sh` composes `docs/images/social-preview.png` (1280x640, ~239 kB) from the same screenshots the READMEs use, with ImageMagick.                                                                                                                                                                                                                                                      | GitHub exposes no API for the social preview image — it is a one-off upload in the web UI — so the file is the only reproducible part. Committing the generator means the card can be rebuilt after a UI change instead of remade by hand.                                                                                                                                                                             | until GitHub adds an API                                  |

### Correction (recorded, not hidden)

D39 described `main` as protected by **classic branch protection**, applied from
`docs/state/protection.json` with `PUT /repos/.../branches/main/protection`, and
recorded that "admins are exempt". That was accurate when it was written and is no
longer true of the repository: the classic protection has been deleted in favour of
the two rulesets in D43, and `GET .../branches/main/protection` now answers
`404 Branch not protected`. The admin exemption went with it — both rulesets report
`current_user_can_bypass: never`. `docs/state/protection.json` is history, not
configuration; D43 is the configuration.

A second, smaller correction: D39's table row also claimed the five CI checks were
required, which was true, but `Dependency audit` and CodeQL's `Analyze JavaScript`
were added as required checks in the same round as the jobs themselves, so the count
moved from five to seven (both are verified below).

### Verified during round 11 (level 1)

- The `main` ruleset **refuses a direct push**, re-proved first-hand in this round
  rather than carried over: an empty commit pushed to `main` returned
  `GH013 ... push declined due to repository rule violations`, naming both
  `Changes must be made through a pull request` and `5 of 5 required status checks
are expected`. `git reset --hard origin/main` restored the tree (untracked work
  survived; the three files that had been edited in place did not, and were
  rewritten).
- The **tag ruleset was proved with a real `v0.0.0-probe` tag**, not asserted:
  creating it pushed cleanly (exit 0), deleting it was refused with
  `GH013 ... Cannot delete this tag` (exit 1), and force-moving it was refused with
  `Cannot update this protected ref` (exit 1). Deleting the _same_ tag while the
  ruleset was set to `disabled` succeeded — so the refusal was the ruleset, not a
  permission or a typo. The tag and the temporary disable were both removed
  afterwards; `git ls-remote --tags origin` is empty again.
- The ruleset **test body matches the live API**: `docs/state/ruleset-tags.json`'s
  `refs/tags/v*` is what `GET .../rulesets/24055636` returns, and the same pattern is
  what `release.yml` triggers on, which is now asserted by `tests/version.test.mjs`.
- `npm audit` reports **0 advisories at every level**, so the new `Dependency audit`
  job passes on the current tree. `npm audit --omit=dev` was checked and also reports
  zero — which is precisely why it would have been a useless gate.
- `scripts/social-preview.sh` is idempotent and writes 1280x640 at 239,347 bytes,
  well under GitHub's 1 MB limit. `gh repo view` still reports
  `usesCustomOpenGraphImage: false`: uploading the PNG is the one step no API
  performs.
- Repository settings read back from the API: `visibility: PUBLIC`,
  `has_wiki: false`, `has_projects: false`, `has_discussions: true`,
  `has_issues: true`, `allow_auto_merge: true`, `delete_branch_on_merge: true`,
  `allow_merge_commit: false` with squash and rebase enabled, squash title/message
  `PR_TITLE`/`PR_BODY`, topics `deepseek kde plasma plasmoid qt i18n`, and secret
  scanning with push protection enabled (GitHub's default for a new public
  repository, confirmed rather than assumed).
- `scripts/release-notes.sh` was exercised against the real changelog: it prints the
  `[0.1.0]` section, exits 1 for a version with no section, and exits 2 with no
  argument at all.
- The release workflow's **tag guard was proved by negative test**, which matters
  because it is the one gate whose failure mode is publishing a release that should
  not exist. `release.yml` arrived in a pull request, so a throwaway
  `v0.0.0-probe` tag was pushed at that pull request's head: the run failed at
  `Check the tag against the version` with
  `tag v0.0.0-probe does not match package.json version 0.1.0`, every later step —
  `Publish` included — was skipped, and `gh release list` stayed empty. The probe tag
  was then removed. A `push` of a tag runs the workflow from the tagged commit, which
  is what made this testable before the merge; `schedule` and `release` events would
  each have needed the workflow on the default branch first.
- The **final ruleset state was read back** from the API after the pull request
  merged, and it is what D43 claims: seven required contexts — `Unit tests (node)`,
  `Prettier`, `Translations up to date`, `QML syntax`, `Pack the plasmoid`,
  `Dependency audit`, `Analyze JavaScript` — `allowed_merge_methods` narrowed to
  `squash` and `rebase` so the rule cannot offer a merge-commit button that the
  linear-history rule would reject, `bypass_actors: []`, and
  `current_user_can_bypass: "never"`. Requiring the two new gates only became possible
  after they had reported on a pull request, since a required context that no run has
  produced leaves a pull request permanently unmergeable.
- `require_extra_approval_for_unattributed_changes` is left at `true`, which is what
  GitHub defaults it to when the field is omitted. It is inert here — PR #2 merged
  with that rule active and zero approvals — so it was not worth disabling a safety
  default to work around. Revisit if a second maintainer or a fork pull request ever
  makes it bite.
- **Private vulnerability reporting was `enabled: false`**, which meant the only
  reporting route `SECURITY.md` offers — the private advisory form it links to — was
  closed to everyone except an administrator. Reading the repository's own configuration
  back is what found it; nothing about writing the file would have. It is now enabled
  (`PUT /repos/.../private-vulnerability-reporting`), and D49 records it as part of the
  policy rather than as an optional extra.
- The first CodeQL analysis found **five alerts, all in dev tooling** and none in the
  shipped widget: three `js/unused-local-variable` notes (`ROOT` and `DOMAIN` in
  `translate/generate.mjs`, `dayIndex` in `tests/mock-platform-server.mjs`) and two
  `js/file-system-race` warnings where the generator checked `existsSync` and then wrote
  the file. The dead constants are deleted and the check-then-read is now a
  `readIfExists` helper treating `ENOENT` as absent — the same behaviour with no window
  between the check and the use. Cleared rather than accepted, because an alert list
  that is never empty is a list nobody reads.
- Open item, not yet exercised: **CodeQL on a pull request from a fork.** The
  `Analyze JavaScript` job needs `security-events: write`, which a fork pull request
  is granted for code scanning but which nothing here has tested. If a fork pull
  request is ever wedged on that check, the fix is a `pull_request` path filter or
  removing the context from the required list.

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
