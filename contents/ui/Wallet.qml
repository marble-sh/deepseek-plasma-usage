/*
    SPDX-FileCopyrightText: 2026 cassidy
    SPDX-License-Identifier: GPL-2.0-or-later

    Thin KWallet bridge. Runs `kwallet-query` through the plasma5support
    "executable" data engine; all parsing lives in js/wallet.js so it can be
    unit-tested without a Plasma session.
*/
import QtQuick
import org.kde.plasma.plasma5support as P5Support
import "js/wallet.js" as WalletJs

QtObject {
    id: wallet

    property string walletName: WalletJs.DEFAULT_WALLET
    property string folder: WalletJs.DEFAULT_FOLDER

    property int _sequence: 0
    property var _queue: []
    property bool _running: false

    // secret is "" when the entry does not exist or the call failed
    signal readFinished(string entry, string secret)
    signal writeFinished(string entry, bool ok)

    readonly property P5Support.DataSource source: P5Support.DataSource {
        engine: "executable"
        connectedSources: []
        onNewData: (sourceName, data) => wallet._handleNewData(sourceName, data)
    }

    function read(entry) {
        _enqueue({ entry: entry, kind: "read" })
    }

    function write(entry, secret) {
        _enqueue({ entry: entry, kind: "write", secret: secret })
    }

    function remove(entry) {
        // Overwriting with an empty value is the least surprising "clear".
        write(entry, "")
    }

    // Commands run strictly one at a time: the data engine reports results out
    // of band, so overlapping runs could not be matched back to their request.
    function _enqueue(job) {
        _queue.push(job)
        _pump()
    }

    function _pump() {
        if (_running || _queue.length === 0) {
            return
        }
        _running = true
        var job = _queue[0]
        _sequence += 1
        var command = job.kind === "read"
            ? WalletJs.readCommand(job.entry, walletName, folder)
            : WalletJs.writeCommand(job.entry, job.secret, walletName, folder)
        // A unique trailing shell comment makes repeated identical commands
        // count as a fresh source for the data engine.
        source.connectedSources = [command + " # " + _sequence]
    }

    function _handleNewData(sourceName, data) {
        var stdout = data["stdout"] !== undefined ? data["stdout"] : ""
        var stderr = data["stderr"] !== undefined ? data["stderr"] : ""
        var code = data["exit code"] !== undefined ? data["exit code"] : data["exitCode"]

        source.disconnectSource(sourceName)

        var job = _queue.shift()
        _running = false
        if (!job) {
            return
        }
        if (job.kind === "read") {
            readFinished(job.entry, WalletJs.parseReadOutput(stdout, code))
        } else {
            writeFinished(job.entry, WalletJs.parseWriteOk(stdout, stderr, code))
        }
        // A handler may already have enqueued the next command; _pump() is a
        // no-op then.
        _pump()
    }
}
