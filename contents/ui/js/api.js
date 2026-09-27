/*
    SPDX-FileCopyrightText: 2026 cassidy
    SPDX-License-Identifier: GPL-2.0-or-later

    Pure request-building / response-parsing / aggregation logic for the
    DeepSeek balance + usage widget. Verified endpoint contract:
    docs/state/api-contract.md. No Qt APIs are used here so the file can be
    unit-tested with node:test (see tests/api.test.mjs).
*/

var PLATFORM_BASE = "https://platform.deepseek.com/api/v0";
var OFFICIAL_BALANCE_URL = "https://api.deepseek.com/user/balance";

/* ------------------------------------------------------------------ urls */

function encodeQuery(params) {
    var parts = [];
    for (var key in params) {
        if (!Object.prototype.hasOwnProperty.call(params, key)) {
            continue;
        }
        var value = params[key];
        if (value === undefined || value === null) {
            continue;
        }
        parts.push(encodeURIComponent(key) + "=" + encodeURIComponent(value));
    }
    return parts.join("&");
}

function platformUrl(path, params) {
    var query = encodeQuery(params || {});
    return PLATFORM_BASE + path + (query ? "?" + query : "");
}

function summaryUrl() {
    return platformUrl("/users/get_user_summary", {});
}

// kind: "amount" (tokens) | "cost". Times are epoch seconds.
function usageUrl(kind, startSec, endSec, tzOffsetSec) {
    return platformUrl("/usage/by_api_key/" + kind, {
        start: startSec,
        end: endSec,
        tz: tzOffsetSec
    });
}

/* ------------------------------------------------------------ time helpers */

// Offset (seconds east of UTC) matching the `tz` query parameter.
function tzOffsetSeconds(now) {
    return -new Date(now).getTimezoneOffset() * 60;
}

function midnight(dateObj) {
    var d = new Date(dateObj);
    d.setHours(0, 0, 0, 0);
    return Math.floor(d.getTime() / 1000);
}

function startOfToday(now) {
    return midnight(now);
}

function startOfMonth(now) {
    var d = new Date(now);
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return Math.floor(d.getTime() / 1000);
}

function daysAgo(now, days) {
    var d = new Date(now);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - days);
    return Math.floor(d.getTime() / 1000);
}

// Query window for the two usage endpoints: `periodDays` local days ending with
// today. `start` is inclusive, `end` is exclusive (tomorrow's local midnight),
// so the two are exactly periodDays * 86400 apart and the bucket at `start` is
// the oldest day included.
//
// The recorded live probe (docs/state/api-contract.md) asked for
// [2026-08-28T00:00-03:00, 2026-09-27T00:00-03:00) on 2026-09-26, which is
// daysAgo(29) to tomorrow -- the window the platform's own page labels
// "Last 30 days". Subtracting the whole period instead would ask for 31 days and
// silently inflate every period total by one day's spend.
function usageWindow(now, periodDays) {
    var days = toNumber(periodDays);
    if (!isFinite(days) || days < 1) {
        days = 1;
    }
    days = Math.floor(days);
    return { start: daysAgo(now, days - 1), end: startOfToday(now) + 86400 };
}

/* ---------------------------------------------------------- parse helpers */

function toNumber(value) {
    if (typeof value === "number") {
        return isFinite(value) ? value : 0;
    }
    var n = parseFloat(value);
    return isNaN(n) ? 0 : n;
}

// The platform API returns HTTP 200 even for auth failures, so callers must
// branch on the JSON `code`, never on the HTTP status.
function parseEnvelope(text) {
    var obj;
    try {
        obj = JSON.parse(text);
    } catch (e) {
        return { ok: false, code: -1, msg: "Invalid JSON response", biz: null };
    }
    if (!obj || typeof obj !== "object") {
        return { ok: false, code: -2, msg: "Empty response", biz: null };
    }
    var code = typeof obj.code === "number" ? obj.code : -3;
    if (code !== 0) {
        return { ok: false, code: code, msg: obj.msg || "Request failed", biz: null };
    }
    var biz = obj.data && obj.data.biz_data ? obj.data.biz_data : null;
    if (!biz) {
        return { ok: false, code: -4, msg: "Missing payload", biz: null };
    }
    return { ok: true, code: 0, msg: "", biz: biz };
}

function parseSummary(biz) {
    var normal = (biz.normal_wallets || [])[0] || {};
    var bonus = (biz.bonus_wallets || [])[0] || {};
    var costs = (biz.total_costs || [])[0] || {};
    return {
        currency: normal.currency || costs.currency || bonus.currency || "",
        balance: toNumber(normal.balance),
        bonus: toNumber(bonus.balance),
        totalCost: toNumber(costs.amount)
    };
}

