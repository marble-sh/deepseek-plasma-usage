/*
    SPDX-License-Identifier: GPL-2.0-or-later

    The schedule is documented in contents/ui/js/peak.js. All the instants below
    are UTC, because that is how DeepSeek defines its peak windows.
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { load } from "./load.mjs";

const peak = load("contents/ui/js/peak.js");

// 2026-09-21 is a Monday, 2026-09-26 a Saturday, 2026-09-27 a Sunday.
const MON = Date.UTC(2026, 8, 21);
const SAT = Date.UTC(2026, 8, 26);
const SUN = Date.UTC(2026, 8, 27);

function at(dayUtc, hour, minute = 0) {
    return dayUtc + hour * 3600000 + minute * 60000;
}

test("peak windows are 01:00-04:00 and 06:00-10:00 UTC on weekdays", () => {
    assert.equal(peak.isPeak(at(MON, 0, 59)), false);
    assert.equal(peak.isPeak(at(MON, 1, 0)), true); // start inclusive
    assert.equal(peak.isPeak(at(MON, 3, 59)), true);
    assert.equal(peak.isPeak(at(MON, 4, 0)), false); // end exclusive
    assert.equal(peak.isPeak(at(MON, 5, 59)), false);
    assert.equal(peak.isPeak(at(MON, 6, 0)), true);
    assert.equal(peak.isPeak(at(MON, 9, 59)), true);
    assert.equal(peak.isPeak(at(MON, 10, 0)), false);
    assert.equal(peak.isPeak(at(MON, 23, 59)), false);
});

test("weekends are off-peak all day", () => {
    assert.equal(peak.isPeak(at(SAT, 2)), false);
    assert.equal(peak.isPeak(at(SAT, 8)), false);
    assert.equal(peak.isPeak(at(SUN, 2)), false);
    assert.equal(peak.isPeak(at(SUN, 8)), false);
});

test("Chinese public holidays are off-peak all day", () => {
    const holidays = { "2026-09-22": true }; // a Tuesday
    assert.equal(peak.isPeak(at(MON, 2), holidays), true, "control: the same weekday without the holiday");
    assert.equal(peak.isPeak(at(Date.UTC(2026, 8, 22), 2), holidays), false);
    assert.equal(peak.isPeak(at(Date.UTC(2026, 8, 22), 8), holidays), false);
});

test("holiday dates are China dates (UTC+8) rather than UTC dates", () => {
    // 2026-09-21 23:30 UTC is 2026-09-22 07:30 in China, and the day rolls over
    // at 16:00 UTC.
    assert.equal(peak.chinaDate(Date.UTC(2026, 8, 21, 23, 30)), "2026-09-22");
    assert.equal(peak.chinaDate(Date.UTC(2026, 8, 21, 15, 59)), "2026-09-21");
    assert.equal(peak.chinaDate(Date.UTC(2026, 8, 21, 16, 0)), "2026-09-22");
});

// Both peak windows end before 16:00 UTC, so an instant inside a peak window
// always has the same UTC and China date and the conversion above never changes
// the answer. It is kept because it is the semantically right way to name a
// holiday, and it stays correct if the windows ever move.
test("a holiday only matters on a weekday inside a peak window", () => {
    const holidays = { "2026-09-22": true }; // a Tuesday
    assert.equal(peak.isPeak(at(Date.UTC(2026, 8, 22), 2), holidays), false);
    assert.equal(peak.isPeak(at(Date.UTC(2026, 8, 22), 8), holidays), false);
    // Same instant, no holiday: peak.
    assert.equal(peak.isPeak(at(Date.UTC(2026, 8, 22), 2)), true);
});

test("nextChange finds the end of the current peak window", () => {
    const next = peak.nextChange(at(MON, 2, 30));
    assert.equal(next, at(MON, 4, 0));
    assert.equal(peak.msUntilChange(at(MON, 2, 30)), 90 * 60000);
});

test("nextChange finds the start of the next peak window", () => {
    assert.equal(peak.nextChange(at(MON, 4, 30)), at(MON, 6, 0));
    assert.equal(peak.nextChange(at(MON, 11, 0)), at(MON + 1 * 86400000, 1, 0));
});

test("nextChange crosses a weekend to Monday's first peak window", () => {
    // Friday 2026-09-25 11:00 UTC -> Monday 2026-09-28 01:00 UTC.
    assert.equal(peak.nextChange(at(Date.UTC(2026, 8, 25), 11, 0)), at(Date.UTC(2026, 8, 28), 1, 0));
});

test("nextChange returns null when nothing flips inside the horizon", () => {
    // A zero-day horizon cannot contain a change.
    assert.equal(peak.nextChange(at(MON, 2, 30), undefined, 0), null);
    assert.equal(peak.msUntilChange(at(MON, 2, 30), undefined, 0), null);
});

test("the shipped holiday table is empty and that is load-bearing", () => {
    // If someone adds dates here, the China-date test above still covers the
    // mechanism. This assertion just stops a stale year from being added
    // silently: update the README note when it changes.
    assert.equal(Object.keys(peak.CHINESE_HOLIDAYS).length, 0);
});
