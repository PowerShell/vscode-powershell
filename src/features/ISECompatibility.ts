// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import * as vscode from "vscode";

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
        { path: "debug", name: "openDebug", value: "neverOpen" },
        { path: "editor", name: "tabCompletion", value: "on" },
        { path: "powershell.integratedConsole", name: "focusConsoleOnExecute", value: false },
        { path: "files", name: "defaultLanguage", value: "powershell" },
        { path: "workbench", name: "colorTheme", value: "PowerShell ISE" },
        { path: "editor", name: "wordSeparators", value: "`~!@#%^&*()-=+[{]}\\|;:'\",.<>/?" },
        { path: "powershell.buttons", name: "showPanelMovementButtons", value: true },
        { path: "powershell.codeFolding", name: "showLastLine", value: false },
        { path: "powershell.sideBar", name: "CommandExplorerVisibility", value: true }
    ];

    private commands: vscode.Disposable[] = [];
    private iseModeEnabled: boolean;
    private originalSettings: Record<string, boolean | string | undefined> = {};

    constructor() {
        const testSetting = ISECompatibilityFeature.settings[ISECompatibilityFeature.settings.length - 1];
        this.iseModeEnabled = vscode.workspace.getConfiguration(testSetting.path).get(testSetting.name) === testSetting.value;
        this.commands = [
            vscode.commands.registerCommand("PowerShell.EnableISEMode", async () => { await this.EnableISEMode(); }),
            vscode.commands.registerCommand("PowerShell.DisableISEMode", async () => { await this.DisableISEMode(); }),
            vscode.commands.registerCommand("PowerShell.ToggleISEMode", async () => { await this.ToggleISEMode(); })
        ];
    }

    public dispose(): void {
        for (const command of this.commands) {
            command.dispose();
        }
    }

    private async EnableISEMode(): Promise<void> {
        this.iseModeEnabled = true;
        for (const iseSetting of ISECompatibilityFeature.settings) {
            try {
                const config = vscode.workspace.getConfiguration(iseSetting.path);
                this.originalSettings[iseSetting.path + iseSetting.name] = config.get(iseSetting.name);
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
    }

    private async DisableISEMode(): Promise<void> {
        this.iseModeEnabled = false;
        for (const iseSetting of ISECompatibilityFeature.settings) {
            const config = vscode.workspace.getConfiguration(iseSetting.path);
            const currently = config.get(iseSetting.name);
            if (currently === iseSetting.value) {
                await config.update(iseSetting.name, this.originalSettings[iseSetting.path + iseSetting.name], true);
            }
        }
    }

    private async ToggleISEMode(): Promise<void> {
        if (this.iseModeEnabled) {
            await this.DisableISEMode();
        } else {
            await this.EnableISEMode();
        }
    }
}
