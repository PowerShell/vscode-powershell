// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import * as vscode from "vscode";
import { getSettings } from "../settings";

interface ISetting {
    path: string;
    name: string;
    value: string | boolean;
}

/**
 * A feature to implement commands to make code like the ISE and reset the settings.
 */
export class ISECompatibilityFeature implements vscode.Disposable {
    // Marking settings as public so we can use it within the tests without needing to duplicate the list of settings.
    public static settings: ISetting[] = [
        { path: "workbench.activityBar", name: "visible", value: false },
        { path: "debug", name: "openDebug", value: "neverOpen" },
        { path: "editor", name: "tabCompletion", value: "on" },
        { path: "powershell.integratedConsole", name: "focusConsoleOnExecute", value: false },
        { path: "files", name: "defaultLanguage", value: "powershell" },
        { path: "workbench", name: "colorTheme", value: "PowerShell ISE" },
        { path: "editor", name: "wordSeparators", value: "`~!@#%^&*()-=+[{]}\\|;:'\",.<>/?" },
        { path: "powershell.buttons", name: "showPanelMovementButtons", value: true }
    ];

    private _commandRegistrations: vscode.Disposable[] = [];
    private _iseModeEnabled: boolean;
    private _originalSettings: Record<string, boolean | string | undefined> = {};

    constructor() {
        // TODO: This test isn't great.
        const testSetting = ISECompatibilityFeature.settings[ISECompatibilityFeature.settings.length - 1];
        this._iseModeEnabled = vscode.workspace.getConfiguration(testSetting.path).get(testSetting.name) === testSetting.value;
        this._commandRegistrations = [
            vscode.commands.registerCommand("PowerShell.EnableISEMode", async () => { await this.EnableISEMode(); }),
            vscode.commands.registerCommand("PowerShell.DisableISEMode", async () => { await this.DisableISEMode(); }),
            vscode.commands.registerCommand("PowerShell.ToggleISEMode", async () => { await this.ToggleISEMode(); })
        ];
    }

    public dispose() {
        for (const command of this._commandRegistrations) {
            command.dispose();
        }
    }

    private async EnableISEMode() {
        this._iseModeEnabled = true;
        for (const iseSetting of ISECompatibilityFeature.settings) {
            try {
                const config = vscode.workspace.getConfiguration(iseSetting.path);
                this._originalSettings[iseSetting.path + iseSetting.name] = config.get(iseSetting.name);
                await config.update(iseSetting.name, iseSetting.value, true);
            } catch {
                // The `update` call can fail if the setting doesn't exist. This
                // happens when the extension runs in Azure Data Studio, which
                // doesn't have a debugger, so the `debug` setting can't be
                // updated. Unless we catch this exception and allow the
                // function to continue, it throws an error to the user.
            }
        }

        // Show the PowerShell view container which has the Command Explorer view
        await vscode.commands.executeCommand("workbench.view.extension.PowerShell");

        if (!getSettings().sideBar.CommandExplorerVisibility) {
            // Hide the explorer if the setting says so.
            await vscode.commands.executeCommand("workbench.action.toggleSidebarVisibility");
        }
    }

    private async DisableISEMode() {
        this._iseModeEnabled = false;
        for (const iseSetting of ISECompatibilityFeature.settings) {
            const config = vscode.workspace.getConfiguration(iseSetting.path);
            const currently = config.get(iseSetting.name);
            if (currently === iseSetting.value) {
                await config.update(iseSetting.name, this._originalSettings[iseSetting.path + iseSetting.name], true);
            }
        }
    }

    private async ToggleISEMode() {
        if (this._iseModeEnabled) {
            await this.DisableISEMode();
        } else {
            await this.EnableISEMode();
        }
    }
}
