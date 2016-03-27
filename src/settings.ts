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
    editorServicesHostPath?: string;
    editorServicesLogLevel?: string;
    editorServicesWaitForDebugger?: boolean;
}

export interface ISettings {
    useX86Host?: boolean,
    scriptAnalysis?: IScriptAnalysisSettings,
    developer?: IDeveloperSettings,
}

export function load(myPluginId: string): ISettings {
    let configuration = vscode.workspace.getConfiguration(myPluginId);

    let defaultScriptAnalysisSettings = {
        enable: true,
        settingsPath: "./PSScriptAnalyzerSettings.psd1"
    };

    let defaultDeveloperSettings = {
        editorServicesHostPath: "../bin/",
        editorServicesLogLevel: "Normal",
        editorServicesWaitForDebugger: false
    }

    return {
        useX86Host: configuration.get<boolean>("useX86Host", false),
        scriptAnalysis: configuration.get<IScriptAnalysisSettings>("scriptAnalysis", defaultScriptAnalysisSettings),
        developer: configuration.get<IDeveloperSettings>("developer", defaultDeveloperSettings)
    }
}
