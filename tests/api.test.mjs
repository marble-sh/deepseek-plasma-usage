/*
    SPDX-License-Identifier: GPL-2.0-or-later
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { load } from "./load.mjs";
import { costPayload, amountPayload, summaryPayload } from "./mock-platform-server.mjs";

/*
    The recorded live probe this suite pins (docs/state/api-contract.md) was
    taken on a GMT-3 machine, and the platform's day buckets are local
    midnights, so pin the zone. Without it the window assertions would depend on
    the CI runner's zone, which is UTC. `node --test` runs each file in its own
    process, so this cannot leak into the other suites.
*/
process.env.TZ = "Etc/GMT+3";

const api = load("contents/ui/js/api.js");

// A made-up token with the real shape (base64 of a fixture string). No test here
// carries anybody's credential, not even the one that found this bug.
const FIXTURE_TOKEN = "Zml4dHVyZS10b2tlbi1ub3QtYS1yZWFsLWNyZWRlbnRpYWwtMDAwMA==";

test("usageUrl builds the verified query", () => {
    assert.equal(
        api.usageUrl("cost", 1787886000, 1790478000, -10800),
        "https://platform.deepseek.com/api/v0/usage/by_api_key/cost?start=1787886000&end=1790478000&tz=-10800"
    );
    assert.equal(
        api.usageUrl("amount", 1, 2, 0),
        "https://platform.deepseek.com/api/v0/usage/by_api_key/amount?start=1&end=2&tz=0"
    );
    assert.equal(api.summaryUrl(), "https://platform.deepseek.com/api/v0/users/get_user_summary");
});

/*
    The platform's `userToken` entry holds a JSON object, not the token, so following
    "copy its value" literally puts the wrapper on the wire and the platform answers
    HTTP 200 with `code:40003`, "Authorization Failed (invalid token)". These cases are
    the layers a user actually copies.
*/
test("authHeaders never puts the storage wrapper on the wire", () => {
    const stored = JSON.stringify({ value: FIXTURE_TOKEN, __version: "0" });

    assert.equal(api.normalizeSessionToken(stored), FIXTURE_TOKEN);

    const header = api.authHeaders(stored).authorization;
    assert.equal(header, "Bearer " + FIXTURE_TOKEN);
    assert.ok(!header.includes("{"), "the JSON wrapper must not reach the header");
    assert.ok(!header.includes("__version"), "the storage metadata must not reach the header");
});

test("normalizeSessionToken peels the other wrappers and leaves a bare token alone", () => {
    const wrapped = {
        "a bare token": FIXTURE_TOKEN,
        "surrounding whitespace": "  " + FIXTURE_TOKEN + "\n",
        "a quoted copy": '"' + FIXTURE_TOKEN + '"',
        "a header pasted from the network tab": "Bearer " + FIXTURE_TOKEN,
        "a lower-case header": "bearer  " + FIXTURE_TOKEN,
        "a quoted JSON object": JSON.stringify(JSON.stringify({ value: FIXTURE_TOKEN }))
    };
    for (const label of Object.keys(wrapped)) {
        assert.equal(api.normalizeSessionToken(wrapped[label]), FIXTURE_TOKEN, label);
    }
});

