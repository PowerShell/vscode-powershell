/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as path from "path";
import vscode = require("vscode");
import { IFeature, LanguageClient } from "../feature";
import { SessionManager } from "../session";
import Settings = require("../settings");
import utils = require("../utils");

enum LaunchType {
    Debug,
    Run,
}

export class RunCodeFeature implements IFeature {

    private command: vscode.Disposable;
    private languageClient: LanguageClient;

    constructor(private sessionManager: SessionManager) {
        this.command = vscode.commands.registerCommand(
            "PowerShell.RunCode",
            (runInDebugger: boolean, scriptToRun: string, args: string[]) => {
                this.launchTask(runInDebugger, scriptToRun, args);
            });
    }

    public dispose() {
        this.command.dispose();
    }

    public setLanguageClient(languageClient: LanguageClient) {
        this.languageClient = languageClient;
    }

    private async launchTask(
        runInDebugger: boolean,
        scriptToRun: string,
        args: string[]) {

        const launchType = runInDebugger ? LaunchType.Debug : LaunchType.Run;
        const launchConfig = this.createLaunchConfig(launchType, scriptToRun, args);
        this.launch(launchConfig);
    }

    private createLaunchConfig(launchType: LaunchType, scriptToRun: string, args: string[]) {
        const currentDocument = vscode.window.activeTextEditor.document;
        const settings = Settings.load();

        // Since we pass the script path to PSES in single quotes to avoid issues with PowerShell
        // special chars like & $ @ () [], we do have to double up the interior single quotes.

        const launchConfig = {
            request: "launch",
            type: "PowerShell",
            name: "PowerShell Launch Pester Tests",
            script: scriptToRun,
            args,
            internalConsoleOptions: "neverOpen",
            noDebug: (launchType === LaunchType.Run),
            createTemporaryIntegratedConsole: settings.debugging.createTemporaryIntegratedConsole,
            cwd:
                currentDocument.isUntitled
                    ? vscode.workspace.rootPath
                    : path.dirname(currentDocument.fileName),
        };

        return launchConfig;
    }

    private launch(launchConfig) {
        // Create or show the interactive console
        // TODO #367: Check if "newSession" mode is configured
        vscode.commands.executeCommand("PowerShell.ShowSessionConsole", true);

        // Write out temporary debug session file
        utils.writeSessionFile(
            utils.getDebugSessionFilePath(),
            this.sessionManager.getSessionDetails());

        // TODO: Update to handle multiple root workspaces.
        vscode.debug.startDebugging(vscode.workspace.workspaceFolders[0], launchConfig);
    }
}
