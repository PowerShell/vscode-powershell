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
        {section: "workbench.activityBar", setting: "visible", value: false},
        {section: "debug", setting: "openDebug", value: "neverOpen"},
        {section: "editor", setting: "tabCompletion", value: "on"},
        {section: "powershell.integratedConsole", setting: "focusConsoleOnExecute", value: false},
        {section: "powershell.integratedConsole", setting: "showOnStartup", value: false},
        {section: "files", setting: "defaultLanguage", value: "powershell"},
        {section: "workbench", setting: "colorTheme", value: "PowerShell ISE"},
    ];
    private languageClient: LanguageClient;

    constructor() {
        this.iseCommand = vscode.commands.registerCommand("PowerShell.SetISECompatibility",
            () => this.SetISECompatibility());
        this.defaultCommand = vscode.commands.registerCommand("PowerShell.UnsetISECompatibility",
            () => this.UnsetISECompatibility());
    }

    public dispose() {
        this.iseCommand.dispose();
        this.defaultCommand.dispose();
    }

    public setLanguageClient(languageclient: LanguageClient) {
        this.languageClient = languageclient;
    }

    private SetISECompatibility() {
        this.settings.forEach((value) => {
            vscode.workspace.getConfiguration(value.section).update(value.setting, value.value, true);
        });
    }

    private UnsetISECompatibility() {
        this.settings.forEach((value) => {
            vscode.workspace.getConfiguration(value.section).update(value.setting, undefined, true);
        });
       }
}
