/*
    SPDX-FileCopyrightText: 2026 cassidy
    SPDX-License-Identifier: GPL-2.0-or-later

    Pure helpers for talking to KWallet through the `kwallet-query` CLI.
    The QML side (Wallet.qml) only runs the produced commands through the
    plasma5support "executable" data engine and feeds the results back here.
    Kept free of Qt APIs so it can be unit-tested with node:test.
*/

var DEFAULT_WALLET = "kdewallet";
var DEFAULT_FOLDER = "Plasma";
var API_KEY_ENTRY = "deepseek-api-key";
var SESSION_TOKEN_ENTRY = "deepseek-session-token";

// POSIX single-quote a value for safe use inside `sh -c`.
function shellQuote(value) {
    return "'" + String(value === undefined || value === null ? "" : value).replace(/'/g, "'\\''") + "'";
}

function base64Encode(str) {
    var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    var bytes = [];
    for (var i = 0; i < str.length; i++) {
        var c = str.charCodeAt(i);
        if (c > 0xff) {
            c = 0x3f; // non-latin1 secrets are not expected; keep output valid
        }
        bytes.push(c);
    }
    var out = "";
    for (var b = 0; b < bytes.length; b += 3) {
        var b0 = bytes[b];
        var b1 = b + 1 < bytes.length ? bytes[b + 1] : NaN;
        var b2 = b + 2 < bytes.length ? bytes[b + 2] : NaN;
        out += chars.charAt(b0 >> 2);
        out += chars.charAt(((b0 & 3) << 4) | (isNaN(b1) ? 0 : b1 >> 4));
        out += isNaN(b1) ? "=" : chars.charAt(((b1 & 15) << 2) | (isNaN(b2) ? 0 : b2 >> 6));
        out += isNaN(b2) ? "=" : chars.charAt(b2 & 63);
    }
    return out;
}

function readCommand(entry, wallet, folder) {
    return "kwallet-query -r " + shellQuote(entry)
        + " -f " + shellQuote(folder || DEFAULT_FOLDER)
        + " " + shellQuote(wallet || DEFAULT_WALLET);
}

// Secrets are piped through stdin as base64 so the raw value never appears
// literally on the command line.
function writeCommand(entry, secret, wallet, folder) {
    return "printf %s " + shellQuote(base64Encode(secret))
        + " | base64 -d | kwallet-query -w " + shellQuote(entry)
        + " -f " + shellQuote(folder || DEFAULT_FOLDER)
        + " " + shellQuote(wallet || DEFAULT_WALLET);
}

function listCommand(wallet, folder) {
    return "kwallet-query -l -f " + shellQuote(folder || DEFAULT_FOLDER)
        + " " + shellQuote(wallet || DEFAULT_WALLET);
}

// `exitCode` is data["exit code"] from the executable engine; it can arrive as
// a string. Returns "" when the entry is missing or the call failed.
function parseReadOutput(stdout, exitCode) {
    var code = parseInt(exitCode, 10);
    if (!isNaN(code) && code !== 0) {
        return "";
    }
    var text = stdout === undefined || stdout === null ? "" : String(stdout);
    // kwallet-query prints the secret followed by a newline.
    return text.replace(/\r?\n$/, "").replace(/^\r?\n/, "");
}

function parseWriteOk(stdout, stderr, exitCode) {
    var code = parseInt(exitCode, 10);
    if (isNaN(code)) {
        return false;
    }
    return code === 0;
}
