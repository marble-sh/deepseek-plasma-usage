/*
    SPDX-FileCopyrightText: 2026 cassidy
    SPDX-License-Identifier: GPL-2.0-or-later

    Settings page. The credentials are written to KWallet, never to the applet
    config; the rest is staged in `cfg_*` properties, which the Plasma
    configuration framework copies back when the dialog is applied.
*/
import QtQuick
import QtQuick.Controls as QQC2
import QtQuick.Layouts
import org.kde.kcmutils as KCM
import org.kde.kirigami as Kirigami
import org.kde.plasma.plasmoid
import "js/wallet.js" as WalletJs
import "js/format.js" as Fmt
import "js/api.js" as Api

KCM.SimpleKCM {
    id: page

    title: i18n("General")

    // Staged configuration; the framework fills these in from the applet config and
    // reads them back when the user applies the dialog. There is deliberately no
    // saveConfig(): the dialog copies every cfg_* property itself, and writing to
    // Plasmoid.configuration from here applies out of band.
    property int cfg_refreshInterval: 300
    property int cfg_panelMetric: 0
    property int cfg_costPeriodDays: 30
    property bool cfg_hideAmounts: false
    property int cfg_secretsRevision: 0

    property bool apiKeySet: false
    property bool sessionTokenSet: false
    property string statusText: ""
    property bool statusIsError: false

    Wallet {
        id: wallet
    }

    Timer {
        id: statusTimer

        interval: 5000
        onTriggered: page.statusText = ""
    }

    // Bumping the staged revision is what makes the running applet re-read the
    // wallet once the dialog is applied. It is *staged*, not written straight to
    // Plasmoid.configuration: an out-of-band write while the dialog is open makes it
    // recreate the current page, which drops whatever else was being edited.
    function bumpSecretsRevision() {
        cfg_secretsRevision += 1
    }

    function setStatus(text, isError) {
        statusText = text
        statusIsError = isError === true
        statusTimer.restart()
    }

    function writeSecret(entry, value) {
        if (value.length === 0) {
            setStatus(i18n("Enter a value first."), true)
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

        function onReadFinished(entry, secret, error) {
            var present = secret.length > 0
            if (entry === WalletJs.API_KEY_ENTRY) {
                page.apiKeySet = present
            } else if (entry === WalletJs.SESSION_TOKEN_ENTRY) {
                page.sessionTokenSet = present
            }
            // A missing entry is normal; silence, not failure, is what the widget
            // would otherwise report when the wallet daemon is wedged.
            if (error === "timeout") {
                page.setStatus(i18n("KWallet did not answer. Unlock the wallet or restart it, then try again."), true)
            }
        }

        function onWriteFinished(entry, ok, error) {
            if (!ok) {
                page.setStatus(error === "timeout"
                    ? i18n("KWallet did not answer. Unlock the wallet or restart it, then try again.")
                    : i18n("Could not write to KWallet."), true)
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
            page.setStatus(i18n("Saved to KWallet."), false)
        }
    }

    Kirigami.FormLayout {
        // Keep labels above their fields at every width. Above a threshold the form
        // switches into its two-column "wide mode", and those rows are what looked
        // misaligned once the dialog was stretched; the About and Shortcuts tabs are
        // single-column too.
        wideMode: false

        // ------------------------------------------------------- credentials
        QQC2.Label {
            Kirigami.FormData.isSection: true
            text: i18n("Credentials")
        }

        QQC2.Label {
            Layout.fillWidth: true
            Layout.maximumWidth: Kirigami.Units.gridUnit * 30
            // A wrapped label's minimum width is its unwrapped length, which would force
            // the form (and the dialog) wider than the window. Let it shrink and wrap.
            Layout.minimumWidth: 0
            wrapMode: Text.Wrap
            text: i18n("Both values are stored in KWallet and never in the widget's configuration file.")
        }

        RowLayout {
            Kirigami.FormData.label: i18n("API key:")
            Layout.fillWidth: true
            Layout.maximumWidth: Kirigami.Units.gridUnit * 30
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
            Layout.maximumWidth: Kirigami.Units.gridUnit * 30
            Layout.minimumWidth: 0
            wrapMode: Text.Wrap
            text: i18n("The session token is the value the DeepSeek platform site keeps after you log in. It grants full access to your account — including creating and deleting API keys — so treat it like a password. Only token usage, cost history and the per-key breakdown need it; the API key alone is enough for the balance.")
        }

        // The token only exists inside the browser, so the settings page can do two
        // things and no more: say where it is, and open the site that holds it. It
        // cannot read the token for the user -- that would need the browser's own
        // storage or the login endpoint, and the login endpoint is behind a bot
        // check no non-browser client can pass.
        QQC2.Label {
            Kirigami.FormData.label: i18n("How to get it:")
            Layout.fillWidth: true
            Layout.maximumWidth: Kirigami.Units.gridUnit * 30
            Layout.minimumWidth: 0
            wrapMode: Text.Wrap
            text: i18n("Log in at platform.deepseek.com, open Developer Tools (F12), then copy the value of the “userToken” entry under Application → Local Storage (in Firefox, Storage → Local Storage).")
        }

        // On its own row: side by side with the wrapping hint, this button's
        // text-derived width forced the whole form wider than the window.
        QQC2.Button {
            text: i18nc("opens the DeepSeek platform site in the browser so a token can be copied", "Open platform.deepseek.com")
            icon.name: "internet-services"
            onClicked: Qt.openUrlExternally("https://platform.deepseek.com/")
        }

        RowLayout {
            Kirigami.FormData.label: i18n("Session token:")
            Layout.fillWidth: true
            Layout.maximumWidth: Kirigami.Units.gridUnit * 30
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
                // Peeled on the way in as well as on the way out, so the wallet holds
                // the token rather than whatever wrapper it was copied inside.
                onClicked: page.writeSecret(WalletJs.SESSION_TOKEN_ENTRY, Api.normalizeSessionToken(sessionField.text))
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
            Layout.maximumWidth: Kirigami.Units.gridUnit * 30
            Layout.minimumWidth: 0
            visible: page.statusText.length > 0
            wrapMode: Text.Wrap
            color: page.statusIsError ? Kirigami.Theme.negativeTextColor : Kirigami.Theme.positiveTextColor
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
            // The platform refuses a window longer than this (Api.MAX_USAGE_DAYS),
            // so offering a bigger number would offer a broken widget.
            to: Api.MAX_USAGE_DAYS
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
