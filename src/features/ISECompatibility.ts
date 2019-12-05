/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/
import * as vscode from "vscode";
import { LanguageClient } from "vscode-languageclient";
import { IFeature } from "../feature";

/**
 * A feature to implement commands to make code like the ISE and reset the settings.
 */
export class ISECompatibilityFeature implements IFeature {
    private iseCommand: vscode.Disposable;
    private defaultCommand: vscode.Disposable;
    private settings = [
        { section: "workbench.activityBar", setting: "visible", value: false },
        { section: "debug", setting: "openDebug", value: "neverOpen" },
        { section: "editor", setting: "tabCompletion", value: "on" },
        { section: "powershell.integratedConsole", setting: "focusConsoleOnExecute", value: false },
        { section: "files", setting: "defaultLanguage", value: "powershell" },
        { section: "workbench", setting: "colorTheme", value: "PowerShell ISE" },
    ];
    private languageClient: LanguageClient;

    constructor() {
        this.iseCommand = vscode.commands.registerCommand("PowerShell.EnableISEMode",
            () => this.EnableISEMode());
        this.defaultCommand = vscode.commands.registerCommand("PowerShell.DisableISEMode",
            () => this.DisableISEMode());
    }

    public dispose() {
        this.iseCommand.dispose();
        this.defaultCommand.dispose();
    }

    public setLanguageClient(languageclient: LanguageClient) {
        this.languageClient = languageclient;
    }

    private EnableISEMode() {
        this.settings.forEach(async (value) => {
            await vscode.workspace.getConfiguration(value.section).update(value.setting, value.value, true);
        });
    }

    private DisableISEMode() {
        this.settings.forEach(async (value) => {
            const currently = vscode.workspace.getConfiguration(value.section).get(value.setting);
            if (currently === value.value) {
                await vscode.workspace.getConfiguration(value.section).update(value.setting, undefined, true);
            }
        });
    }
}
