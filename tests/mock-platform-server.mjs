/*
    SPDX-FileCopyrightText: 2026 cassidy
    SPDX-License-Identifier: GPL-2.0-or-later

    Dev-only mock of the DeepSeek platform API: serves the payload shapes
    recorded in docs/state/api-contract.md so the widget's rich mode can be
    exercised, and its README screenshots taken, without live credentials.

        node tests/mock-platform-server.mjs [port]

    Point `PLATFORM_BASE` in contents/ui/js/api.js at it (translate/build.sh's
    sibling, tests/capture-screenshots.sh, does this and restores it).

    The numbers are a *snapshot of a real account's usage page*, deliberately
    rather than invented ones, so the widget's output can be checked line by
    line against what the platform displayed:

      balance (topped up)        $6.74        no bonus credit
      lifetime / last-30-day     $3.25
      last-30-day requests       1,325        1,241 flash + 84 v4-pro
      last-30-day tokens         297,270,684  292,100,158 flash + 5,170,526 v4-pro
      daily cost                 0.2949 + 1.1449 + 0.7500 + 1.0602 = 3.2500
      (the platform's page rounds each of those to $0.29 / $1.14 / $0.75 / $1.06
       and shows a $3.25 card, so its own bars appear to sum to $3.23; the mock
       keeps the full precision so its totals reconcile exactly)

    Only four of the thirty days have activity, which is what makes the
    sparkline sparse and the "Today" row meaningful.

    `--check` recomputes every total from the same tables and prints them, so the
    arithmetic above is verified rather than asserted in a comment.
*/
import http from "node:http";
import { pathToFileURL } from "node:url";

// True only when this file is the process entry point. The payload builders are
// exported so api.test.mjs can push them through the widget's own pipeline;
// importing must not start a server.
function isMain() {
    return !!process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
}

const port = Number(process.argv[2] || 8731);

const DAYS = 30;

// One entry per day with activity: `back` days before today, split by model.
const ACTIVE_DAYS = [
    { back: 4, flash: 0.2949, pro: 0 },
    { back: 2, flash: 0.4249, pro: 0.72 },
    { back: 1, flash: 0.75, pro: 0 },
    { back: 0, flash: 1.0602, pro: 0 }
];

// 30-day totals, split across the keys the account has. The shares are applied
// with distribute() below, so the per-key figures always sum to these exactly.
const KEYS = [
    { tracking_id: "4ec071d2-bed7-404d-86b0-0c88900afd17", name: "home",
      sensitive_id: "sk-436d4***********************b3be", flashShare: 0.35 },
    { tracking_id: "0f649568-18d5-4470-ac2c-fdec74be771f", name: "zed-vapor",
      sensitive_id: "sk-68cc7***********************fa4f", flashShare: 0.5 },
    { tracking_id: "a6ee9503-ac2c-49b2-8fee-b0b41b298e63", name: "zed-air",
      sensitive_id: "sk-f18a0***********************e6e7", flashShare: 0.15 }
];

const MODELS = {
    "deepseek-flash": { tokens: 292100158, requests: 1241 },
    "deepseek-v4-pro": { tokens: 5170526, requests: 84 }
};

const BALANCE = "6.7400000000000000";
const BONUS = "0";
const LIFETIME_COST = "3.2500000000000000";

// Fractions of a bucket's tokens: completions, then cached vs missed prompt.
const RESPONSE_SHARE = 0.005;
const CACHE_HIT_SHARE = 0.98;

// Split `total` into whole numbers proportional to `weights`, summing to
// `total` exactly (largest-remainder, so no rounding drift).
function distribute(total, weights) {
    const sum = weights.reduce((a, b) => a + b, 0);
    if (total <= 0 || sum <= 0) {
        return weights.map(() => 0);
    }
    const exact = weights.map(w => (total * w) / sum);
    const out = exact.map(Math.floor);
    const residual = total - out.reduce((a, b) => a + b, 0);
    const order = exact
        .map((v, i) => ({ i, frac: v - Math.floor(v) }))
        .sort((a, b) => b.frac - a.frac);
    for (let k = 0; k < residual; k++) {
        out[order[k % order.length].i] += 1;
    }
    return out;
}

function localMidnight(daysBack) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - daysBack);
    return Math.floor(d.getTime() / 1000);
}

const dayIndex = back => DAYS - 1 - back;

// tokens/requests per (key, model): per-key split of the model total, then that
// key's own split across the days it was active, weighted by its cost.
function seriesFor(key, model) {
    const total = MODELS[model];
    const isFlash = model === "deepseek-flash";

    const keyTokens = isFlash
        ? distribute(total.tokens, KEYS.map(k => k.flashShare))[KEYS.indexOf(key)]
        : total.tokens; // v4-pro belongs to a single key
    const keyRequests = isFlash
        ? distribute(total.requests, KEYS.map(k => k.flashShare))[KEYS.indexOf(key)]
        : total.requests;

    // The model is only used on the days this key spent money on it.
    const days = ACTIVE_DAYS.filter(d => (isFlash ? d.flash : d.pro) > 0);
    const weights = days.map(d => (isFlash ? d.flash : d.pro) * (isFlash ? key.flashShare : 1));
    const tokensPerDay = distribute(keyTokens, weights);
    const requestsPerDay = distribute(keyRequests, weights);

    const buckets = [];
    for (let back = DAYS - 1; back >= 0; back--) {
        const at = days.findIndex(d => d.back === back);
        const tokens = at < 0 ? 0 : tokensPerDay[at];
        const requests = at < 0 ? 0 : requestsPerDay[at];
        const response = Math.round(tokens * RESPONSE_SHARE);
        const input = tokens - response;
        const cacheHit = Math.round(input * CACHE_HIT_SHARE);
        buckets.push({
            time: localMidnight(back),
            tokens,
            requests,
            usage: {
                RESPONSE_TOKEN: response,
                REQUEST: requests,
                PROMPT_CACHE_HIT_TOKEN: cacheHit,
                PROMPT_CACHE_MISS_TOKEN: input - cacheHit
            }
        });
    }
    return { buckets, keyTokens, keyRequests };
}

