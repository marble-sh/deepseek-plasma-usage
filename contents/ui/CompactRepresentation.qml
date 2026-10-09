/*
    SPDX-FileCopyrightText: 2026 cassidy
    SPDX-License-Identifier: GPL-2.0-or-later

    Panel representation (D5): an icon plus one number, chosen in the settings
    (see `panelMetric`). The full detail lives in the popup
    (FullRepresentation.qml).
*/
import QtQuick
import QtQuick.Layouts
import org.kde.plasma.plasmoid
import org.kde.plasma.core as PlasmaCore
import org.kde.plasma.components as PlasmaComponents
import org.kde.kirigami as Kirigami
import "js/format.js" as Fmt

Item {
    id: root

    property QtObject api
    property int metric: Fmt.METRIC_BALANCE
    property bool hideAmounts: false
    property bool peakRates: false
    property bool peakKnown: true
    // Set by main.qml (Qt.locale().name).
    property string numberLocale: "en_US"
    // Set by main.qml: false while the KWallet read is still in flight, and true
    // when KWallet could not be read at all (locked or not answering).
    property bool secretsLoaded: false
    property bool walletUnavailable: false

    signal toggleRequested()

    readonly property bool vertical: Plasmoid.formFactor === PlasmaCore.Types.Vertical
    readonly property bool failed: api ? (api.errorText.length > 0 && !api.hasData) : false
    readonly property string iconSource: failed
        ? "dialog-warning"
        : root.walletUnavailable ? "object-locked" : "office-chart-bar"

    readonly property string valueText: {
        if (!api || !api.configured) {
            if (root.walletUnavailable) {
                return i18nc("KWallet is locked, so the credential cannot be read", "Locked");
            }
            // An empty wallet is only "Set up" once we know it was read; until
            // then the chip is still checking (better than a premature claim).
            return root.secretsLoaded ? i18n("Set up") : "\u2026";
        }
        if (!api.hasData) {
            return failed ? i18n("Error") : "\u2026";
        }
        return Fmt.metricText(root.metric, {
            currency: api.displayCurrency,
            locale: root.numberLocale,
            balance: api.displayBalance,
            todayCost: api.todayTotals.cost,
            todayTokens: api.todayTokens,
            periodCost: api.totals.cost,
            lifetimeCost: api.totalCost,
            hasLifetime: api.platformOk,
            hidden: root.hideAmounts
        });
    }

    Layout.minimumWidth: content.implicitWidth + Kirigami.Units.smallSpacing * 2
    Layout.minimumHeight: content.implicitHeight + Kirigami.Units.smallSpacing

    MouseArea {
        anchors.fill: parent
        acceptedButtons: Qt.LeftButton
        hoverEnabled: true
        onClicked: root.toggleRequested()
    }

    GridLayout {
        id: content

        anchors.centerIn: parent
        flow: root.vertical ? GridLayout.TopToBottom : GridLayout.LeftToRight
        rows: root.vertical ? -1 : 1
        columns: root.vertical ? 1 : -1
        rowSpacing: 0
        columnSpacing: Kirigami.Units.smallSpacing

        Kirigami.Icon {
            source: root.iconSource
            Layout.alignment: Qt.AlignCenter
            Layout.preferredWidth: Kirigami.Units.iconSizes.small
            Layout.preferredHeight: Kirigami.Units.iconSizes.small
        }

        PlasmaComponents.Label {
            text: root.valueText
            font.bold: true
            color: root.failed ? Kirigami.Theme.negativeTextColor : Kirigami.Theme.textColor
        }

        // Peak-rate state at a glance: green means the discounted off-peak rate
        // is in effect, red means full-price peak hours, and a muted dot means
        // the year's holiday list is not known so no claim is made either way.
        // The tooltip spells out the state and how long it lasts.
        Rectangle {
            Layout.alignment: Qt.AlignCenter
            Layout.preferredWidth: Math.max(6, Math.round(Kirigami.Units.gridUnit * 0.4))
            Layout.preferredHeight: Layout.preferredWidth
            radius: width / 2
            color: !root.peakKnown
                ? Kirigami.Theme.neutralTextColor
                : root.peakRates ? Kirigami.Theme.negativeTextColor : Kirigami.Theme.positiveTextColor
        }
    }
}
