/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

'use strict';

import vscode = require('vscode');

export interface ICodeFormattingSettings {
    openBraceOnSameLine: boolean;
    newLineAfterOpenBrace: boolean;
    newLineAfterCloseBrace: boolean;
    whitespaceBeforeOpenBrace: boolean;
    whitespaceBeforeOpenParen: boolean;
    whitespaceAroundOperator: boolean;
    whitespaceAfterSeparator: boolean;
    ignoreOneLineBlock: boolean;
}

export interface IScriptAnalysisSettings {
    enable?: boolean;
    settingsPath: string;
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
    startAutomatically?: boolean;
    useX86Host?: boolean;
    enableProfileLoading?: boolean;
    scriptAnalysis?: IScriptAnalysisSettings;
    developer?: IDeveloperSettings;
    codeFormatting?: ICodeFormattingSettings;
    integratedConsole?: IIntegratedConsoleSettings;
}

export interface IIntegratedConsoleSettings {
    showOnStartup?: boolean;
}

export function load(myPluginId: string): ISettings {
    let configuration: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration(myPluginId);

    let defaultScriptAnalysisSettings: IScriptAnalysisSettings = {
        enable: true,
        settingsPath: ""
    };

    let defaultDeveloperSettings: IDeveloperSettings = {
        featureFlags: [],
        powerShellExePath: undefined,
        bundledModulesPath: undefined,
        editorServicesLogLevel: "Normal",
        editorServicesWaitForDebugger: false,
        powerShellExeIsWindowsDevBuild: false
    };

    let defaultCodeFormattingSettings: ICodeFormattingSettings = {
        openBraceOnSameLine: true,
        newLineAfterOpenBrace: true,
        newLineAfterCloseBrace: true,
        whitespaceBeforeOpenBrace: true,
        whitespaceBeforeOpenParen: true,
        whitespaceAroundOperator: true,
        whitespaceAfterSeparator: true,
        ignoreOneLineBlock: true
    };

    let defaultIntegratedConsoleSettings: IIntegratedConsoleSettings = {
        showOnStartup: true,
    };

    return {
        startAutomatically: configuration.get<boolean>("startAutomatically", true),
        useX86Host: configuration.get<boolean>("useX86Host", false),
        enableProfileLoading: configuration.get<boolean>("enableProfileLoading", false),
        scriptAnalysis: configuration.get<IScriptAnalysisSettings>("scriptAnalysis", defaultScriptAnalysisSettings),
        developer: configuration.get<IDeveloperSettings>("developer", defaultDeveloperSettings),
        codeFormatting: configuration.get<ICodeFormattingSettings>("codeFormatting", defaultCodeFormattingSettings),
        integratedConsole: configuration.get<IIntegratedConsoleSettings>("integratedConsole", defaultIntegratedConsoleSettings)
    };
}
