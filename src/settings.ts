/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

'use strict';

import vscode = require('vscode');

export interface ICodeFormattingSettings {
    openBraceOnSameLine: boolean;
    newLineAfterOpenBrace: boolean;
}

export interface IScriptAnalysisSettings {
    enable?: boolean;
    settingsPath: string;
}

export interface IDeveloperSettings {
    powerShellExePath?: string;
    bundledModulesPath?: string;
    editorServicesLogLevel?: string;
    editorServicesWaitForDebugger?: boolean;
    powerShellExeIsWindowsDevBuild?: boolean;
}

export interface ISettings {
    useX86Host?: boolean;
    enableProfileLoading?: boolean;
    scriptAnalysis?: IScriptAnalysisSettings;
    developer?: IDeveloperSettings;
    codeFormatting?: ICodeFormattingSettings;
}

export function load(myPluginId: string): ISettings {
    let configuration: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration(myPluginId);

    let defaultScriptAnalysisSettings: IScriptAnalysisSettings = {
        enable: true,
        settingsPath: ""
    };

    let defaultDeveloperSettings: IDeveloperSettings = {
        powerShellExePath: undefined,
        bundledModulesPath: "../modules/",
        editorServicesLogLevel: "Normal",
        editorServicesWaitForDebugger: false,
        powerShellExeIsWindowsDevBuild: false
    };

    let defaultCodeFormattingSettings: ICodeFormattingSettings = {
        openBraceOnSameLine: true,
        newLineAfterOpenBrace: true
    };

    return {
        useX86Host: configuration.get<boolean>("useX86Host", false),
        enableProfileLoading: configuration.get<boolean>("enableProfileLoading", false),
        scriptAnalysis: configuration.get<IScriptAnalysisSettings>("scriptAnalysis", defaultScriptAnalysisSettings),
        developer: configuration.get<IDeveloperSettings>("developer", defaultDeveloperSettings),
        codeFormatting: configuration.get<ICodeFormattingSettings>("codeFormatting", defaultCodeFormattingSettings)
    };
}
