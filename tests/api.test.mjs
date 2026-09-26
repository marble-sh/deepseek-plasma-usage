/*
    SPDX-License-Identifier: GPL-2.0-or-later
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { load } from "./load.mjs";

/*
    The recorded live probe this suite pins (docs/state/api-contract.md) was
    taken on a GMT-3 machine, and the platform's day buckets are local
    midnights, so pin the zone. Without it the window assertions would depend on
    the CI runner's zone, which is UTC. `node --test` runs each file in its own
    process, so this cannot leak into the other suites.
*/
process.env.TZ = "Etc/GMT+3";

const api = load("contents/ui/js/api.js");

test("usageUrl builds the verified query", () => {
    assert.equal(
        api.usageUrl("cost", 1787886000, 1790478000, -10800),
        "https://platform.deepseek.com/api/v0/usage/by_api_key/cost?start=1787886000&end=1790478000&tz=-10800"
    );
    assert.equal(
        api.usageUrl("amount", 1, 2, 0),
        "https://platform.deepseek.com/api/v0/usage/by_api_key/amount?start=1&end=2&tz=0"
    );
    assert.equal(
        api.summaryUrl(),
        "https://platform.deepseek.com/api/v0/users/get_user_summary"
    );
});

test("parseEnvelope: success unwraps biz_data", () => {
    const r = api.parseEnvelope('{"code":0,"msg":"","data":{"biz_code":0,"biz_msg":"","biz_data":{"x":1}}}');
    assert.equal(r.ok, true);
    // r.biz comes from a vm realm, so compare fields rather than realms.
    assert.equal(r.biz.x, 1);
});

test("parseEnvelope: HTTP-200 auth failure is an error", () => {
    const r = api.parseEnvelope('{"code":40003,"msg":"Authorization Failed (invalid token)","data":null}');
    assert.equal(r.ok, false);
    assert.equal(r.code, 40003);
    assert.match(r.msg, /Authorization/);
});

test("parseEnvelope: invalid JSON is an error", () => {
    assert.equal(api.parseEnvelope("not json").ok, false);
    assert.equal(api.parseEnvelope('{"code":0,"data":{}}').ok, false);
});

test("parseSummary reads wallets and lifetime cost", () => {
    const biz = {
        normal_wallets: [{ currency: "USD", balance: "7.78", token_estimation: "0" }],
        bonus_wallets: [{ currency: "USD", balance: "0", token_estimation: "0" }],
        total_costs: [{ currency: "USD", amount: "2.2197834160000000" }]
    };
    const s = api.parseSummary(biz);
    assert.equal(s.currency, "USD");
    assert.equal(s.balance, 7.78);
    assert.equal(s.bonus, 0);
    assert.ok(Math.abs(s.totalCost - 2.219783416) < 1e-9);
});

test("parseOfficialBalance handles both success and the 401 text", () => {
    const ok = api.parseOfficialBalance('{"is_available":true,"balance_infos":[{"currency":"USD","total_balance":"7.78","granted_balance":"0.00","topped_up_balance":"7.78"}]}');
    assert.equal(ok.total, 7.78);
    assert.equal(ok.toppedUp, 7.78);
    assert.equal(ok.available, true);
    assert.equal(api.parseOfficialBalance("Authentication Fails (governor)"), null);
});

function costBiz() {
    return {
        data: [{
            currency: "USD",
            series: [
                { api_key: { tracking_id: "A", name: "alpha", sensitive_id: "sk-a" }, model: "m1",
                  buckets: [{ time: 1000, cost: "1.5" }, { time: 2000, cost: "0.5" }] },
                { api_key: { tracking_id: "B", name: "beta", sensitive_id: "sk-b" }, model: "m2",
                  buckets: [{ time: 1000, cost: "0.25" }] }
            ]
        }]
    };
}

function amountBiz() {
    return {
        series: [
            { api_key: { tracking_id: "A", name: "alpha" }, model: "m1",
              buckets: [
                  { time: 1000, usage: { RESPONSE_TOKEN: 10, REQUEST: 1, PROMPT_CACHE_HIT_TOKEN: 100, PROMPT_CACHE_MISS_TOKEN: 20 } },
                  { time: 2000, usage: { RESPONSE_TOKEN: 5, REQUEST: 1, PROMPT_CACHE_HIT_TOKEN: 50, PROMPT_CACHE_MISS_TOKEN: 5 } }
              ] },
            { api_key: { tracking_id: "B", name: "beta" }, model: "m2",
              buckets: [{ time: 1000, usage: { RESPONSE_TOKEN: 7, REQUEST: 2, PROMPT_CACHE_HIT_TOKEN: 0, PROMPT_CACHE_MISS_TOKEN: 3 } }] }
        ]
    };
}

