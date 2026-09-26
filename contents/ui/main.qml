/*
    SPDX-FileCopyrightText: 2026 cassidy
    SPDX-License-Identifier: GPL-2.0-or-later

    DeepSeek API balance + usage applet (D5: panel-first).

    Credentials live in KWallet only and are read through Wallet.qml. All
    request building and parsing happens in ApiClient.qml + js/, so the applet
    config never contains a secret.
*/
import QtQuick
import QtQuick.Layouts
import org.kde.plasma.plasmoid
import org.kde.plasma.core as PlasmaCore
import "js/wallet.js" as WalletJs
import "js/format.js" as Fmt

PlasmoidItem {
    id: root

    readonly property int refreshInterval: Plasmoid.configuration.refreshInterval
    readonly property int metric: Plasmoid.configuration.panelMetric
    readonly property int periodDays: Plasmoid.configuration.costPeriodDays
    readonly property bool hideAmounts: Plasmoid.configuration.hideAmounts
    readonly property int secretsRevision: Plasmoid.configuration.secretsRevision

    readonly property string periodLabel: i18ncp("trailing period for a cost", "Last %1 day", "Last %1 days", root.periodDays)

    // Set once the KWallet round-trip has finished, so the "needs configuring"
    // overlay does not flash on every startup.
    property bool secretsLoaded: false
    property bool secretsInFlight: false
    property int loadedRevision: -1

    Wallet {
        id: wallet
    }

    ApiClient {
        id: apiClient

        periodDays: root.periodDays
    }

    preferredRepresentation: Plasmoid.formFactor === PlasmaCore.Types.Planar ? fullRepresentation : compactRepresentation

    compactRepresentation: CompactRepresentation {
        api: apiClient
        metric: root.metric
        hideAmounts: root.hideAmounts

        onToggleRequested: root.expanded = !root.expanded
    }

    fullRepresentation: FullRepresentation {
        api: apiClient
        hideAmounts: root.hideAmounts
        hasSession: apiClient.hasSession
        periodLabel: root.periodLabel

        onRefreshRequested: apiClient.refresh()
    }

    Plasmoid.title: i18n("DeepSeek Usage")
    Plasmoid.backgroundHints: PlasmaCore.Types.DefaultBackground | PlasmaCore.Types.ConfigurableBackground
    Plasmoid.busy: apiClient.loading && !apiClient.hasData
    Plasmoid.status: apiClient.loading ? PlasmaCore.Types.ActiveStatus : PlasmaCore.Types.PassiveStatus
    Plasmoid.configurationRequired: root.secretsLoaded && !apiClient.configured

    toolTipMainText: i18n("DeepSeek Usage")
    toolTipSubText: root.toolTipText

    readonly property string toolTipText: {
        if (!apiClient.configured) {
            return i18n("Add a DeepSeek API key in the widget settings.");
        }
        if (!apiClient.hasData) {
            return apiClient.errorText.length > 0 ? apiClient.errorText : i18n("Loading…");
        }
        var lines = [i18n("Balance: %1", root.shownMoney(apiClient.displayBalance))];
        if (apiClient.hasUsage) {
            lines.push(i18n("Today: %1", root.shownMoney(apiClient.todayTotals.cost)));
            lines.push(i18n("%1: %2", root.periodLabel, root.shownMoney(apiClient.totals.cost)));
        } else if (apiClient.platformOk) {
            lines.push(i18n("Lifetime spend: %1", root.shownMoney(apiClient.totalCost)));
        }
        lines.push(i18n("Updated %1", apiClient.updatedLabel()));
        return lines.join("\n");
    }

    Plasmoid.contextualActions: [
        PlasmaCore.Action {
            text: i18n("Refresh")
            icon.name: "view-refresh"
            enabled: apiClient.configured && !apiClient.loading
            onTriggered: apiClient.refresh()
        }
    ]

    Timer {
        interval: Math.max(30, root.refreshInterval) * 1000
        repeat: true
        running: apiClient.configured
        onTriggered: apiClient.refresh()
    }

    Connections {
        target: wallet

        function onReadFinished(entry, secret) {
            root.handleSecret(entry, secret);
        }
    }

    onSecretsRevisionChanged: root.reloadSecrets()
    onPeriodDaysChanged: if (apiClient.configured) { apiClient.refresh() }

    Component.onCompleted: root.reloadSecrets()

    function shownMoney(value) {
        return Fmt.hideable(Fmt.money(value, apiClient.displayCurrency), root.hideAmounts);
    }

    // Reads the API key and the session token, one after the other: the wallet
    // bridge queues commands, but a single read round-trip keeps the mapping
    // between request and reply obvious.
    function reloadSecrets() {
        if (secretsInFlight) {
            return;
        }
        if (secretsLoaded && root.loadedRevision === root.secretsRevision) {
            return;
        }
        secretsInFlight = true;
        root.loadedRevision = root.secretsRevision;
        apiClient.apiKey = "";
        apiClient.sessionToken = "";
        wallet.read(WalletJs.API_KEY_ENTRY);
    }

    function handleSecret(entry, secret) {
        if (entry === WalletJs.API_KEY_ENTRY) {
            apiClient.apiKey = secret;
            wallet.read(WalletJs.SESSION_TOKEN_ENTRY);
            return;
        }
        if (entry === WalletJs.SESSION_TOKEN_ENTRY) {
            apiClient.sessionToken = secret;
            secretsInFlight = false;
            secretsLoaded = true;
            apiClient.refresh();
        }
    }
}
