/*
    SPDX-License-Identifier: GPL-2.0-or-later
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { load } from "./load.mjs";

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
