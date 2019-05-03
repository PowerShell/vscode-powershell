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
        const launchConfig = createLaunchConfig(launchType, scriptToRun, args);
        this.launch(launchConfig);
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

function createLaunchConfig(launchType: LaunchType, commandToRun: string, args: string[]) {
    const settings = Settings.load();

    let cwd: string = vscode.workspace.rootPath;
    if (vscode.window.activeTextEditor
        && vscode.window.activeTextEditor.document
        && !vscode.window.activeTextEditor.document.isUntitled) {
        cwd = path.dirname(vscode.window.activeTextEditor.document.fileName);
    }

    const launchConfig = {
        request: "launch",
        type: "PowerShell",
        name: "PowerShell Run Code",
        internalConsoleOptions: "neverOpen",
        noDebug: (launchType === LaunchType.Run),
        createTemporaryIntegratedConsole: settings.debugging.createTemporaryIntegratedConsole,
        script: commandToRun,
        args,
        cwd,
    };

    return launchConfig;
}
