/*
    SPDX-License-Identifier: GPL-2.0-or-later

    A regression test for a bug that only a DST-observing zone can show, and which had
    therefore never been seen: `api.test.mjs` pins `Etc/GMT+3` and CI runs in UTC, so in
    every existing run a local day is exactly 86400 seconds long. On a real machine one
    is not, and the window arithmetic assumed it always was.

    `process.env.TZ` has to be set before the first Date is constructed, and
    `node --test` runs each file in its own process, so this cannot leak into another
    suite. The zone is the reporter's, and the date is the one they hit it on.
*/
process.env.TZ = "America/Santiago";

import { test } from "node:test";
import assert from "node:assert/strict";
import { load } from "./load.mjs";

const api = load("contents/ui/js/api.js");

// The recorded live probe from docs/state/api-contract.md, and the day the bug was
// reported. Chile changed to summer time in September, so a 30-day window ending here
// reaches back into August and spans a 23-hour local day.
const REPORTED_AT = new Date("2026-09-26T18:12:43-03:00");

test("a window spanning a DST transition still has day-boundary ends", () => {
    const window = api.usageWindow(REPORTED_AT, 30);
    const tz = api.tzOffsetSeconds(REPORTED_AT);

    // The request carries exactly one offset, so both ends have to be day boundaries
    // for that offset. A local midnight that fell at the *other* offset is an hour
    // away from one, and the platform refuses the whole request with
    // biz_code 1, INVALID_PARAM -- without saying which end it disliked.
    for (const [label, at] of [
        ["start", window.start],
        ["end", window.end]
    ]) {
        assert.equal((((at + tz) % 86400) + 86400) % 86400, 0, `${label} is not a day boundary for tz ${tz}`);
    }
    assert.equal(window.end - window.start, 30 * 86400, "the window is exactly 30 days");
});

test("the window the platform's own page asked for is reproduced in a DST zone too", () => {
    const window = api.usageWindow(REPORTED_AT, 30);
    assert.equal(window.end, 1790478000);
    // `end` minus exactly 30 days, which is what the platform's own page sent and
    // what it accepts. Asking for "local midnight 29 days ago" gave 1787889600 here:
    // an hour out, and rejected.
    assert.equal(window.start, 1787886000);
});
