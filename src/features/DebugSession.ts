/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import vscode = require('vscode');
import { IFeature } from '../feature';
import { LanguageClient } from 'vscode-languageclient';

export class DebugSessionFeature implements IFeature {
    private command: vscode.Disposable;
    private examplesPath: string;

    constructor() {
        this.command = vscode.commands.registerCommand(
            'PowerShell.StartDebugSession',
            config => { this.startDebugSession(config); });
    }

    public setLanguageClient(languageclient: LanguageClient) {
    }

    public dispose() {
        this.command.dispose();
    }

    private startDebugSession(config: any) {
        if (!config.request) {
            // No launch.json, create the default configuration
            config.type = 'PowerShell';
            config.name = 'PowerShell Launch Current File';
            config.request = 'launch';
            config.args = [];
            config.script = vscode.window.activeTextEditor.document.fileName;
        }

        if (config.request === 'launch') {
            // Make sure there's a usable working directory if possible
            config.cwd = config.cwd || vscode.workspace.rootPath || config.script;
        }

        vscode.commands.executeCommand('vscode.startDebug', config);
    }
}