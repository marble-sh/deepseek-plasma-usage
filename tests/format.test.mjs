/*
    SPDX-License-Identifier: GPL-2.0-or-later
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { load } from "./load.mjs";

const fmt = load("contents/ui/js/format.js");

test("money formats with currency symbols", () => {
    assert.equal(fmt.money(7.78, "USD"), "$7.78");
    assert.equal(fmt.money("7.78", "USD"), "$7.78");
    assert.equal(fmt.money(110, "CNY"), "\u00A5110.00");
    assert.equal(fmt.money(1, "SEK"), "SEK 1.00");
});

test("money uses more precision for small amounts", () => {
    assert.equal(fmt.money(0.0001, "USD"), "$0.0001");
    assert.equal(fmt.money(0.0123, "USD"), "$0.012");
    assert.equal(fmt.money(0.5, "USD"), "$0.500");
});

test("money handles invalid input", () => {
    assert.equal(fmt.money(NaN, "USD"), "\u2014");
    assert.equal(fmt.money("nope", "USD"), "\u2014");
});

test("compactNumber scales and trims", () => {
    assert.equal(fmt.compactNumber(0), "0");
    assert.equal(fmt.compactNumber(999), "999");
    assert.equal(fmt.compactNumber(1000), "1K");
    assert.equal(fmt.compactNumber(1234), "1.2K");
    assert.equal(fmt.compactNumber(1500000), "1.5M");
    assert.equal(fmt.compactNumber(2000000000), "2B");
    assert.equal(fmt.tokens(80441344), "80.4M");
});

test("daysLeft guards against non-positive burn", () => {
    assert.equal(fmt.daysLeft(10, 0), null);
    assert.equal(fmt.daysLeft(10, -1), null);
    assert.equal(fmt.daysLeft(10, NaN), null);
    assert.equal(fmt.daysLeft(10, 2), 5);
});

test("daysLeftText renders coarse buckets", () => {
    assert.equal(fmt.daysLeftText(10, 0), "\u2014");
    assert.equal(fmt.daysLeftText(400, 1), ">1y");
    assert.equal(fmt.daysLeftText(20, 1), "20d");
    assert.equal(fmt.daysLeftText(2.5, 1), "2.5d");
});

test("hideable masks values in privacy mode", () => {
    assert.equal(fmt.hideable("$3.20", false), "$3.20");
    assert.equal(fmt.hideable("$3.20", true), "\u2022\u2022\u2022");
});

test("percent and shortDay", () => {
    assert.equal(fmt.percent(1, 4), "25%");
    assert.equal(fmt.percent(1, 0), "\u2014");
    assert.match(fmt.shortDay(1790305200), /^\d\d-\d\d$/);
});

const metricValues = {
    currency: "USD",
    balance: 7.78,
    todayCost: 0.42,
    todayTokens: 1500000,
    periodCost: 2.2,
    lifetimeCost: 12.5,
    hasLifetime: true,
    hidden: false,
};

test("metricText selects the configured panel value", () => {
    assert.equal(fmt.metricText(fmt.METRIC_BALANCE, metricValues), "$7.78");
    assert.equal(fmt.metricText(fmt.METRIC_TODAY_COST, metricValues), "$0.420");
    assert.equal(fmt.metricText(fmt.METRIC_TODAY_TOKENS, metricValues), "1.5M");
    assert.equal(fmt.metricText(fmt.METRIC_PERIOD_COST, metricValues), "$2.20");
    assert.equal(fmt.metricText(fmt.METRIC_LIFETIME_COST, metricValues), "$12.50");
});

test("metricText falls back to balance and marks missing lifetime data", () => {
    assert.equal(fmt.metricText(undefined, metricValues), "$7.78");
    assert.equal(fmt.metricText(fmt.METRIC_LIFETIME_COST, { currency: "USD", hasLifetime: false }), "\u2014");
});

test("metricText honours privacy mode", () => {
    const hidden = Object.assign({}, metricValues, { hidden: true });
    assert.equal(fmt.metricText(fmt.METRIC_BALANCE, hidden), "\u2022\u2022\u2022");
    assert.equal(fmt.metricText(fmt.METRIC_TODAY_TOKENS, hidden), "\u2022\u2022\u2022");
});
