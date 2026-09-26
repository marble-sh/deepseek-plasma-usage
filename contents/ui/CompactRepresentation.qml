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

    signal toggleRequested()

    readonly property bool vertical: Plasmoid.formFactor === PlasmaCore.Types.Vertical
    readonly property bool failed: api ? (api.errorText.length > 0 && !api.hasData) : false
    readonly property string iconSource: failed ? "dialog-warning" : "office-chart-bar"

    readonly property string valueText: {
        if (!api || !api.configured) {
            return i18n("Set up");
        }
        if (!api.hasData) {
            return failed ? i18n("Error") : "\u2026";
        }
        return Fmt.metricText(root.metric, {
            currency: api.displayCurrency,
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
        // is in effect, red means full-price peak hours. The tooltip spells it
        // out, including how long the current state lasts.
        Rectangle {
            Layout.alignment: Qt.AlignCenter
            Layout.preferredWidth: Math.max(6, Math.round(Kirigami.Units.gridUnit * 0.4))
            Layout.preferredHeight: Layout.preferredWidth
            radius: width / 2
            color: root.peakRates ? Kirigami.Theme.negativeTextColor : Kirigami.Theme.positiveTextColor
        }
    }
}
