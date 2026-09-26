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
    // CLDR tells CNY and JPY apart in English, and uses the code for some
    // currencies; a bare code is spaced off the digits with a no-break space.
    assert.equal(fmt.money(110, "CNY"), "CN\u00A5110.00");
    assert.equal(fmt.money(110, "CNY", "zh_CN"), "\u00A5110.00");
    // The symbol list wins over ICU's English habit of spelling out the code.
    assert.equal(fmt.money(1, "SEK"), "kr\u00A01.00");
    assert.equal(fmt.money(1, "RUB"), "\u20BD1.00");
    assert.equal(fmt.money(1, "XYZ"), "XYZ\u00A01.00");
    assert.equal(fmt.money(1, ""), "1.00");
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
    hidden: false
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

// The popup shows exact counts so its figures can be reconciled with the
// platform's own page; compactNumber() remains the panel's form.
test("grouped renders exact counts with thousands separators", () => {
    assert.equal(fmt.grouped(0), "0");
    assert.equal(fmt.grouped(7), "7");
    assert.equal(fmt.grouped(999), "999");
    assert.equal(fmt.grouped(1000), "1,000");
    assert.equal(fmt.grouped(1325), "1,325");
    assert.equal(fmt.grouped(297270684), "297,270,684");
    assert.equal(fmt.grouped(1234567890123), "1,234,567,890,123");
    assert.equal(fmt.grouped(1234.6), "1,235"); // rounds, never truncates
    assert.equal(fmt.grouped("-1234"), "-1,234");
    assert.equal(fmt.grouped("297270684"), "297,270,684"); // API values are strings
    assert.equal(fmt.grouped(NaN), "\u2014");
    assert.equal(fmt.grouped("nonsense"), "\u2014");
});

/*
    Number and money rendering per locale, transcribed from CLDR through ICU.
    `node -e 'new Intl.NumberFormat("es-CL", {style:"currency",
    currency:"USD"}).format(1234567.89)'` prints the money column, which is how the
    table in format.js was written; these assertions are that same output, so a bad
    transcription fails here instead of only in a screenshot.
*/
const LOCALE_CASES = [
    // locale,      number for 1234567.89,   money for 1234567.89 USD
    ["en_US", "1,234,567.89", "$1,234,567.89"],
    ["en", "1,234,567.89", "$1,234,567.89"],
    ["en_IN", "12,34,567.89", "$12,34,567.89"], // Indian grouping: 2,2,3
    ["hi_IN", "12,34,567.89", "$12,34,567.89"],
    ["zh_CN", "1,234,567.89", "US$1,234,567.89"], // US$ so it is not read as \u00A5
    ["id_ID", "1.234.567,89", "US$1.234.567,89"],
    ["fr_FR", "1\u202F234\u202F567,89", "1\u202F234\u202F567,89\u00A0$US"],
    ["ru_RU", "1\u00A0234\u00A0567,89", "1\u00A0234\u00A0567,89\u00A0$"],
    ["ru_BY", "1\u00A0234\u00A0567,89", "1\u00A0234\u00A0567,89\u00A0$"],
    ["es_ES", "1.234.567,89", "1.234.567,89\u00A0US$"],
    ["es", "1.234.567,89", "1.234.567,89\u00A0US$"], // a bare "es" is Spain
    ["es_419", "1,234,567.89", "USD\u00A01,234,567.89"],
    ["es_CL", "1.234.567,89", "US$1.234.567,89"],
    ["es_AR", "1.234.567,89", "US$\u00A01.234.567,89"],
    ["es_MX", "1,234,567.89", "USD\u00A01,234,567.89"],
    ["es_CU", "1,234,567.89", "US$1,234,567.89"],
    // Unknown tags fall back to English rather than throwing.
    ["pt_PT", "1,234,567.89", "$1,234,567.89"],
    ["", "1,234,567.89", "$1,234,567.89"],
    ["zh_Hans_CN", "1,234,567.89", "US$1,234,567.89"]
];

test("numbers and money follow the locale", () => {
    for (const [locale, number, money] of LOCALE_CASES) {
        assert.equal(fmt.formatNumber(1234567.89, locale, 2), number, `number ${locale}`);
        assert.equal(fmt.money(1234567.89, "USD", locale, 2), money, `money ${locale}`);
    }
});

test("grouping only applies where CLDR says it does", () => {
    // Spain's minimumGroupingDigits is 2: one separator would leave a lone
    // leading digit, so 1000 has none while longer numbers still group.
    assert.equal(fmt.formatNumber(1000, "es_ES", 2), "1000,00");
    assert.equal(fmt.formatNumber(10000, "es_ES", 2), "10.000,00");
    assert.equal(fmt.formatNumber(1234567890, "es_ES", 2), "1.234.567.890,00");
    // Its Latin-American neighbours do group 1000.
    assert.equal(fmt.formatNumber(1000, "es_CL", 2), "1.000,00");
    assert.equal(fmt.formatNumber(1000, "es_MX", 2), "1,000.00");
    assert.equal(fmt.formatNumber(1000, "en_IN", 2), "1,000.00");
});

test("the compact panel form takes the locale's decimal separator", () => {
    // The K/M/B suffix stays Latin; see the note on compactNumber.
    assert.equal(fmt.compactNumber(1500000, "en_US"), "1.5M");
    assert.equal(fmt.compactNumber(1500000, "fr_FR"), "1,5M");
    assert.equal(fmt.compactNumber(1500000, "id_ID"), "1,5M");
    assert.equal(fmt.compactNumber(1500000, "zh_CN"), "1.5M");
    assert.equal(fmt.compactNumber(297270684, "fr_FR"), "297,3M");
});

test("days left and the panel metric take the locale too", () => {
    assert.equal(fmt.daysLeftText(2.5, 1, "en_US"), "2.5d");
    assert.equal(fmt.daysLeftText(2.5, 1, "fr_FR"), "2,5d");
    assert.equal(
        fmt.metricText(fmt.METRIC_BALANCE, Object.assign({}, metricValues, { locale: "fr_FR" })),
        "7,78\u00A0$US"
    );
    assert.equal(fmt.metricText(fmt.METRIC_TODAY_TOKENS, Object.assign({}, metricValues, { locale: "fr_FR" })), "1,5M");
});
