/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import vscode = require('vscode');
import utils = require('../utils');
import Window = vscode.window;
import ChildProcess = require('child_process');
import { SessionManager } from '../session';
import { IFeature, LanguageClient } from '../feature';

export class PesterTestsFeature implements IFeature {

    private command: vscode.Disposable;
    private languageClient: LanguageClient;

    constructor(private sessionManager: SessionManager) {
        this.command = vscode.commands.registerCommand(
            'PowerShell.RunPesterTests',
            (uriString, runInDebugger, describeBlockName?) => {
                this.launchTests(uriString, runInDebugger, describeBlockName);
            });
    }

    public setLanguageClient(languageClient: LanguageClient) {
        this.languageClient = languageClient;
    }

    public dispose() {
        this.command.dispose();
    }

    private launchTests(uriString, runInDebugger, describeBlockName?) {
        var uri = vscode.Uri.parse(uriString);
        let currentDocument = vscode.window.activeTextEditor.document;

        let launchConfig = {
            request: "launch",
            type: "PowerShell",
            script: "Invoke-Pester",
            args: [
                `-Script "${uri.fsPath}"`,
                describeBlockName
                    ? `-TestName "${describeBlockName}"`
                    : ""
            ],
            internalConsoleOptions: "neverOpen",
            noDebug: !runInDebugger,
            cwd:
                currentDocument.isUntitled
                    ? vscode.workspace.rootPath
                    : currentDocument.fileName
        }

        // Create or show the interactive console
        // TODO #367: Check if "newSession" mode is configured
        vscode.commands.executeCommand('PowerShell.ShowSessionConsole', true);

        // Write out temporary debug session file
        utils.writeSessionFile(
            utils.getDebugSessionFilePath(),
            this.sessionManager.getSessionDetails());

        vscode.commands.executeCommand('vscode.startDebug', launchConfig);
    }
}
