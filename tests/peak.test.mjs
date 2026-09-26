/*
    SPDX-License-Identifier: GPL-2.0-or-later

    The schedule is documented in contents/ui/js/peak.js. All the instants below
    are UTC, because that is how DeepSeek defines its peak windows.

    2026 weekdays used here: 21 Sep Mon, 24 Sep Thu, 25 Sep Fri, 28 Sep Mon,
    29 Sep Tue, 30 Sep Wed, 1 Oct Thu, 8 Oct Thu.
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { load } from "./load.mjs";

const peak = load("contents/ui/js/peak.js");

const MON = Date.UTC(2026, 8, 21);
const SAT = Date.UTC(2026, 8, 26);
const SUN = Date.UTC(2026, 8, 27);

function at(dayUtc, hour, minute = 0) {
    return dayUtc + hour * 3600000 + minute * 60000;
}

test("peak windows are 01:00-04:00 and 06:00-10:00 UTC on weekdays", () => {
    assert.equal(peak.state(at(MON, 0, 59)), peak.OFF_PEAK);
    assert.equal(peak.state(at(MON, 1, 0)), peak.PEAK); // start inclusive
    assert.equal(peak.state(at(MON, 3, 59)), peak.PEAK);
    assert.equal(peak.state(at(MON, 4, 0)), peak.OFF_PEAK); // end exclusive
    assert.equal(peak.state(at(MON, 5, 59)), peak.OFF_PEAK);
    assert.equal(peak.state(at(MON, 6, 0)), peak.PEAK);
    assert.equal(peak.state(at(MON, 9, 59)), peak.PEAK);
    assert.equal(peak.state(at(MON, 10, 0)), peak.OFF_PEAK);
    assert.equal(peak.state(at(MON, 23, 59)), peak.OFF_PEAK);
});

test("weekends are off-peak all day", () => {
    assert.equal(peak.state(at(SAT, 2)), peak.OFF_PEAK);
    assert.equal(peak.state(at(SAT, 8)), peak.OFF_PEAK);
    assert.equal(peak.state(at(SUN, 2)), peak.OFF_PEAK);
    assert.equal(peak.state(at(SUN, 8)), peak.OFF_PEAK);
});

// The whole point of carrying the holiday table: a weekday inside a published
// holiday block is off-peak in the middle of a peak window.
test("every 2026 holiday block swallows weekdays inside its peak windows", () => {
    const inBlock = [
        [Date.UTC(2026, 0, 1), "New Year"], // Thursday
        [Date.UTC(2026, 1, 18), "Spring Festival"], // Wednesday
        [Date.UTC(2026, 3, 6), "Ching Ming"], // Monday
        [Date.UTC(2026, 4, 4), "Labour Day"], // Monday
        [Date.UTC(2026, 5, 19), "Dragon Boat"], // Friday
        [Date.UTC(2026, 8, 25), "Mid-Autumn"], // Friday
        [Date.UTC(2026, 9, 1), "National Day"] // Thursday
    ];
    for (const [day, name] of inBlock) {
        assert.equal(peak.state(at(day, 2)), peak.OFF_PEAK, `${name}: 02:00 UTC`);
        assert.equal(peak.state(at(day, 8)), peak.OFF_PEAK, `${name}: 08:00 UTC`);
    }
});

test("the day after each block is peak again, so the blocks are not too long", () => {
    const afterBlock = [
        [Date.UTC(2026, 0, 5), "New Year"],
        [Date.UTC(2026, 1, 24), "Spring Festival"],
        [Date.UTC(2026, 3, 7), "Ching Ming"],
        [Date.UTC(2026, 4, 6), "Labour Day"],
        [Date.UTC(2026, 5, 22), "Dragon Boat"],
        [Date.UTC(2026, 8, 28), "Mid-Autumn"],
        [Date.UTC(2026, 9, 8), "National Day"]
    ];
    for (const [day, name] of afterBlock) {
        assert.equal(peak.state(at(day, 2)), peak.PEAK, `${name}: 02:00 UTC`);
    }
});

test("holiday dates are China dates (UTC+8) rather than UTC dates", () => {
    // 2026-09-21 23:30 UTC is 2026-09-22 07:30 in China, and the day rolls over
    // at 16:00 UTC.
    assert.equal(peak.chinaDate(Date.UTC(2026, 8, 21, 23, 30)), "2026-09-22");
    assert.equal(peak.chinaDate(Date.UTC(2026, 8, 21, 15, 59)), "2026-09-21");
    assert.equal(peak.chinaDate(Date.UTC(2026, 8, 21, 16, 0)), "2026-09-22");
});

test("a year with no holiday dates is unknown, never guessed", () => {
    // 2030 has not been published; the widget must not assume those days are
    // ordinary working days, because that would report peak while DeepSeek
    // charges the off-peak rate.
    assert.equal(peak.state(Date.UTC(2030, 0, 1, 2, 0)), peak.UNKNOWN);
    assert.equal(peak.state(Date.UTC(2030, 5, 10, 2, 0)), peak.UNKNOWN);
    // 2025 is before the table too.
    assert.equal(peak.state(Date.UTC(2025, 5, 10, 2, 0)), peak.UNKNOWN);
});

test("nextChange finds the end of the current peak window", () => {
    assert.equal(peak.nextChange(at(MON, 2, 30)), at(MON, 4, 0));
    assert.equal(peak.msUntilChange(at(MON, 2, 30)), 90 * 60000);
});

test("nextChange finds the start of the next peak window", () => {
    assert.equal(peak.nextChange(at(MON, 4, 30)), at(MON, 6, 0));
    assert.equal(peak.nextChange(at(MON, 11, 0)), at(MON + 1 * 86400000, 1, 0));
});

test("nextChange crosses a weekend to Monday's first peak window", () => {
    assert.equal(peak.nextChange(at(Date.UTC(2026, 8, 25), 11, 0)), at(Date.UTC(2026, 8, 28), 1, 0));
});

// This is why the scan horizon is 14 days and not 7: the Spring Festival block
// keeps the schedule unchanged for over ten days.
test("nextChange spans a holiday block longer than a week", () => {
    const from = at(Date.UTC(2026, 1, 13), 10, 0); // Friday, just after the peak window
    const next = peak.nextChange(from);
    assert.equal(next, at(Date.UTC(2026, 1, 24), 1, 0), "Tuesday after the block");
    assert.ok(next - from > 8 * 86400000, "the gap exceeds a week, so a 7-day horizon would be wrong");
});

test("nextChange spans the National Day block", () => {
    const from = at(Date.UTC(2026, 8, 30), 11, 0); // Wednesday, just before the block
    assert.equal(peak.nextChange(from), at(Date.UTC(2026, 9, 8), 1, 0));
});

test("nextChange refuses to answer when the window is not covered", () => {
    // Inside a covered year, but the scan reaches into an unpublished one.
    assert.equal(peak.nextChange(Date.UTC(2026, 11, 25, 12, 0)), null);
    // And an uncovered year outright.
    assert.equal(peak.nextChange(Date.UTC(2030, 5, 10, 2, 0)), null);
});

test("nextChange returns null when nothing flips inside the horizon", () => {
    assert.equal(peak.nextChange(at(MON, 2, 30), undefined, 0), null);
    assert.equal(peak.msUntilChange(at(MON, 2, 30), undefined, 0), null);
});

/* ---------------------------------------------------------- table hygiene */

// A maintenance alarm, not a bug: the State Council publishes the following
// year's dates in November/December. When this fails, add the new year with
// addRange() in contents/ui/js/peak.js instead of letting the widget guess.
test("the holiday table covers the current year", () => {
    const year = peak.chinaDate(Date.now()).substring(0, 4);
    assert.ok(
        peak.covers(Date.now()),
        `no Chinese public holiday dates for ${year} — add the published schedule to CHINESE_HOLIDAYS`
    );
});

test("every covered year looks complete rather than half-filled", () => {
    const perYear = {};
    for (const key of Object.keys(peak.CHINESE_HOLIDAYS)) {
        const year = key.substring(0, 4);
        perYear[year] = (perYear[year] || 0) + 1;
    }
    const years = Object.keys(perYear);
    assert.ok(years.length > 0, "the holiday table is empty");
    for (const year of years) {
        // China has 11-13 statutory days plus the swapped weekends that make up
        // each block, so a year is always well above 11 days and below 40.
        assert.ok(
            perYear[year] >= 11 && perYear[year] <= 40,
            `${year} has ${perYear[year]} dates, which looks partial or wrong`
        );
    }
});
