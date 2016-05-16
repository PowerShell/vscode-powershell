/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

'use strict';

import vscode = require('vscode');

export interface IScriptAnalysisSettings {
    enable?: boolean
    settingsPath: string
}

export interface IDeveloperSettings {
    powerShellExePath?: string;
    bundledModulesPath?: string;
    editorServicesLogLevel?: string;
    editorServicesWaitForDebugger?: boolean;
}

export interface ISettings {
    useX86Host?: boolean,
    enableProfileLoading?: boolean,
    scriptAnalysis?: IScriptAnalysisSettings,
    developer?: IDeveloperSettings,
}

export function load(myPluginId: string): ISettings {
    let configuration = vscode.workspace.getConfiguration(myPluginId);

    let defaultScriptAnalysisSettings = {
        enable: true,
        settingsPath: ""
    };

    let defaultDeveloperSettings = {
        powerShellExePath: undefined,
        bundledModulesPath: "../modules/",
        editorServicesLogLevel: "Normal",
        editorServicesWaitForDebugger: false
    }

    return {
        useX86Host: configuration.get<boolean>("useX86Host", false),
        enableProfileLoading: configuration.get<boolean>("enableProfileLoading", false),
        scriptAnalysis: configuration.get<IScriptAnalysisSettings>("scriptAnalysis", defaultScriptAnalysisSettings),
        developer: configuration.get<IDeveloperSettings>("developer", defaultDeveloperSettings)
    }
}