test("aggregateUsage merges cost and tokens per key and per day", () => {
    const agg = api.aggregateUsage(costBiz(), amountBiz());

    assert.equal(agg.currency, "USD");
    assert.equal(JSON.stringify(agg.perDay.map(d => d.time)), "[1000,2000]");
    assert.equal(agg.perDay[0].cost, 1.75);
    assert.equal(agg.perDay[1].cost, 0.5);

    // sorted by cost, descending
    assert.equal(JSON.stringify(agg.perKey.map(k => k.name)), '["alpha","beta"]');
    assert.equal(agg.perKey[0].cost, 2);
    assert.equal(agg.perKey[0].maskedId, "sk-a");
    assert.equal(agg.perKey[1].cost, 0.25);

    assert.equal(agg.totals.cost, 2.25);
    assert.equal(agg.totals.response, 22);
    assert.equal(agg.totals.cacheHit, 150);
    assert.equal(agg.totals.cacheMiss, 28);
    assert.equal(agg.totals.requests, 4);

    assert.equal(api.totalTokens(agg.perKey[0]), 190); // 10+100+20 + 5+50+5
    assert.equal(api.aggregateUsage(null, null).perDay.length, 0);
});

test("sumSince / bucketForDay / averageDailyCost", () => {
    const perDay = [
        { time: 100, cost: 1, response: 1, cacheHit: 0, cacheMiss: 0, requests: 1 },
        { time: 200, cost: 3, response: 2, cacheHit: 0, cacheMiss: 0, requests: 2 }
    ];
    assert.equal(api.sumSince(perDay, 200).cost, 3);
    assert.equal(api.sumSince(perDay, 0).cost, 4);
    assert.equal(api.bucketForDay(perDay, 100).cost, 1);
    assert.equal(api.bucketForDay(perDay, 999).cost, 0);
    assert.equal(api.averageDailyCost(perDay, 2), 2);
    assert.equal(api.averageDailyCost([], 30), 0);
});

test("time helpers agree with the local timezone", () => {
    const now = new Date("2026-09-26T18:12:43-03:00");
    assert.equal(api.tzOffsetSeconds(now), -now.getTimezoneOffset() * 60);

    const today = api.startOfToday(now);
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    assert.equal(today, Math.floor(d.getTime() / 1000));

    assert.ok(api.daysAgo(now, 30) < today);
    assert.ok(api.startOfMonth(now) <= today);
    assert.equal(api.startOfMonth(now), new Date(now.getFullYear(), now.getMonth(), 1).getTime() / 1000);
});

test("usageWindow asks for exactly the requested number of local days", () => {
    const now = new Date("2026-09-26T18:12:43-03:00");
    const w = api.usageWindow(now, 30);

    // The whole point: `end` is tomorrow's local midnight, so a 30-day window
    // starts 29 days back and spans 30 * 86400. Starting 30 days back would
    // span 31 days and fold one extra day into every period total.
    assert.equal(w.end - w.start, 30 * 86400);
    assert.equal(w.start, api.daysAgo(now, 29));
    assert.equal(w.end, api.startOfToday(now) + 86400);
});

// The window the platform's own usage page labels "Last 30 days": the exact
// query recorded in docs/state/api-contract.md and asserted by the first test.
// This is the case that was wrong before -- daysAgo(30) gave 1787799600
// (2026-08-27), one day early, i.e. a 31-day window.
test("usageWindow reproduces the recorded live probe", () => {
    const now = new Date("2026-09-26T18:12:43-03:00");
    const w = api.usageWindow(now, 30);

    assert.equal(w.start, 1787886000); // 2026-08-28T00:00-03:00
    assert.equal(w.end, 1790478000); // 2026-09-27T00:00-03:00
    assert.equal(
        api.usageUrl("cost", w.start, w.end, api.tzOffsetSeconds(now)),
        "https://platform.deepseek.com/api/v0/usage/by_api_key/cost?start=1787886000&end=1790478000&tz=-10800"
    );
});

test("usageWindow stays one day wide for a one-day period or bad input", () => {
    const now = new Date("2026-09-26T18:12:43-03:00");

    const one = api.usageWindow(now, 1);
    assert.equal(one.start, api.startOfToday(now));
    assert.equal(one.end - one.start, 86400);

    for (const bad of [0, -5, undefined, null, NaN, "nonsense"]) {
        const w = api.usageWindow(now, bad);
        assert.equal(w.end - w.start, 86400, `periodDays=${String(bad)}`);
    }

    // A fractional period is floored rather than allowed to skew the window.
    assert.equal(api.usageWindow(now, 30.9).end - api.usageWindow(now, 30.9).start, 30 * 86400);
});
