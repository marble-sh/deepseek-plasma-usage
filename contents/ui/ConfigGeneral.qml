/*
    SPDX-FileCopyrightText: 2026 cassidy
    SPDX-License-Identifier: GPL-2.0-or-later

    Settings page. The credentials are written to KWallet, never to the applet
    config; the rest is staged in `cfg_*` properties and applied in saveConfig()
    by the Plasma configuration framework.
*/
import QtQuick
import QtQuick.Controls as QQC2
import QtQuick.Layouts
import org.kde.kcmutils as KCM
import org.kde.kirigami as Kirigami
import org.kde.plasma.plasmoid
import "js/wallet.js" as WalletJs
import "js/format.js" as Fmt

KCM.SimpleKCM {
    id: page

    title: i18n("General")

    signal configurationChanged

    // Staged configuration; the framework fills these in from the applet config
    // and reads them back when the user applies the dialog.
    property int cfg_refreshInterval: 300
    property int cfg_panelMetric: 0
    property int cfg_costPeriodDays: 30
    property bool cfg_hideAmounts: false
    property int cfg_secretsRevision: 0

    property bool apiKeySet: false
    property bool sessionTokenSet: false
    property string statusText: ""

    Wallet {
        id: wallet
    }

    Timer {
        id: statusTimer

        interval: 5000
        onTriggered: page.statusText = ""
    }

    function saveConfig() {
        Plasmoid.configuration.refreshInterval = cfg_refreshInterval
        Plasmoid.configuration.panelMetric = cfg_panelMetric
        Plasmoid.configuration.costPeriodDays = cfg_costPeriodDays
        Plasmoid.configuration.hideAmounts = cfg_hideAmounts
    }

    // Bumping the revision makes the running applet re-read the wallet. The
    // staged value is bumped too so the configuration framework cannot echo a
    // stale revision back over it.
    function bumpSecretsRevision() {
        const next = cfg_secretsRevision + 1
        cfg_secretsRevision = next
        Plasmoid.configuration.secretsRevision = next
    }

    function setStatus(text) {
        statusText = text
        statusTimer.restart()
    }

    function writeSecret(entry, value) {
        if (value.length === 0) {
            setStatus(i18n("Enter a value first."))
            return
        }
        wallet.write(entry, value)
    }

    function metricLabels() {
        return [
            i18n("Balance"),
            i18n("Today's spend"),
            i18n("Today's tokens"),
            i18ncp("trailing period for a cost", "Spend, last %1 day", "Spend, last %1 days", page.cfg_costPeriodDays),
            i18n("Lifetime spend")
        ]
    }

    Component.onCompleted: {
        // The bridge runs commands one at a time, so both reads can be queued.
        wallet.read(WalletJs.API_KEY_ENTRY)
        wallet.read(WalletJs.SESSION_TOKEN_ENTRY)
    }

    Connections {
        target: wallet

        function onReadFinished(entry, secret) {
            if (entry === WalletJs.API_KEY_ENTRY) {
                page.apiKeySet = secret.length > 0
            } else if (entry === WalletJs.SESSION_TOKEN_ENTRY) {
                page.sessionTokenSet = secret.length > 0
            }
        }

        function onWriteFinished(entry, ok) {
            if (!ok) {
                page.setStatus(i18n("Could not write to KWallet."))
                return
            }
            if (entry === WalletJs.API_KEY_ENTRY) {
                page.apiKeySet = true
                apiKeyField.text = ""
            } else if (entry === WalletJs.SESSION_TOKEN_ENTRY) {
                page.sessionTokenSet = true
                sessionField.text = ""
            }
            page.bumpSecretsRevision()
            page.setStatus(i18n("Saved to KWallet."))
        }
    }

    Kirigami.FormLayout {
        // ------------------------------------------------------- credentials
        QQC2.Label {
            Kirigami.FormData.isSection: true
            text: i18n("Credentials")
        }

        QQC2.Label {
            Layout.fillWidth: true
            wrapMode: Text.Wrap
            text: i18n("Both values are stored in KWallet and never in the widget's configuration file.")
        }

        RowLayout {
            Kirigami.FormData.label: i18n("API key:")
            Layout.fillWidth: true
            spacing: Kirigami.Units.smallSpacing

            QQC2.TextField {
                id: apiKeyField

                Layout.fillWidth: true
                echoMode: TextInput.Password
                placeholderText: page.apiKeySet
                    ? i18n("Stored in KWallet — enter a new key to replace it")
                    : i18n("sk-…")
            }

            QQC2.Button {
                text: i18nc("store the entered credential in KWallet", "Save")
                icon.name: "document-save"
                enabled: apiKeyField.text.length > 0
                onClicked: page.writeSecret(WalletJs.API_KEY_ENTRY, apiKeyField.text)
            }

            QQC2.Button {
                text: i18nc("discard the stored credential", "Clear")
                icon.name: "edit-clear"
                enabled: page.apiKeySet
                onClicked: {
                    apiKeyField.text = ""
                    wallet.write(WalletJs.API_KEY_ENTRY, "")
                }
            }
        }

        QQC2.Label {
            Kirigami.FormData.label: i18n("API key status:")
            text: page.apiKeySet ? i18n("Stored in KWallet") : i18n("Not set")
            opacity: 0.7
        }

        QQC2.Label {
            Kirigami.FormData.isSection: true
            text: i18n("Session token (optional)")
        }

        QQC2.Label {
            Layout.fillWidth: true
            wrapMode: Text.Wrap
            text: i18n("The session token is the value the DeepSeek platform site keeps after you log in. It grants full access to your account — including creating and deleting API keys — so treat it like a password. Only token usage, cost history and the per-key breakdown need it; the API key alone is enough for the balance.")
        }

        RowLayout {
            Kirigami.FormData.label: i18n("Session token:")
            Layout.fillWidth: true
            spacing: Kirigami.Units.smallSpacing

            QQC2.TextField {
                id: sessionField

                Layout.fillWidth: true
                echoMode: TextInput.Password
                placeholderText: page.sessionTokenSet
                    ? i18n("Stored in KWallet — enter a new token to replace it")
                    : i18n("Paste the token from platform.deepseek.com")
            }

            QQC2.Button {
                text: i18nc("store the entered credential in KWallet", "Save")
                icon.name: "document-save"
                enabled: sessionField.text.length > 0
                onClicked: page.writeSecret(WalletJs.SESSION_TOKEN_ENTRY, sessionField.text)
            }

            QQC2.Button {
                text: i18nc("discard the stored credential", "Clear")
                icon.name: "edit-clear"
                enabled: page.sessionTokenSet
                onClicked: {
                    sessionField.text = ""
                    wallet.write(WalletJs.SESSION_TOKEN_ENTRY, "")
                }
            }
        }

        QQC2.Label {
            Kirigami.FormData.label: i18n("Session status:")
            text: page.sessionTokenSet ? i18n("Stored in KWallet") : i18n("Not set")
            opacity: 0.7
        }

        QQC2.Label {
            Layout.fillWidth: true
            visible: page.statusText.length > 0
            wrapMode: Text.Wrap
            color: Kirigami.Theme.positiveTextColor
            text: page.statusText
        }

        // ------------------------------------------------------ presentation
        QQC2.Label {
            Kirigami.FormData.isSection: true
            text: i18n("Presentation")
        }

        QQC2.ComboBox {
            Kirigami.FormData.label: i18n("Panel shows:")
            model: page.metricLabels()
            currentIndex: page.cfg_panelMetric
            onActivated: page.cfg_panelMetric = currentIndex
        }

        QQC2.SpinBox {
            Kirigami.FormData.label: i18n("Refresh interval (seconds):")
            from: 30
            to: 86400
            stepSize: 30
            value: page.cfg_refreshInterval
            onValueModified: page.cfg_refreshInterval = value
        }

        QQC2.SpinBox {
            Kirigami.FormData.label: i18n("Cost period (days):")
            from: 1
            to: 90
            value: page.cfg_costPeriodDays
            onValueModified: page.cfg_costPeriodDays = value
        }

        QQC2.CheckBox {
            Kirigami.FormData.label: i18n("Privacy:")
            text: i18n("Hide all amounts")
            checked: page.cfg_hideAmounts
            onToggled: page.cfg_hideAmounts = checked
        }
    }
}
