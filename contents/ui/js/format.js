/*
    SPDX-FileCopyrightText: 2026 cassidy
    SPDX-License-Identifier: GPL-2.0-or-later

    Pure formatting helpers. No Qt/QML APIs are used here so the file can be
    unit-tested with node:test (see tests/format.test.mjs) -- which also means
    Intl is *not* available in the app, so the locale data below is spelled out
    rather than looked up.

    Every locale's number and money rules were transcribed from CLDR through
    ICU, using Node's full-ICU Intl.NumberFormat:

        node -e 'new Intl.NumberFormat("es-CL", {style:"currency",
                 currency:"USD"}).format(1234567.89)'

    so they can be re-derived after a CLDR update rather than guessed at. The
    cases that matter are in tests/format.test.mjs, one per locale family.
*/

/* --------------------------------------------------------- currency symbols */

// Fallback symbols by ISO 4217 code, used when a locale does not override them
// (CLDR does: Chinese writes USD as "US$", French as "$US", Latin-American
// Spanish as "USD"). Taken from the commonly published symbol list rather than
// from ICU's English names, because ICU falls back to the *code* for several of
// these (RUB and CHF render as "RUB"/"CHF" in en-US, but the symbols are what a
// reader expects elsewhere).
var CURRENCY_SYMBOLS = {
    USD: "$",
    CNY: "\u00A5",
    EUR: "\u20AC",
    GBP: "\u00A3",
    JPY: "\u00A5",
    HKD: "HK$",
    SGD: "S$",
    KRW: "\u20A9",
    INR: "\u20B9",
    RUB: "\u20BD",
    TWD: "NT$",
    BRL: "R$",
    MXN: "MX$",
    AUD: "A$",
    CAD: "CA$",
    CHF: "CHF",
    SEK: "kr",
    NOK: "kr",
    DKK: "kr",
    PLN: "z\u0142",
    TRY: "\u20BA",
    ZAR: "R",
    AED: "AED",
    SAR: "SAR",
    THB: "\u0E3F",
    VND: "\u20AB",
    PHP: "\u20B1",
    MYR: "RM",
    IDR: "Rp",
    NZD: "NZ$"
};

/* ---------------------------------------------------- number and money rules */

/*
    Per locale:

      group    thousands separator
      decimal  fraction separator
      indian   group by two after the hundreds (1,23,45,678) instead of by three
      before   put the currency symbol before the digits
      gap      what goes between the symbol and the digits (usually a no-break
               space after a multi-letter symbol, nothing after a sign)
      minGroup CLDR's minimumGroupingDigits: 2 means a single leading digit is not
               worth a separator, so 1000 prints "1000,00" while 12345 prints
               "12.345,00" (only Spain, of the locales here, does this)
      symbols  per-currency symbol override

    Anything not listed falls back to the language ("es-CL" -> "es" -> "en"), and
    a symbol that is a bare three-letter code always takes a no-break space, which
    is what CLDR does and what makes "USD 1,234.56" come out right.
*/
var NUMBER_FORMATS = {
    en: {
        group: ",",
        decimal: ".",
        before: true,
        gap: "",
        symbols: { USD: "$", CNY: "CN\u00A5", EUR: "\u20AC" }
    },
    "en-IN": {
        group: ",",
        decimal: ".",
        indian: true,
        before: true,
        gap: "",
        symbols: { USD: "$", CNY: "CN\u00A5", EUR: "\u20AC" }
    },
    zh: {
        group: ",",
        decimal: ".",
        before: true,
        gap: "",
        symbols: { USD: "US$", CNY: "\u00A5", EUR: "\u20AC" }
    },
    hi: {
        group: ",",
        decimal: ".",
        indian: true,
        before: true,
        gap: "",
        symbols: { USD: "$", CNY: "CN\u00A5", EUR: "\u20AC" }
    },
    id: {
        group: ".",
        decimal: ",",
        before: true,
        gap: "",
        symbols: { USD: "US$", CNY: "CN\u00A5", EUR: "\u20AC" }
    },
    fr: {
        group: "\u202F",
        decimal: ",",
        before: false,
        gap: "\u00A0",
        symbols: { USD: "$US", CNY: "CNY", EUR: "\u20AC" }
    },
    ru: {
        group: "\u00A0",
        decimal: ",",
        before: false,
        gap: "\u00A0",
        symbols: { USD: "$", CNY: "CN\u00A5", EUR: "\u20AC" }
    },
    // A bare "es" follows Spain, not Latin America (ICU: "1.234.567,89 US$").
    es: {
        group: ".",
        decimal: ",",
        before: false,
        gap: "\u00A0",
        minGroup: 2,
        symbols: { USD: "US$", CNY: "CNY", EUR: "\u20AC" }
    },
    "es-419": {
        group: ",",
        decimal: ".",
        before: true,
        gap: "",
        symbols: { USD: "USD", CNY: "CNY", EUR: "EUR" }
    },
    // Chile and Cuba tuck a sign against the digits but space a bare code out.
    "es-CL": {
        group: ".",
        decimal: ",",
        before: true,
        gap: "",
        symbols: { USD: "US$", CNY: "CNY", EUR: "EUR" }
    },
    "es-AR": {
        group: ".",
        decimal: ",",
        before: true,
        gap: "\u00A0",
        symbols: { USD: "US$", CNY: "CNY", EUR: "EUR" }
    },
    "es-MX": {
        group: ",",
        decimal: ".",
        before: true,
        gap: "",
        symbols: { USD: "USD", CNY: "CNY", EUR: "EUR" }
    },
    "es-CU": {
        group: ",",
        decimal: ".",
        before: true,
        gap: "",
        symbols: { USD: "US$", CNY: "CNY", EUR: "EUR" }
    }
};

