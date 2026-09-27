/*
    SPDX-FileCopyrightText: 2026 cassidy
    SPDX-License-Identifier: GPL-2.0-or-later

    Fetches DeepSeek balance/usage. Two data sources (see
    docs/state/api-contract.md):

      * official  — https://api.deepseek.com/user/balance (API key); balance only
      * platform  — platform.deepseek.com/api/v0/... (browser session token);
                    balance, lifetime cost and per-key/per-day token + cost usage

    The platform API answers HTTP 200 even for auth failures, so results are
    classified from the JSON body, never the HTTP status.
*/
import QtQuick
import "js/api.js" as Api
import "js/format.js" as Fmt

QtObject {
    id: client

    // ------------------------------------------------------------ inputs
    property string apiKey: ""
    property string sessionToken: ""
    property int periodDays: 30
    // Set by main.qml (Qt.locale().name); formats the "days left" estimate.
    property string numberLocale: "en_US"

    // ------------------------------------------------------------- state
    property bool loading: false
    property string errorText: ""
    property bool platformOk: false
    property bool officialOk: false
    property date lastUpdated: new Date(0)
    property bool hasData: false

    // platform data
    property string currency: ""
    property real balance: 0
    property real bonus: 0
    property real totalCost: 0
    property var perKey: []
    property var perDay: []
    property var totals: ({ cost: 0, response: 0, cacheHit: 0, cacheMiss: 0, requests: 0 })
    // The window actually requested (Api.usageWindow). The sparkline needs it to
    // place each day in its real slot instead of spacing buckets evenly.
    property int windowStart: 0
    property int windowEnd: 0

    // official data
    property string officialCurrency: ""
    property real officialTotal: 0
    property real officialGranted: 0
    property real officialToppedUp: 0

    readonly property bool hasSession: sessionToken.length > 0
    readonly property bool hasApiKey: apiKey.length > 0
    readonly property string mode: hasSession ? "full" : (hasApiKey ? "balance" : "unconfigured")
    readonly property bool configured: mode !== "unconfigured"

    // ------------------------------------------------- combined views
    readonly property string displayCurrency: platformOk ? currency : officialCurrency
    readonly property real displayBalance: platformOk ? balance : officialTotal

    readonly property var todayTotals: Api.sumSince(perDay, Api.startOfToday(new Date()))
    readonly property var monthTotals: Api.sumSince(perDay, Api.startOfMonth(new Date()))
    readonly property real todayTokens: Api.totalTokens(todayTotals)
    readonly property real periodTokens: Api.totalTokens(totals)
    readonly property bool hasUsage: perDay.length > 0 || perKey.length > 0
    readonly property real averageDaily: Api.averageDailyCost(perDay, Math.max(1, periodDays))
    readonly property real estimatedDaysLeft: Fmt.daysLeft(displayBalance, averageDaily)
    readonly property string estimatedDaysLeftLabel: Fmt.daysLeftText(displayBalance, averageDaily, numberLocale)

    // ----------------------------------------------------------- fetching
    // The platform answers a refusal with a terse English code. Say what a user can
    // do about it instead, and keep the platform's own words for anything we do not
    // recognise, so a bug report still carries them.
    function platformFailure(result) {
        var kind = Api.failureKind(result)
        if (kind === "token-missing") {
            return i18n("No session token is stored. Add one in the widget settings.")
        }
        if (kind === "token-rejected") {
            return i18n("The session token was rejected. Open platform.deepseek.com, log in and paste a fresh token in the widget settings.")
        }
        if (kind === "invalid-request") {
            return i18n("The platform rejected the request. Try a shorter cost period in the widget settings.")
        }
        return result.msg
    }

    function refresh() {
        if (loading) {
            return
        }
        errorText = ""
        if (!configured) {
            errorText = i18n("Add a DeepSeek API key or session token in the widget settings.")
            return
        }
        loading = true
        if (mode === "full") {
            _refreshPlatform()
        } else {
            _refreshOfficial()
        }
    }

    function _refreshOfficial() {
        _get(Api.OFFICIAL_BALANCE_URL, { "Authorization": "Bearer " + apiKey }, function (err, text) {
            loading = false
            if (err) {
                officialOk = false
                errorText = err
                return
            }
            var parsed = Api.parseOfficialBalance(text)
            if (!parsed) {
                officialOk = false
                errorText = i18n("Could not read the balance — check the API key.")
                return
            }
            officialOk = true
            officialCurrency = parsed.currency
            officialTotal = parsed.total
            officialGranted = parsed.granted
            officialToppedUp = parsed.toppedUp
            platformOk = false
            hasData = true
            lastUpdated = new Date()
        })
    }

    function _refreshPlatform() {
        var now = new Date()
        var tz = Api.tzOffsetSeconds(now)
        // One place for the window, so it is unit-tested (Api.usageWindow).
        var span = Api.usageWindow(now, periodDays)
        windowStart = span.start
        windowEnd = span.end
        var headers = Api.authHeaders(sessionToken)
        var acc = { summary: null, cost: null, amount: null }
        var failure = ""
        var pending = 3

        function step() {
            pending -= 1
            if (pending > 0) {
                return
            }
            loading = false
            if (acc.summary) {
                var summary = Api.parseSummary(acc.summary)
                currency = summary.currency
                balance = summary.balance
                bonus = summary.bonus
                totalCost = summary.totalCost
                platformOk = true
            }
            var haveUsage = !!(acc.cost || acc.amount)
            if (platformOk && haveUsage) {
                var agg = Api.aggregateUsage(acc.cost, acc.amount)
                perKey = agg.perKey
                perDay = agg.perDay
                totals = agg.totals
                if (!currency && agg.currency) {
                    currency = agg.currency
                }
            }
            if (platformOk) {
                hasData = true
                lastUpdated = new Date()
                errorText = failure
            } else if (hasApiKey) {
                // Session token rejected but an API key is available: fall back to
                // the official endpoint, keeping the reason visible.
                errorText = failure || i18n("The session token was rejected.")
                _refreshOfficial()
            } else {
                errorText = failure || i18n("The session token was rejected.")
            }
        }

        _get(Api.summaryUrl(), headers, function (err, text) {
            if (err) {
                failure = failure || err
            } else {
                var r = Api.parseEnvelope(text)
                if (r.ok) {
                    acc.summary = r.biz
                } else {
                    failure = failure || platformFailure(r)
                }
            }
            step()
        })

        _get(Api.usageUrl("cost", span.start, span.end, tz), headers, function (err, text) {
            if (err) {
                failure = failure || err
            } else {
                var r = Api.parseEnvelope(text)
                if (r.ok) {
                    acc.cost = r.biz
                } else {
                    failure = failure || platformFailure(r)
                }
            }
            step()
        })

        _get(Api.usageUrl("amount", span.start, span.end, tz), headers, function (err, text) {
            if (err) {
                failure = failure || err
            } else {
                var r = Api.parseEnvelope(text)
                if (r.ok) {
                    acc.amount = r.biz
                } else {
                    failure = failure || platformFailure(r)
                }
            }
            step()
        })
    }

    function _get(url, headers, callback) {
        var xhr = new XMLHttpRequest()
        var settled = false
        function finish(err, text) {
            if (settled) {
                return
            }
            settled = true
            callback(err, text)
        }
        xhr.open("GET", url, true)
        xhr.timeout = 20000
        for (var name in headers) {
            if (Object.prototype.hasOwnProperty.call(headers, name)) {
                xhr.setRequestHeader(name, headers[name])
            }
        }
        xhr.onreadystatechange = function () {
            if (xhr.readyState !== 4) {
                return
            }
            if (xhr.status >= 200 && xhr.status < 300) {
                finish("", xhr.responseText)
            } else {
                finish(i18n("HTTP error %1", String(xhr.status)), xhr.responseText || "")
            }
        }
        xhr.ontimeout = function () {
            finish(i18n("Request timed out"), "")
        }
        xhr.onerror = function () {
            finish(i18n("Network error"), "")
        }
        xhr.send()
    }

    // --------------------------------------------------------- presentation
    function updatedLabel() {
        if (!hasData) {
            return i18n("never")
        }
        var seconds = Math.max(0, (new Date().getTime() - lastUpdated.getTime()) / 1000)
        if (seconds < 60) {
            return i18n("just now")
        }
        if (seconds < 3600) {
            return i18ncp("minutes ago", "%1 minute ago", "%1 minutes ago", Math.floor(seconds / 60))
        }
        return i18ncp("hours ago", "%1 hour ago", "%1 hours ago", Math.floor(seconds / 3600))
    }
}