// Official endpoint payload; returns null when unparseable (e.g. the plain
// "Authentication Fails" text a bad key produces).
function parseOfficialBalance(text) {
    var obj;
    try {
        obj = JSON.parse(text);
    } catch (e) {
        return null;
    }
    if (!obj || !obj.balance_infos || !obj.balance_infos.length) {
        return null;
    }
    var b = obj.balance_infos[0];
    return {
        currency: b.currency || "",
        total: toNumber(b.total_balance),
        granted: toNumber(b.granted_balance),
        toppedUp: toNumber(b.topped_up_balance),
        available: obj.is_available !== false
    };
}

/* ------------------------------------------------------------ credentials */

/*
    A pasted session token is very often one layer more than the token itself, and
    every extra layer fails the same way: the platform answers HTTP 200 with
    `code:40003`, "Authorization Failed (invalid token)".

    The layer that catches everybody is the storage format. In the platform's
    DevTools the `userToken` entry does not hold the token, it holds a *JSON object*:

        {"value":"<token>","__version":"0"}

    so following "copy its value" literally copies the wrapper, and the request goes
    out as `authorization: Bearer {"value":"...","__version":"0"}`. A quoted copy,
    or a whole `Bearer <token>` header pasted from the network tab, fails the same
    way.

    Peel those off here rather than in the UI, so the wallet may hold any of them and
    every caller still gets a bare token. Deliberately conservative: anything that is
    not one of those wrappers is returned unchanged, because mangling a real token
    would be worse than rejecting it.
*/
function normalizeSessionToken(raw) {
    var value = raw === undefined || raw === null ? "" : String(raw);
    // Repeats because more than one layer can be wrapped at once, e.g. a quoted
    // JSON object. It stops as soon as a pass changes nothing.
    for (var pass = 0; pass < 4; pass++) {
        var before = value;
        value = value.trim();

        // A whole `Bearer <token>` header pasted from the network tab.
        var bearer = /^Bearer[ \t]+/i.exec(value);
        if (bearer) {
            value = value.slice(bearer[0].length).trim();
        }

        // JSON turns up as the storage wrapper (an object with `value`), as a
        // quoted string, and as an escaped quoted string, depending on where the
        // copy was taken from. One parse handles all three, and a parse that throws
        // or lands on anything that is not a string is left alone — mangling a real
        // token would be worse than rejecting it.
        var parsed = parseJson(value);
        if (typeof parsed === "string") {
            value = parsed.trim();
        } else if (parsed && typeof parsed.value === "string") {
            value = parsed.value.trim();
        }

        if (value === before) {
            break;
        }
    }
    return value;
}

// JSON.parse without the throw, so "not JSON" can be told apart from a value.
function parseJson(text) {
    try {
        return JSON.parse(text);
    } catch (error) {
        return null;
    }
}

// The one place the platform's auth header is built, so whatever a caller calls a
// session token, what goes on the wire is a bare one.
function authHeaders(sessionToken) {
    return { authorization: "Bearer " + normalizeSessionToken(sessionToken) };
}

/* --------------------------------------------------------- token algebra */

function inputTokens(bucket) {
    return toNumber(bucket.cacheHit) + toNumber(bucket.cacheMiss);
}

function outputTokens(bucket) {
    return toNumber(bucket.response);
}

function totalTokens(bucket) {
    return inputTokens(bucket) + outputTokens(bucket);
}

/* ----------------------------------------------------------- aggregation */

function emptyTotals() {
    return { cost: 0, response: 0, cacheHit: 0, cacheMiss: 0, requests: 0 };
}

function emptyAggregate() {
    return { currency: "", perDay: [], perKey: [], totals: emptyTotals() };
}

function keyId(apiKey) {
    if (!apiKey) {
        return "unknown";
    }
    return apiKey.tracking_id || apiKey.sensitive_id || apiKey.name || "unknown";
}

function keyEntry(map, apiKey) {
    var id = keyId(apiKey);
    var entry = map[id];
    if (!entry) {
        entry = {
            id: id,
            name: apiKey && apiKey.name ? apiKey.name : id,
            maskedId: apiKey && apiKey.sensitive_id ? apiKey.sensitive_id : "",
            cost: 0,
            response: 0,
            cacheHit: 0,
            cacheMiss: 0,
            requests: 0
        };
        map[id] = entry;
    }
    return entry;
}

