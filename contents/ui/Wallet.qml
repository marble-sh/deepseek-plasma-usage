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
    // The source string of the command currently in flight, so a result (or a
    // timeout) can be matched back to the job that produced it.
    property string _currentSource: ""

    // secret is "" when the entry does not exist or the call failed; error is
    // "" normally, and names why on failure ("timeout"). The extra argument is
    // additive, so a handler that declares only the first two still works.
    signal readFinished(string entry, string secret, string error)
    signal writeFinished(string entry, bool ok, string error)

    readonly property P5Support.DataSource source: P5Support.DataSource {
        engine: "executable"
        connectedSources: []
        onNewData: (sourceName, data) => wallet._handleNewData(sourceName, data)
    }

    // The executable engine reports nothing while a command is still running, and
    // `kwallet-query` blocks indefinitely against a wedged wallet daemon. Bound it,
    // or one stuck call holds the queue forever and every later credential read and
    // write is a silent no-op. Held as a property because QtObject has no default
    // child property (same reason `source` is one).
    property Timer timeoutTimer: Timer {
        interval: WalletJs.TIMEOUT_MS
        repeat: false
        onTriggered: wallet._handleTimeout()
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
        _currentSource = command + " # " + _sequence
        timeoutTimer.restart()
        source.connectedSources = [_currentSource]
    }

    function _handleNewData(sourceName, data) {
        // A source that was already timed out (or already answered) can still emit
        // once more; ignore it so its data cannot be attributed to the current job.
        if (sourceName !== _currentSource) {
            return
        }
        timeoutTimer.stop()
        var stdout = data["stdout"] !== undefined ? data["stdout"] : ""
        var stderr = data["stderr"] !== undefined ? data["stderr"] : ""
        var code = data["exit code"] !== undefined ? data["exit code"] : data["exitCode"]

        source.disconnectSource(sourceName)
        _currentSource = ""

        var job = _queue.shift()
        _running = false
        if (!job) {
            return
        }
        if (job.kind === "read") {
            readFinished(job.entry, WalletJs.parseReadOutput(stdout, code), "")
        } else {
            var ok = WalletJs.parseWriteOk(stdout, stderr, code)
            writeFinished(job.entry, ok, ok ? "" : "failed")
        }
        // A handler may already have enqueued the next command; _pump() is a
        // no-op then.
        _pump()
    }

    // The command outlived its deadline. Disconnecting the source destroys the
    // engine's container, which kills the stuck `kwallet-query`; dropping the job
    // lets the queue move on instead of wedging.
    function _handleTimeout() {
        if (!_running) {
            return
        }
        var stuck = _currentSource
        var job = _queue.shift()
        _running = false
        _currentSource = ""
        if (stuck !== "") {
            source.disconnectSource(stuck)
        }
        if (!job) {
            return
        }
        if (job.kind === "read") {
            readFinished(job.entry, "", "timeout")
        } else {
            writeFinished(job.entry, false, "timeout")
        }
        _pump()
    }
}
