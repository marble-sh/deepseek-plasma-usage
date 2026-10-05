/*
    SPDX-License-Identifier: GPL-2.0-or-later
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { load } from "./load.mjs";

const w = load("contents/ui/js/wallet.js");

test("shellQuote wraps and escapes single quotes", () => {
    assert.equal(w.shellQuote("abc"), "'abc'");
    assert.equal(w.shellQuote("a'b"), "'a'\\''b'");
});

test("base64Encode matches Buffer", () => {
    // "sk-test…" is a made-up key: never put real credentials in test data.
    for (const s of ["", "sk-test-0123456789abcdef", "a/b+c=", "hello world"]) {
        assert.equal(w.base64Encode(s), Buffer.from(s, "latin1").toString("base64"));
    }
});

test("readCommand targets the right wallet entry", () => {
    const cmd = w.readCommand(w.API_KEY_ENTRY);
    assert.match(cmd, /^kwallet-query -r 'deepseek-api-key' -f 'Plasma' 'kdewallet'$/);
});

test("writeCommand never embeds the raw secret", () => {
    const secret = "sk-TOPSECRET";
    const cmd = w.writeCommand(w.SESSION_TOKEN_ENTRY, secret);
    assert.ok(!cmd.includes(secret), "raw secret must not appear in the command");
    assert.ok(cmd.includes(Buffer.from(secret, "latin1").toString("base64")));
    assert.match(cmd, /kwallet-query -w 'deepseek-session-token'/);
});

test("parseReadOutput trims the trailing newline and handles failure codes", () => {
    assert.equal(w.parseReadOutput("hunter2\n", "0"), "hunter2");
    assert.equal(w.parseReadOutput("hunter2", 0), "hunter2");
    assert.equal(w.parseReadOutput("", "1"), "");
    assert.equal(w.parseReadOutput("noise", "3"), "");
});

test("parseWriteOk only accepts exit code 0", () => {
    assert.equal(w.parseWriteOk("", "", "0"), true);
    assert.equal(w.parseWriteOk("", "", "1"), false);
    assert.equal(w.parseWriteOk("", "", undefined), false);
});

test("the wallet timeout is bounded so a wedged daemon cannot hold the queue", () => {
    assert.ok(Number.isInteger(w.TIMEOUT_MS), "TIMEOUT_MS must be an integer");
    // Long enough to leave room for an unlock prompt, short enough that one stuck
    // `kwallet-query` cannot silence the settings page for a whole session.
    assert.ok(w.TIMEOUT_MS >= 5000 && w.TIMEOUT_MS <= 60000, String(w.TIMEOUT_MS));
});
