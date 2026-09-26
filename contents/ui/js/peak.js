/*
    SPDX-FileCopyrightText: 2026 cassidy
    SPDX-License-Identifier: GPL-2.0-or-later

    DeepSeek's peak / off-peak pricing schedule.

    Documented rule (https://api-docs.deepseek.com/quick_start/pricing, quoted):
    "Off-peak rates are half of the peak rates. Peak hours are 01:00 - 04:00 and
     06:00 - 10:00 UTC, Monday through Friday, excluding Chinese public holidays.
     All other hours are off-peak, including weekends and Chinese public holidays
     in full."

    The weekday and time-of-day part is exact. The holiday exception depends on a
    list the State Council publishes in November/December for the *following*
    year and can revise, so it is data that has to be maintained. This module
    therefore refuses to guess: when the table does not cover the year being
    asked about, state() reports "unknown" rather than pretending the day is a
    working day. That keeps the indicator from ever claiming a rate that is not
    in effect.

    No Qt APIs are used here, so it is unit-tested with node:test
    (see tests/peak.test.mjs), including a test that fails once the table no
    longer covers the current year.
*/

var PEAK = "peak";
var OFF_PEAK = "offPeak";
var UNKNOWN = "unknown";

// Peak windows in UTC hours: start inclusive, end exclusive.
var PEAK_WINDOWS_UTC = [[1, 4], [6, 10]];

// China Standard Time is UTC+8 and has had no DST since 1991.
var CHINA_UTC_OFFSET_MS = 8 * 3600000;

// How far ahead to look for the next change. A holiday block can keep the
// schedule unchanged for longer than a week: the 2026 Spring Festival runs
// 15-23 February, so off-peak lasts from Friday 13 February 10:00 UTC until
// Tuesday 24 February 01:00 UTC, which is over ten days.
var SCAN_HORIZON_DAYS = 14;

var DAY_MS = 86400000;

// Chinese public holidays, as China Standard Time dates, covering the whole
// published block for each holiday (the days the country is actually closed)
// rather than only the statutory days: DeepSeek is a Chinese company excluding
// its national holidays, and the blocks are what the State Council publishes.
//
// Only announced years belong here. Estimates must not be added: a wrong entry
// can claim a discount that does not exist, which is worse than admitting the
// year is unknown.
//
// 2026: General Office of the State Council schedule, as published (the
// original release is on gov.cn).
var CHINESE_HOLIDAYS = {};

// Adds every China-time date from `from` to `to`, inclusive, as "YYYY-MM-DD".
function addRange(from, to) {
    var cursor = Date.parse(from + "T00:00:00Z");
    var stop = Date.parse(to + "T00:00:00Z");
    while (cursor <= stop) {
        CHINESE_HOLIDAYS[new Date(cursor).toISOString().substring(0, 10)] = true;
        cursor += DAY_MS;
    }
}

addRange("2026-01-01", "2026-01-03"); // New Year
addRange("2026-02-15", "2026-02-23"); // Spring Festival
addRange("2026-04-04", "2026-04-06"); // Ching Ming
addRange("2026-05-01", "2026-05-05"); // Labour Day
addRange("2026-06-19", "2026-06-21"); // Dragon Boat
addRange("2026-09-25", "2026-09-27"); // Mid-Autumn
addRange("2026-10-01", "2026-10-07"); // National Day

function pad2(value) {
    return (value < 10 ? "0" : "") + value;
}

// The calendar date in China for an instant, as "YYYY-MM-DD".
function chinaDate(ms) {
    var shifted = new Date(ms + CHINA_UTC_OFFSET_MS);
    return shifted.getUTCFullYear() + "-" + pad2(shifted.getUTCMonth() + 1) + "-" + pad2(shifted.getUTCDate());
}

function table(holidays) {
    return holidays === undefined ? CHINESE_HOLIDAYS : holidays;
}

function isHoliday(ms, holidays) {
    return Object.prototype.hasOwnProperty.call(table(holidays), chinaDate(ms));
}

// True when the holiday table knows about the China-time year of `ms`, which is
// what makes the answer for that instant trustworthy.
function covers(ms, holidays) {
    var prefix = chinaDate(ms).substring(0, 5); // "YYYY-"
    var entries = table(holidays);
    for (var key in entries) {
        if (Object.prototype.hasOwnProperty.call(entries, key) && key.indexOf(prefix) === 0) {
            return true;
        }
    }
    return false;
}

// PEAK, OFF_PEAK, or UNKNOWN when the holiday table does not cover that year.
function state(ms, holidays) {
    if (!covers(ms, holidays)) {
        return UNKNOWN;
    }

    var date = new Date(ms);

    // Weekends are always off-peak.
    var weekday = date.getUTCDay();
    if (weekday === 0 || weekday === 6) {
        return OFF_PEAK;
    }
    if (isHoliday(ms, holidays)) {
        return OFF_PEAK;
    }

    var hour = date.getUTCHours();
    for (var i = 0; i < PEAK_WINDOWS_UTC.length; i++) {
        if (hour >= PEAK_WINDOWS_UTC[i][0] && hour < PEAK_WINDOWS_UTC[i][1]) {
            return PEAK;
        }
    }
    return OFF_PEAK;
}

function isPeak(ms, holidays) {
    return state(ms, holidays) === PEAK;
}

// The next instant at which the state flips, or null when that cannot be
// established: either nothing flips within `maxDays`, or the holiday table does
// not cover the whole window that has to be searched. Minutes are the resolution
// the schedule is defined at.
function nextChange(ms, holidays, maxDays) {
    var limit = maxDays === undefined ? SCAN_HORIZON_DAYS : maxDays;
    var current = state(ms, holidays);
    if (current === UNKNOWN) {
        return null;
    }

    var end = ms + limit * DAY_MS;
    if (!covers(end, holidays)) {
        return null;
    }

    // Start at the next whole minute so the answer reads as a clock time.
    var step = 60000;
    var cursor = Math.floor(ms / step) * step + step;
    while (cursor < end) {
        var here = state(cursor, holidays);
        // Running into an uncovered instant mid-scan means the table has a gap
        // (or the horizon reaches past the announced years). The distance to a
        // real change cannot be established, so say so rather than reporting the
        // first uncovered instant as if it were the change.
        if (here === UNKNOWN) {
            return null;
        }
        if (here !== current) {
            return cursor;
        }
        cursor += step;
    }
    return null;
}

// Milliseconds until the state changes; null when it cannot be established.
function msUntilChange(ms, holidays, maxDays) {
    var next = nextChange(ms, holidays, maxDays);
    return next === null ? null : next - ms;
}
