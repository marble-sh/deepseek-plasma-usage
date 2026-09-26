/*
    SPDX-FileCopyrightText: 2026 cassidy
    SPDX-License-Identifier: GPL-2.0-or-later

    DeepSeek's peak / off-peak pricing schedule.

    Documented rule (https://api-docs.deepseek.com/quick_start/pricing, quoted):
    "Off-peak rates are half of the peak rates. Peak hours are 01:00 - 04:00 and
     06:00 - 10:00 UTC, Monday through Friday, excluding Chinese public holidays.
     All other hours are off-peak, including weekends and Chinese public holidays
     in full."

    So the whole schedule is deterministic except the holiday list, which the
    State Council announces roughly a month before each year and can revise
    during it. No pure-JS source for those dates is reliable, so the table below
    is deliberately empty and hand-maintained: while it is empty the widget never
    claims a discount that is not there — it just reports peak on the handful of
    holiday weekdays. See the README section on the peak indicator.

    No Qt APIs are used here, so it is unit-tested with node:test
    (see tests/peak.test.mjs).
*/

// Peak windows in UTC hours: start inclusive, end exclusive.
var PEAK_WINDOWS_UTC = [[1, 4], [6, 10]];

// China Standard Time is UTC+8 and has had no DST since 1991.
var CHINA_UTC_OFFSET_MS = 8 * 3600000;

// Chinese public holidays, as "YYYY-MM-DD" in China Standard Time. A holiday is
// off-peak for its whole day, even in the middle of a peak window.
//
// Maintained by hand. Add the dates announced by the State Council for the year
// (they are published each November/December for the following year); DeepSeek
// follows the same list. Keep older years: they cost nothing and keep the
// function correct if it is used on a historical timestamp.
var CHINESE_HOLIDAYS = {
};

var DAY_MS = 86400000;

function pad2(value) {
    return (value < 10 ? "0" : "") + value;
}

// The calendar date in China for an instant, as "YYYY-MM-DD".
function chinaDate(ms) {
    var shifted = new Date(ms + CHINA_UTC_OFFSET_MS);
    return shifted.getUTCFullYear() + "-" + pad2(shifted.getUTCMonth() + 1) + "-" + pad2(shifted.getUTCDate());
}

function isHoliday(ms, holidays) {
    var table = holidays === undefined ? CHINESE_HOLIDAYS : holidays;
    return Object.prototype.hasOwnProperty.call(table, chinaDate(ms));
}

// True when DeepSeek charges full (peak) rates at the given instant.
function isPeak(ms, holidays) {
    var date = new Date(ms);

    // Weekends are always off-peak.
    var weekday = date.getUTCDay();
    if (weekday === 0 || weekday === 6) {
        return false;
    }
    if (isHoliday(ms, holidays)) {
        return false;
    }

    var hour = date.getUTCHours();
    for (var i = 0; i < PEAK_WINDOWS_UTC.length; i++) {
        if (hour >= PEAK_WINDOWS_UTC[i][0] && hour < PEAK_WINDOWS_UTC[i][1]) {
            return true;
        }
    }
    return false;
}

// The next instant at which isPeak() flips, or null if it does not flip within
// `maxDays`. Minutes are the resolution the schedule is defined at.
function nextChange(ms, holidays, maxDays) {
    var limit = maxDays === undefined ? 8 : maxDays;
    var state = isPeak(ms, holidays);
    // Start at the next whole minute so the answer reads as a clock time.
    var step = 60000;
    var cursor = Math.floor(ms / step) * step + step;
    var end = ms + limit * DAY_MS;

    while (cursor < end) {
        if (isPeak(cursor, holidays) !== state) {
            return cursor;
        }
        cursor += step;
    }
    return null;
}

// Milliseconds until the state changes; null when it does not within `maxDays`.
function msUntilChange(ms, holidays, maxDays) {
    var next = nextChange(ms, holidays, maxDays);
    return next === null ? null : next - ms;
}
