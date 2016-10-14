/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import vscode = require('vscode');
import Window = vscode.window;
import ChildProcess = require('child_process');
import { IFeature, LanguageClient } from '../feature';

export class OpenInISEFeature implements IFeature {
    private command: vscode.Disposable;

    constructor() {
        this.command = vscode.commands.registerCommand('PowerShell.OpenInISE', () => {

            var editor = Window.activeTextEditor;
            var document = editor.document;
            var uri = document.uri

            if (process.env.hasOwnProperty('PROCESSOR_ARCHITEW6432')) {
                var ISEPath = process.env.windir + '\\Sysnative\\WindowsPowerShell\\v1.0\\powershell_ise.exe';
            } else {
                var ISEPath = process.env.windir + '\\System32\\WindowsPowerShell\\v1.0\\powershell_ise.exe';
            }

            ChildProcess.exec(ISEPath + ' -File "' + uri.fsPath + '"').unref();
        });
    }

    public setLanguageClient(languageClient: LanguageClient) {
        // Not needed for this feature.
    }

    public dispose() {
        this.command.dispose();
    }
}