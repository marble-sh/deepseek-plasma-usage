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

---

Round 7 — 2026-09-26 (README polish)

| # | Decision | Detail | Reasoning | Lifespan |
|---|----------|--------|-----------|----------|
| D29 | Each README omits **its own language** from the language-navigation row | The badge row lists the other six files, never the one being read. | A link to the page you are already on is a no-op that reads like a mistake, and its absence doubles as a "you are here". | permanent |
| D30 | Every translated README carries a popup **rendered in its own language**; the panel chip is shared | `docs/images/rich-mode[.<tag>].png`, `<tag>` the BCP-47 spelling of the locale (`zh_CN` → `zh-CN`), English unsuffixed; `docs/images/panel-mode.png` is used by all seven. | A translated page that illustrates itself with an English UI is a poor example, and it hides real layout differences: Hindi and Russian strings run much longer than the English ones. The chip is *not* duplicated because in the data state it renders only the formatted number — the seven per-locale chips came out **pixel-identical** (`compare -metric AE` = 0), and seven copies would imply a difference that does not exist. A chip in the unconfigured or error state does carry text and would have to become per-locale. | permanent |
| D31 | Screenshot capture is a **committed, self-restoring script** | `tests/capture-screenshots.sh`: starts the mock, redirects `PLATFORM_BASE`, backs up and fakes the KWallet token, runs the compact pass, then forces `preferredRepresentation` and runs the popup pass, re-installing between them. A `trap` restores both source files, the wallet and the install on any exit. | One installed copy can prefer only one representation, so two passes are unavoidable; and 14 images will go stale again, so the recipe belongs in the repository rather than in a chat log. | permanent |

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

| # | Decision | Detail | Reasoning | Lifespan |
|---|----------|--------|-----------|----------|
| D32 | The usage window is **periodDays days, not periodDays+1** | `Api.usageWindow(now, days)` = `{ start: daysAgo(now, days - 1), end: startOfToday(now) + 86400 }`; `ApiClient` only consumes it. | `end` is tomorrow's local midnight, so starting at `daysAgo(now, days)` asked for 31 days while the widget said "Last 30 days": spend on the oldest day was folded into every period figure. The recorded live probe (`start=1787886000` = 2026-08-28, `end=1790478000`) is a 30-day window and matches the platform page, so the probe is the reference the code now obeys. | permanent |
| D33 | The **popup shows exact counts**; the panel chip stays compact | `Fmt.grouped()` for the token and request figures in `FullRepresentation`; `Fmt.tokens()`/`compactNumber()` remain for the panel metric. Also routes the Requests rows through `shown()`, which they had bypassed. | `297,270,684` rendered as `297.3M` cannot be checked against the platform's page, which is the whole point of the detailed view. The chip has to fit a number into a panel and is not where anyone compares figures. The bypass was a privacy-mode leak: "Hide all amounts" hid every other figure but left request counts readable. | permanent |
| D34 | The dev mock is a **snapshot of a real account**, and checks itself | `tests/mock-platform-server.mjs` pins the totals in its header, derives per-key/per-day figures with a largest-remainder split, and `--check` recomputes them; `api.test.mjs` pushes the payloads through `parseEnvelope`/`parseSummary`/`aggregateUsage` and asserts the platform's own figures. | Invented mock numbers are why the screenshots could not be validated against anything. Real ones make every screenshot and every regression test checkable by hand, and `--check` keeps the snapshot consistent instead of trusting a comment that says it is. | permanent |
| D35 | The sparkline places bars **by date**, not by array index | The Canvas computes `(bucket.time - windowStart) / 86400` against the requested window, which `ApiClient` exposes as `windowStart`/`windowEnd`. | Spacing by index is invisible while every day has spend and wrong when few do: four recent days were drawn across a whole month, which reads as steady month-long usage. The platform's own chart leaves the empty days empty. | permanent |

### Findings recorded, not changed

- **`money()` shows 3 decimals below $1**, where the platform shows 2. Kept: for
  this account it only affects values the platform does not display (per-key
  costs), and it avoids `$0.00` for genuinely tiny amounts. Worth revisiting if a
  *card* value ever falls below a dollar.
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