var DEFAULT_LOCALE = "en";
var NO_BREAK_SPACE = "\u00A0";
var DASH = "\u2014";

function normalizeLocale(locale) {
    return String(locale === undefined || locale === null ? "" : locale).replace(/_/g, "-");
}

// "es_CL" -> "es-CL" -> "es" -> "en"; a locale with a script tag still resolves.
function numberFormat(locale) {
    var parts = normalizeLocale(locale).split("-");
    for (var i = parts.length; i > 0; i--) {
        var key = parts.slice(0, i).join("-");
        if (Object.prototype.hasOwnProperty.call(NUMBER_FORMATS, key)) {
            return NUMBER_FORMATS[key];
        }
    }
    return NUMBER_FORMATS[DEFAULT_LOCALE];
}

function toNumber(value) {
    if (typeof value === "number") {
        return isFinite(value) ? value : NaN;
    }
    var n = parseFloat(value);
    return isNaN(n) ? NaN : n;
}

// "12345678" -> "1,23,45,678" (indian) or "12,345,678".
function groupDigits(digits, fmt) {
    if (digits.length <= 3) {
        return digits;
    }
    // minimumGroupingDigits=2: exactly one separator would leave a lone leading
    // digit, so no separator at all. Longer numbers still group (verified: es-ES
    // prints "1000,00" but "12.345,00" and "1.234.567,89").
    if (fmt.minGroup === 2 && digits.length === 4) {
        return digits;
    }
    if (!fmt.indian) {
        var out = "";
        for (var i = 0; i < digits.length; i++) {
            if (i > 0 && (digits.length - i) % 3 === 0) {
                out += fmt.group;
            }
            out += digits.charAt(i);
        }
        return out;
    }
    var head = digits.slice(0, digits.length - 3);
    var groups = [digits.slice(digits.length - 3)];
    while (head.length > 2) {
        groups.unshift(head.slice(head.length - 2));
        head = head.slice(0, head.length - 2);
    }
    if (head.length) {
        groups.unshift(head);
    }
    return groups.join(fmt.group);
}

// Small amounts keep more precision than large ones, in cents at the default.
function defaultDecimals(n) {
    var abs = Math.abs(n);
    if (abs === 0) {
        return 2;
    }
    if (abs < 0.01) {
        return 4;
    }
    if (abs < 1) {
        return 3;
    }
    return 2;
}

// Exact number in the locale's own separators, e.g. "1.234.567,89" (es-ES).
function formatNumber(value, locale, decimals) {
    var n = toNumber(value);
    if (isNaN(n)) {
        return DASH;
    }
    var fmt = numberFormat(locale);
    var d = decimals === undefined || decimals === null ? defaultDecimals(n) : decimals;
    var fixed = Math.abs(n).toFixed(d);
    var dot = fixed.indexOf(".");
    var text = groupDigits(dot < 0 ? fixed : fixed.slice(0, dot), fmt);
    if (dot >= 0) {
        text += fmt.decimal + fixed.slice(dot + 1);
    }
    return (n < 0 ? "-" : "") + text;
}

// Exact count with no fraction, in the locale's grouping: 297270684 ->
// "297,270,684", or "29,72,70,684" in India. This is what the popup shows.
function grouped(value, locale) {
    return formatNumber(value, locale, 0);
}

