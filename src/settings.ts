/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

"use strict";

import vscode = require("vscode");
import utils = require("./utils");

enum CodeFormattingPreset {
    Custom,
    Allman,
    OTBS,
    Stroustrup,
}

export enum HelpCompletion {
    Disabled = "Disabled",
    BlockComment = "BlockComment",
    LineComment = "LineComment",
}

export interface IPowerShellAdditionalExePathSettings {
    versionName: string;
    exePath: string;
}

export interface IBugReportingSettings {
    project: string;
}

export interface ICodeFormattingSettings {
    preset: CodeFormattingPreset;
    openBraceOnSameLine: boolean;
    newLineAfterOpenBrace: boolean;
    newLineAfterCloseBrace: boolean;
    whitespaceBeforeOpenBrace: boolean;
    whitespaceBeforeOpenParen: boolean;
    whitespaceAroundOperator: boolean;
    whitespaceAfterSeparator: boolean;
    ignoreOneLineBlock: boolean;
    alignPropertyValuePairs: boolean;
}

export interface IScriptAnalysisSettings {
    enable?: boolean;
    settingsPath: string;
}

export interface IDebuggingSettings {
    createTemporaryIntegratedConsole?: boolean;
}

export interface IDeveloperSettings {
    featureFlags?: string[];
    powerShellExePath?: string;
    bundledModulesPath?: string;
    editorServicesLogLevel?: string;
    editorServicesWaitForDebugger?: boolean;
    powerShellExeIsWindowsDevBuild?: boolean;
}

export interface ISettings {
    powerShellAdditionalExePaths?: IPowerShellAdditionalExePathSettings[];
    powerShellDefaultVersion?: string;
    powerShellExePath?: string;
    bundledModulesPath?: string;
    startAutomatically?: boolean;
    useX86Host?: boolean;
    enableProfileLoading?: boolean;
    helpCompletion: string;
    scriptAnalysis?: IScriptAnalysisSettings;
    debugging?: IDebuggingSettings;
    developer?: IDeveloperSettings;
    codeFormatting?: ICodeFormattingSettings;
    integratedConsole?: IIntegratedConsoleSettings;
    bugReporting?: IBugReportingSettings;
}

export interface IIntegratedConsoleSettings {
    showOnStartup?: boolean;
    focusConsoleOnExecute?: boolean;
}

export function load(): ISettings {
    const configuration: vscode.WorkspaceConfiguration =
        vscode.workspace.getConfiguration(
            utils.PowerShellLanguageId);

    const defaultBugReportingSettings: IBugReportingSettings = {
        project: "https://github.com/PowerShell/vscode-powershell",
    };

    const defaultScriptAnalysisSettings: IScriptAnalysisSettings = {
        enable: true,
        settingsPath: "",
    };

    const defaultDebuggingSettings: IDebuggingSettings = {
        createTemporaryIntegratedConsole: false,
    };

    const defaultDeveloperSettings: IDeveloperSettings = {
        featureFlags: [],
        powerShellExePath: undefined,
        bundledModulesPath: "../../../PowerShellEditorServices/module",
        editorServicesLogLevel: "Normal",
        editorServicesWaitForDebugger: false,
        powerShellExeIsWindowsDevBuild: false,
    };

    const defaultCodeFormattingSettings: ICodeFormattingSettings = {
        preset: CodeFormattingPreset.Custom,
        openBraceOnSameLine: true,
        newLineAfterOpenBrace: true,
        newLineAfterCloseBrace: true,
        whitespaceBeforeOpenBrace: true,
        whitespaceBeforeOpenParen: true,
        whitespaceAroundOperator: true,
        whitespaceAfterSeparator: true,
        ignoreOneLineBlock: true,
        alignPropertyValuePairs: true,
    };

    const defaultIntegratedConsoleSettings: IIntegratedConsoleSettings = {
        showOnStartup: true,
        focusConsoleOnExecute: true,
    };

    return {
        startAutomatically:
            configuration.get<boolean>("startAutomatically", true),
        powerShellAdditionalExePaths:
            configuration.get<IPowerShellAdditionalExePathSettings[]>("powerShellAdditionalExePaths", undefined),
        powerShellDefaultVersion:
            configuration.get<string>("powerShellDefaultVersion", undefined),
        powerShellExePath:
            configuration.get<string>("powerShellExePath", undefined),
        bundledModulesPath:
            "../../modules",
        useX86Host:
            configuration.get<boolean>("useX86Host", false),
        enableProfileLoading:
            configuration.get<boolean>("enableProfileLoading", false),
        helpCompletion:
            configuration.get<string>("helpCompletion", HelpCompletion.BlockComment),
        scriptAnalysis:
            configuration.get<IScriptAnalysisSettings>("scriptAnalysis", defaultScriptAnalysisSettings),
        debugging:
            configuration.get<IDebuggingSettings>("debugging", defaultDebuggingSettings),
        developer:
            getWorkspaceSettingsWithDefaults<IDeveloperSettings>(configuration, "developer", defaultDeveloperSettings),
        codeFormatting:
            configuration.get<ICodeFormattingSettings>("codeFormatting", defaultCodeFormattingSettings),
        integratedConsole:
            configuration.get<IIntegratedConsoleSettings>("integratedConsole", defaultIntegratedConsoleSettings),
        bugReporting:
            configuration.get<IBugReportingSettings>("bugReporting", defaultBugReportingSettings),
    };
}

export function change(settingName: string, newValue: any, global: boolean = false): Thenable<void> {
    const configuration: vscode.WorkspaceConfiguration =
        vscode.workspace.getConfiguration(
            utils.PowerShellLanguageId);

    return configuration.update(settingName, newValue, global);
}

function getWorkspaceSettingsWithDefaults<TSettings>(
    workspaceConfiguration: vscode.WorkspaceConfiguration,
    settingName: string,
    defaultSettings: TSettings): TSettings {

    const importedSettings: TSettings = workspaceConfiguration.get<TSettings>(settingName, defaultSettings);

    for (const setting in importedSettings) {
        if (importedSettings[setting]) {
            defaultSettings[setting] = importedSettings[setting];
        }
    }
    return defaultSettings;
}
