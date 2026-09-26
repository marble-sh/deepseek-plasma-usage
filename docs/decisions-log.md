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
