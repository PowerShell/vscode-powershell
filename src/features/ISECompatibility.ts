// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import * as vscode from "vscode";
import * as Settings from "../settings";

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
    private iseCommandRegistration: vscode.Disposable;
    private defaultCommandRegistration: vscode.Disposable;

    constructor() {
        this.iseCommandRegistration = vscode.commands.registerCommand(
            "PowerShell.EnableISEMode", this.EnableISEMode);
        this.defaultCommandRegistration = vscode.commands.registerCommand(
            "PowerShell.DisableISEMode", this.DisableISEMode);
    }

    public dispose() {
        this.iseCommandRegistration.dispose();
        this.defaultCommandRegistration.dispose();
    }

    private async EnableISEMode() {
        for (const iseSetting of ISECompatibilityFeature.settings) {
            await vscode.workspace.getConfiguration(iseSetting.path).update(iseSetting.name, iseSetting.value, true);
        }

        // Show the PowerShell Command Explorer
        await vscode.commands.executeCommand("workbench.view.extension.PowerShellCommandExplorer");

        if (!Settings.load().sideBar.CommandExplorerVisibility) {
            // Hide the explorer if the setting says so.
            await vscode.commands.executeCommand("workbench.action.toggleSidebarVisibility");
        }
    }

    private async DisableISEMode() {
        for (const iseSetting of ISECompatibilityFeature.settings) {
            const currently = vscode.workspace.getConfiguration(iseSetting.path).get<string | boolean>(iseSetting.name);
            if (currently === iseSetting.value) {
                await vscode.workspace.getConfiguration(iseSetting.path).update(iseSetting.name, undefined, true);
            }
        }
    }
}
