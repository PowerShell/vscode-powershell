/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

'use strict';

import vscode = require('vscode');

export interface IScriptAnalysisSettings {
    enable?: boolean
}

export interface IDeveloperSettings {
    editorServicesHostPath?: string;
    editorServicesWaitForDebugger?: boolean;
}

export interface ISettings {
    scriptAnalysis?: IScriptAnalysisSettings,
    developer?: IDeveloperSettings,
}

export function load(myPluginId: string): ISettings {
    let configuration = vscode.workspace.getConfiguration(myPluginId);

    let defaultScriptAnalysisSettings = {
        enable: true
    };

    let defaultDeveloperSettings = {
        editorServicesHostPath: "../bin/Microsoft.PowerShell.EditorServices.Host.exe",
        editorServicesWaitForDebugger: false
    }

    return {
        scriptAnalysis: configuration.get<IScriptAnalysisSettings>("scriptAnalysis", defaultScriptAnalysisSettings),
        developer: configuration.get<IDeveloperSettings>("developer", defaultDeveloperSettings)
    }
}
