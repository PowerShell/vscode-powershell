/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/
import * as vscode from "vscode";
import { LanguageClient } from "vscode-languageclient";
import { IFeature } from "../feature";

interface ISetting {
    path: string;
    name: string;
    value: string | boolean;
}

/**
 * A feature to implement commands to make code like the ISE and reset the settings.
 */
export class ISECompatibilityFeature implements IFeature {
    private iseCommandRegistration: vscode.Disposable;
    private defaultCommandRegistration: vscode.Disposable;
    private settings: ISetting[] = [
        { path: "workbench.activityBar", name: "visible", value: false },
        { path: "debug", name: "openDebug", value: "neverOpen" },
        { path: "editor", name: "tabCompletion", value: "on" },
        { path: "powershell.integratedConsole", name: "focusConsoleOnExecute", value: false },
        { path: "files", name: "defaultLanguage", value: "powershell" },
        { path: "workbench", name: "colorTheme", value: "PowerShell ISE" },
    ];
    private languageClient: LanguageClient;

    constructor() {
        this.iseCommandRegistration = vscode.commands.registerCommand("PowerShell.EnableISEMode",
            () => this.EnableISEMode());
        this.defaultCommandRegistration = vscode.commands.registerCommand("PowerShell.DisableISEMode",
            () => this.DisableISEMode());
    }

    public dispose() {
        this.iseCommandRegistration.dispose();
        this.defaultCommandRegistration.dispose();
    }

    public setLanguageClient(languageclient: LanguageClient) {
        this.languageClient = languageclient;
    }

    private async EnableISEMode() {
        for (const iseSetting of this.settings) {
            await vscode.workspace.getConfiguration(iseSetting.path).update(iseSetting.name, iseSetting.value, true);
        }
    }

    private async DisableISEMode() {
        for (const iseSetting of this.settings) {
            const currently = vscode.workspace.getConfiguration(iseSetting.path).get(iseSetting.name);
            if (currently === iseSetting.value) {
                await vscode.workspace.getConfiguration(iseSetting.path).update(iseSetting.name, undefined, true);
            }
        }
    }
}