function dayEntry(map, time) {
    var entry = map[time];
    if (!entry) {
        entry = { time: time, cost: 0, response: 0, cacheHit: 0, cacheMiss: 0, requests: 0 };
        map[time] = entry;
    }
    return entry;
}

// Merge the two usage endpoints (cost + amount) into one per-key / per-day view.
function aggregateUsage(costBiz, amountBiz) {
    var byKey = {};
    var byDay = {};
    var currency = "";

    if (costBiz && costBiz.data) {
        for (var c = 0; c < costBiz.data.length; c++) {
            var cur = costBiz.data[c];
            if (!currency && cur.currency) {
                currency = cur.currency;
            }
            var cseries = cur.series || [];
            for (var s = 0; s < cseries.length; s++) {
                var cs = cseries[s];
                var kce = keyEntry(byKey, cs.api_key);
                var cbuckets = cs.buckets || [];
                for (var b = 0; b < cbuckets.length; b++) {
                    var amount = toNumber(cbuckets[b].cost);
                    if (amount === 0) {
                        continue;
                    }
                    dayEntry(byDay, cbuckets[b].time).cost += amount;
                    kce.cost += amount;
                }
            }
        }
    }

    if (amountBiz && amountBiz.series) {
        for (var a = 0; a < amountBiz.series.length; a++) {
            var as = amountBiz.series[a];
            var kae = keyEntry(byKey, as.api_key);
            var abuckets = as.buckets || [];
            for (var ub = 0; ub < abuckets.length; ub++) {
                var usage = abuckets[ub].usage || {};
                var r = toNumber(usage.RESPONSE_TOKEN);
                var ch = toNumber(usage.PROMPT_CACHE_HIT_TOKEN);
                var cm = toNumber(usage.PROMPT_CACHE_MISS_TOKEN);
                var rq = toNumber(usage.REQUEST);
                if (r === 0 && ch === 0 && cm === 0 && rq === 0) {
                    continue;
                }
                var de = dayEntry(byDay, abuckets[ub].time);
                de.response += r;
                de.cacheHit += ch;
                de.cacheMiss += cm;
                de.requests += rq;
                kae.response += r;
                kae.cacheHit += ch;
                kae.cacheMiss += cm;
                kae.requests += rq;
            }
        }
    }

    var perDay = [];
    for (var dayKey in byDay) {
        if (Object.prototype.hasOwnProperty.call(byDay, dayKey)) {
            perDay.push(byDay[dayKey]);
        }
    }
    perDay.sort(function (x, y) {
        return x.time - y.time;
    });

    var perKey = [];
    for (var key in byKey) {
        if (Object.prototype.hasOwnProperty.call(byKey, key)) {
            perKey.push(byKey[key]);
        }
    }
    perKey.sort(function (x, y) {
        return y.cost - x.cost || totalTokens(y) - totalTokens(x);
    });

    var totals = emptyTotals();
    for (var i = 0; i < perDay.length; i++) {
        totals.cost += perDay[i].cost;
        totals.response += perDay[i].response;
        totals.cacheHit += perDay[i].cacheHit;
        totals.cacheMiss += perDay[i].cacheMiss;
        totals.requests += perDay[i].requests;
    }

    return { currency: currency, perDay: perDay, perKey: perKey, totals: totals };
}

// Sum every bucket at or after `sinceSec`.
function sumSince(perDay, sinceSec) {
    var totals = emptyTotals();
    for (var i = 0; i < perDay.length; i++) {
        if (perDay[i].time >= sinceSec) {
            totals.cost += perDay[i].cost;
            totals.response += perDay[i].response;
            totals.cacheHit += perDay[i].cacheHit;
            totals.cacheMiss += perDay[i].cacheMiss;
            totals.requests += perDay[i].requests;
        }
    }
    return totals;
}

function bucketForDay(perDay, dayStartSec) {
    for (var i = 0; i < perDay.length; i++) {
        if (perDay[i].time === dayStartSec) {
            return perDay[i];
        }
    }
    return { time: dayStartSec, cost: 0, response: 0, cacheHit: 0, cacheMiss: 0, requests: 0 };
}

// Average daily spend over the trailing `days` that contain any activity.
function averageDailyCost(perDay, days) {
    if (!perDay.length) {
        return 0;
    }
    var tail = perDay.slice(Math.max(0, perDay.length - days));
    var cost = 0;
    for (var i = 0; i < tail.length; i++) {
        cost += tail[i].cost;
    }
    return cost / days;
}