// Cost per (key, model): the day's cost times the key's share.
function costBucketsFor(key, model) {
    const isFlash = model === "deepseek-flash";
    const buckets = [];
    for (let back = DAYS - 1; back >= 0; back--) {
        const day = ACTIVE_DAYS.find(d => d.back === back);
        const dayCost = day ? (isFlash ? day.flash : day.pro) : 0;
        const share = isFlash ? key.flashShare : (key.name === "zed-vapor" ? 1 : 0);
        buckets.push({ time: localMidnight(back), cost: (dayCost * share).toFixed(16) });
    }
    return buckets;
}

function apiKey(key) {
    return {
        tracking_id: key.tracking_id,
        name: key.name,
        sensitive_id: key.sensitive_id,
        valid: true,
        key_type: "NORMAL"
    };
}

function modelsFor(key) {
    return Object.keys(MODELS).filter(m => m === "deepseek-flash" || key.name === "zed-vapor");
}

function costPayload() {
    const data = [];
    for (const key of KEYS) {
        for (const model of modelsFor(key)) {
            data.push({
                currency: "USD",
                series: [{ api_key: apiKey(key), model, buckets: costBucketsFor(key, model) }]
            });
        }
    }
    return {
        code: 0,
        msg: "",
        data: { biz_code: 0, biz_msg: "", biz_data: {
            start: localMidnight(DAYS - 1),
            end: localMidnight(-1),
            bucket: 86400,
            models: Object.keys(MODELS),
            data
        } }
    };
}

function amountPayload() {
    const series = [];
    for (const key of KEYS) {
        for (const model of modelsFor(key)) {
            series.push({
                api_key: apiKey(key),
                model,
                buckets: seriesFor(key, model).buckets.map(b => ({
                    time: b.time,
                    usage: b.usage
                }))
            });
        }
    }
    return {
        code: 0,
        msg: "",
        data: { biz_code: 0, biz_msg: "", biz_data: {
            start: localMidnight(DAYS - 1),
            end: localMidnight(-1),
            bucket: 86400,
            models: Object.keys(MODELS),
            series
        } }
    };
}

function summaryPayload() {
    return {
        code: 0,
        msg: "",
        data: { biz_code: 0, biz_msg: "", biz_data: {
            normal_wallets: [{ currency: "USD", balance: BALANCE, token_estimation: "0" }],
            bonus_wallets: [{ currency: "USD", balance: BONUS, token_estimation: "0" }],
            total_costs: [{ currency: "USD", amount: LIFETIME_COST }]
        } }
    };
}

// Recompute every headline figure straight from the tables above.
function reconcile() {
    let cost = 0;
    let requests = 0;
    let tokens = 0;
    for (const key of KEYS) {
        for (const model of modelsFor(key)) {
            for (const b of costBucketsFor(key, model)) {
                cost += parseFloat(b.cost);
            }
            const s = seriesFor(key, model);
            for (const b of s.buckets) {
                requests += b.usage.REQUEST;
                tokens += b.usage.RESPONSE_TOKEN
                    + b.usage.PROMPT_CACHE_HIT_TOKEN
                    + b.usage.PROMPT_CACHE_MISS_TOKEN;
            }
        }
    }
    return { cost, requests, tokens };
}

if (isMain() && process.argv.includes("--check")) {
    const { cost, requests, tokens } = reconcile();
    const ok = Math.abs(cost - 3.25) < 1e-9 && requests === 1325 && tokens === 297270684;
    console.log(`cost     ${cost.toFixed(4)}  (want 3.2500)`);
    console.log(`requests ${requests}     (want 1325)`);
    console.log(`tokens   ${tokens}  (want 297270684)`);
    console.log(ok ? "mock-platform-server: consistent" : "mock-platform-server: NOT consistent");
    process.exit(ok ? 0 : 1);
}

const routes = {
    "/api/v0/users/get_user_summary": summaryPayload,
    "/api/v0/usage/by_api_key/cost": costPayload,
    "/api/v0/usage/by_api_key/amount": amountPayload
};

const server = http.createServer((req, res) => {
    const path = new URL(req.url, "http://localhost").pathname;
    const handler = routes[path];
    if (!handler) {
        res.writeHead(404, { "content-type": "application/json" });
        res.end(JSON.stringify({ detail: "Not Found" }));
        return;
    }
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(handler()));
});

if (isMain()) {
    server.listen(port, "127.0.0.1", () => {
        console.log("mock platform API on http://127.0.0.1:" + port);
    });
}

export {
    costPayload,
    amountPayload,
    summaryPayload,
    reconcile,
    MODELS,
    BALANCE,
    BONUS,
    LIFETIME_COST
};