// A symbol that is only letters (a currency code) is spaced away from the
// digits; a sign is not. Locales with their own gap keep it.
function moneyGap(symbol, fmt) {
    if (fmt.gap) {
        return fmt.gap;
    }
    return /^[A-Za-z]+$/.test(symbol) ? NO_BREAK_SPACE : "";
}

function money(value, currency, locale, decimals) {
    var n = toNumber(value);
    if (isNaN(n)) {
        return DASH;
    }
    var code = String(currency === undefined || currency === null ? "" : currency).toUpperCase();
    var text = formatNumber(n, locale, decimals);
    if (!code) {
        return text;
    }
    var fmt = numberFormat(locale);
    var symbol = Object.prototype.hasOwnProperty.call(fmt.symbols, code)
        ? fmt.symbols[code]
        : CURRENCY_SYMBOLS[code] || code;
    var gap = moneyGap(symbol, fmt);
    return fmt.before ? symbol + gap + text : text + gap + symbol;
}

/* -------------------------------------------------------------- counting */

function oneDecimal(x) {
    var r = Math.round(x * 10) / 10;
    return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

// 1234567 -> "1.2M" (or "1,2M"). The K/M/B suffixes stay Latin: CLDR has
// per-locale compact forms (zh "3亿", hi "29.7 क॰", ru "297,3 млн", fr "297,3 k")
// with their own divisors (10^4/10^8 for Chinese, 10^3/10^5/10^7 for Hindi),
// which are not implemented. Only the panel's token metric uses this, and the
// decimal separator is at least the locale's.
function compactNumber(value, locale) {
    var n = toNumber(value);
    if (isNaN(n)) {
        return DASH;
    }
    var a = Math.abs(n);
    var suffix = "";
    var scaled = n;
    if (a >= 1e9) {
        scaled = n / 1e9;
        suffix = "B";
    } else if (a >= 1e6) {
        scaled = n / 1e6;
        suffix = "M";
    } else if (a >= 1e3) {
        scaled = n / 1e3;
        suffix = "K";
    }
    if (!suffix) {
        return String(Math.round(n));
    }
    return oneDecimal(scaled).replace(".", numberFormat(locale).decimal) + suffix;
}

function tokens(value, locale) {
    return compactNumber(value, locale);
}

/* --------------------------------------------------------------- money math */

// Balance divided by an average daily spend; null when burn is not positive.
function daysLeft(balance, burnPerDay) {
    var b = toNumber(balance);
    var r = toNumber(burnPerDay);
    if (isNaN(b) || isNaN(r) || r <= 0) {
        return null;
    }
    return b / r;
}

function daysLeftText(balance, burnPerDay, locale) {
    var d = daysLeft(balance, burnPerDay);
    if (d === null) {
        return DASH;
    }
    if (d >= 365) {
        return ">1y";
    }
    if (d >= 10) {
        return String(Math.floor(d)) + "d";
    }
    return oneDecimal(d).replace(".", numberFormat(locale).decimal) + "d";
}

/* ------------------------------------------------------------------- misc */

// Privacy mode: replace a rendered value with bullets.
function hideable(text, hidden) {
    return hidden ? "\u2022\u2022\u2022" : text;
}

function percent(part, whole) {
    var p = toNumber(part);
    var w = toNumber(whole);
    if (isNaN(p) || isNaN(w) || w <= 0) {
        return DASH;
    }
    return Math.round((p / w) * 100) + "%";
}

// "2026-09-26" -> "09-26" is useful for compact day labels.
function shortDay(epochSeconds) {
    var d = new Date(epochSeconds * 1000);
    var m = String(d.getMonth() + 1).padStart(2, "0");
    var day = String(d.getDate()).padStart(2, "0");
    return m + "-" + day;
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
// `values` fields: currency, locale, balance, todayCost, todayTokens, periodCost,
// lifetimeCost, hasLifetime, hidden.
function metricText(metric, values) {
    var v = values || {};
    var text;
    switch (metric) {
        case METRIC_TODAY_COST:
            text = money(v.todayCost, v.currency, v.locale);
            break;
        case METRIC_TODAY_TOKENS:
            text = tokens(v.todayTokens, v.locale);
            break;
        case METRIC_PERIOD_COST:
            text = money(v.periodCost, v.currency, v.locale);
            break;
        case METRIC_LIFETIME_COST:
            text = v.hasLifetime ? money(v.lifetimeCost, v.currency, v.locale) : DASH;
            break;
        case METRIC_BALANCE:
        default:
            text = money(v.balance, v.currency, v.locale);
            break;
    }
    return hideable(text, !!v.hidden);
}
