/*
    SPDX-FileCopyrightText: 2026 cassidy
    SPDX-License-Identifier: GPL-2.0-or-later

    Pure formatting helpers. No Qt/QML APIs are used here so the file can be
    unit-tested with node:test (see tests/format.test.mjs).
*/

function currencySymbol(code) {
    switch ((code || "").toUpperCase()) {
    case "USD":
        return "$";
    case "CNY":
        return "\u00A5";
    case "EUR":
        return "\u20AC";
    default:
        return code ? code + " " : "";
    }
}

function toNumber(value) {
    if (typeof value === "number") {
        return isFinite(value) ? value : NaN;
    }
    var n = parseFloat(value);
    return isNaN(n) ? NaN : n;
}

// Money with currency symbol; small amounts keep more precision.
function money(value, currency, decimals) {
    var n = toNumber(value);
    if (isNaN(n)) {
        return "\u2014";
    }
    var d = decimals;
    if (d === undefined || d === null) {
        var abs = Math.abs(n);
        d = abs === 0 ? 2 : abs < 0.01 ? 4 : abs < 1 ? 3 : 2;
    }
    return currencySymbol(currency) + n.toFixed(d);
}

function oneDecimal(x) {
    var r = Math.round(x * 10) / 10;
    return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

// 1234567 -> "1.2M"
function compactNumber(value) {
    var n = toNumber(value);
    if (isNaN(n)) {
        return "\u2014";
    }
    var a = Math.abs(n);
    if (a >= 1e9) {
        return oneDecimal(n / 1e9) + "B";
    }
    if (a >= 1e6) {
        return oneDecimal(n / 1e6) + "M";
    }
    if (a >= 1e3) {
        return oneDecimal(n / 1e3) + "K";
    }
    return String(Math.round(n));
}

function tokens(value) {
    return compactNumber(value);
}

// Exact count with thousands separators: 297270684 -> "297,270,684". Used in
// the popup, where the point is to be checkable against the platform's own
// figures; compactNumber() stays for the panel, where space is tight.
function grouped(value) {
    var n = toNumber(value);
    if (isNaN(n)) {
        return "\u2014";
    }
    var rounded = Math.round(n);
    var digits = String(Math.abs(rounded));
    var out = "";
    for (var i = 0; i < digits.length; i++) {
        if (i > 0 && (digits.length - i) % 3 === 0) {
            out += ",";
        }
        out += digits.charAt(i);
    }
    return (rounded < 0 ? "-" : "") + out;
}

// Balance divided by an average daily spend; null when burn is not positive.
function daysLeft(balance, burnPerDay) {
    var b = toNumber(balance);
    var r = toNumber(burnPerDay);
    if (isNaN(b) || isNaN(r) || r <= 0) {
        return null;
    }
    return b / r;
}

function daysLeftText(balance, burnPerDay) {
    var d = daysLeft(balance, burnPerDay);
    if (d === null) {
        return "\u2014";
    }
    if (d >= 365) {
        return ">1y";
    }
    if (d >= 10) {
        return String(Math.floor(d)) + "d";
    }
    return oneDecimal(d) + "d";
}

// Privacy mode: replace a rendered value with bullets.
function hideable(text, hidden) {
    return hidden ? "\u2022\u2022\u2022" : text;
}

function percent(part, whole) {
    var p = toNumber(part);
    var w = toNumber(whole);
    if (isNaN(p) || isNaN(w) || w <= 0) {
        return "\u2014";
    }
    return Math.round((p / w) * 100) + "%";
}

/* ---------------------------------------------------------- panel metric */

// Values are stored in the config and shown in the panel. The order matches
// the combo box in ConfigGeneral.qml.
var METRIC_BALANCE = 0;
var METRIC_TODAY_COST = 1;
var METRIC_TODAY_TOKENS = 2;
var METRIC_PERIOD_COST = 3;
var METRIC_LIFETIME_COST = 4;

// Renders the number shown on the panel for `metric`.
// `values` fields: currency, balance, todayCost, todayTokens, periodCost,
// lifetimeCost, hasLifetime, hidden.
function metricText(metric, values) {
    var v = values || {};
    var text;
    switch (metric) {
    case METRIC_TODAY_COST:
        text = money(v.todayCost, v.currency);
        break;
    case METRIC_TODAY_TOKENS:
        text = tokens(v.todayTokens);
        break;
    case METRIC_PERIOD_COST:
        text = money(v.periodCost, v.currency);
        break;
    case METRIC_LIFETIME_COST:
        text = v.hasLifetime ? money(v.lifetimeCost, v.currency) : "\u2014";
        break;
    case METRIC_BALANCE:
    default:
        text = money(v.balance, v.currency);
        break;
    }
    return hideable(text, !!v.hidden);
}

// "2026-09-26" -> "09-26" is useful for compact day labels.
function shortDay(epochSeconds) {
    var d = new Date(epochSeconds * 1000);
    var m = String(d.getMonth() + 1).padStart(2, "0");
    var day = String(d.getDate()).padStart(2, "0");
    return m + "-" + day;
}