test("normalizeSessionToken refuses to mangle anything that is not a wrapper", () => {
    // Mangling a real token would be worse than rejecting it, so anything that is not
    // one of the known wrappers is returned untouched.
    for (const input of ["{not json", '{"value":42}', '{"other":"x"}', '["a"]', "1234", "true"]) {
        assert.equal(api.normalizeSessionToken(input), input, input);
    }
    // Empty and whitespace-only collapse to empty, which is what "not configured" is.
    for (const input of ["", "   ", "\n"]) {
        assert.equal(api.normalizeSessionToken(input), "", JSON.stringify(input));
    }
    assert.equal(api.normalizeSessionToken(undefined), "");
    assert.equal(api.normalizeSessionToken(null), "");
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

test("parseEnvelope surfaces the business-level status inside data", () => {
    // The outer `code` says 0 and the request was refused anyway. The reason is in
    // `biz_msg`, and reading only the outer code reported this as a generic
    // "Missing payload" — which named neither the fault nor the field at fault.
    const refused = api.parseEnvelope(
        '{"code":0,"msg":"","data":{"biz_code":1,"biz_msg":"INVALID_PARAM","biz_data":null}}'
    );
    assert.equal(refused.ok, false);
    assert.equal(refused.msg, "INVALID_PARAM");
    assert.equal(refused.bizCode, 1);
    assert.equal(refused.biz, null);

    // A success still unwraps.
    const ok = api.parseEnvelope('{"code":0,"msg":"","data":{"biz_code":0,"biz_msg":"","biz_data":{"x":1}}}');
    assert.equal(ok.ok, true);
    assert.equal(ok.biz.x, 1);
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
    const ok = api.parseOfficialBalance(
        '{"is_available":true,"balance_infos":[{"currency":"USD","total_balance":"7.78","granted_balance":"0.00","topped_up_balance":"7.78"}]}'
    );
    assert.equal(ok.total, 7.78);
    assert.equal(ok.toppedUp, 7.78);
    assert.equal(ok.available, true);
    assert.equal(api.parseOfficialBalance("Authentication Fails (governor)"), null);
});

function costBiz() {
    return {
        data: [
            {
                currency: "USD",
                series: [
                    {
                        api_key: { tracking_id: "A", name: "alpha", sensitive_id: "sk-a" },
                        model: "m1",
                        buckets: [
                            { time: 1000, cost: "1.5" },
                            { time: 2000, cost: "0.5" }
                        ]
                    },
                    {
                        api_key: { tracking_id: "B", name: "beta", sensitive_id: "sk-b" },
                        model: "m2",
                        buckets: [{ time: 1000, cost: "0.25" }]
                    }
                ]
            }
        ]
    };
}

function amountBiz() {
    return {
        series: [
            {
                api_key: { tracking_id: "A", name: "alpha" },
                model: "m1",
                buckets: [
                    {
                        time: 1000,
                        usage: {
                            RESPONSE_TOKEN: 10,
                            REQUEST: 1,
                            PROMPT_CACHE_HIT_TOKEN: 100,
                            PROMPT_CACHE_MISS_TOKEN: 20
                        }
                    },
                    {
                        time: 2000,
                        usage: {
                            RESPONSE_TOKEN: 5,
                            REQUEST: 1,
                            PROMPT_CACHE_HIT_TOKEN: 50,
                            PROMPT_CACHE_MISS_TOKEN: 5
                        }
                    }
                ]
            },
            {
                api_key: { tracking_id: "B", name: "beta" },
                model: "m2",
                buckets: [
                    {
                        time: 1000,
                        usage: {
                            RESPONSE_TOKEN: 7,
                            REQUEST: 2,
                            PROMPT_CACHE_HIT_TOKEN: 0,
                            PROMPT_CACHE_MISS_TOKEN: 3
                        }
                    }
                ]
            }
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

    // The whole point: `end` is tomorrow's local midnight, so a 30-day window starts
    // exactly 30 * 86400 before it. Starting 30 days back from today would span 31
    // days and fold one extra day into every period total.
    assert.equal(w.end - w.start, 30 * 86400);
    assert.equal(w.end, api.startOfToday(now) + 86400);
    // And both ends are day boundaries for the one offset the request carries. Under
    // this file's fixed `Etc/GMT+3` that is trivially true — which is exactly why a
    // DST zone needs its own file: tests/usage-window-dst.test.mjs.
    const tz = api.tzOffsetSeconds(now);
    assert.equal((((w.start + tz) % 86400) + 86400) % 86400, 0);
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

/*
    A window the platform will not answer is not a data problem: it fails for every
    token, which is how an over-long period came to be mistaken for a bad credential.
    31 days is answered and 32 refused, both ends aligned (live, 2026-09-27).
*/
test("usageWindow never asks for a window the platform refuses", () => {
    const now = new Date("2026-09-26T18:12:43-03:00");

    assert.equal(api.MAX_USAGE_DAYS, 31);

    const max = api.usageWindow(now, api.MAX_USAGE_DAYS);
    assert.equal(max.end - max.start, 31 * 86400);
    assert.equal(max.end, api.startOfToday(now) + 86400);

    // Anything past the limit is clamped rather than sent, and the clamp keeps both
    // ends on the same offset's day boundaries (subtract from `end`, never take a
    // longer `start`). A stored 90 from an older settings page cannot break the widget.
    for (const over of [32, 60, 90, 9999, 1e9]) {
        const w = api.usageWindow(now, over);
        assert.equal(w.end - w.start, api.MAX_USAGE_DAYS * 86400, `periodDays=${over}`);
    }
});

test("the period the settings offer is the period the request may send", () => {
    // One value, three homes: the request clamp in api.js, the KConfigXT bound the
    // setting is stored under, and the spinner. Raising one alone re-opens the bug.
    const xml = readFileSync(new URL("../contents/config/main.xml", import.meta.url), "utf8");
    const entry = /<entry name="costPeriodDays"[^>]*>([\s\S]*?)<\/entry>/.exec(xml);
    assert.ok(entry, "contents/config/main.xml has a costPeriodDays entry");
    const max = /<max>(\d+)<\/max>/.exec(entry[1]);
    assert.ok(max, "costPeriodDays has a max");
    assert.equal(Number(max[1]), api.MAX_USAGE_DAYS, "KConfigXT costPeriodDays max");

    const page = readFileSync(new URL("../contents/ui/ConfigGeneral.qml", import.meta.url), "utf8");
    assert.match(page, /to: Api\.MAX_USAGE_DAYS/, "the period spinner must read the constant");
});

/*
    End to end, on the payload shapes the platform really returns: the mock's data
    is invented (see its header comment), and the widget's own parsing and
    aggregation have to reproduce the totals the mock declares. That is what keeps
    the two halves of the fixture from drifting apart.
*/
test("the pipeline reproduces the mock's own totals", () => {
    const envelope = text => api.parseEnvelope(text);

    const cost = envelope(JSON.stringify(costPayload()));
    const amount = envelope(JSON.stringify(amountPayload()));
    const summary = api.parseSummary(envelope(JSON.stringify(summaryPayload())).biz);
    assert.equal(cost.ok, true);
    assert.equal(amount.ok, true);

    // The summary cards.
    assert.equal(summary.balance, 12.48);
    assert.equal(summary.bonus, 0);
    assert.equal(summary.totalCost, 4.62);

    // The "Last 30 days" row: cost, requests and tokens.
    const agg = api.aggregateUsage(cost.biz, amount.biz);
    assert.ok(Math.abs(agg.totals.cost - 4.62) < 1e-9, `cost ${agg.totals.cost}`);
    assert.equal(agg.totals.requests, 910);
    assert.equal(api.totalTokens(agg.totals), 159098619);

    // Only four of the thirty days have activity, and every one of them falls
    // inside the window the widget asks for -- that is Api.usageWindow's job.
    const now = new Date();
    const w = api.usageWindow(now, 30);
    assert.equal(agg.perDay.length, 4);
    for (const day of agg.perDay) {
        assert.ok(day.time >= w.start && day.time < w.end, `bucket ${day.time} outside the window`);
        // The sparkline places a bucket in slot (time - windowStart) / 86400, so
        // that only lands on a whole slot while buckets stay day-aligned.
        assert.equal((day.time - w.start) % 86400, 0, `bucket ${day.time} is not day-aligned`);
    }
    assert.equal(agg.perDay[0].time, api.daysAgo(now, 4));
    assert.equal(agg.perDay[agg.perDay.length - 1].time, api.startOfToday(now));

    // "Today" is the bucket at the local midnight, which is what the row sums.
    const today = api.bucketForDay(agg.perDay, api.startOfToday(now));
    assert.ok(Math.abs(today.cost - 1.31) < 1e-9, `today ${today.cost}`);

    // The two endpoints have to agree per day, or the In/Out split would mix
    // one day's tokens with another day's cost.
    assert.equal(agg.totals.cacheHit + agg.totals.cacheMiss + agg.totals.response, api.totalTokens(agg.totals));
});
