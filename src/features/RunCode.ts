// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import vscode = require("vscode");
import { SessionManager } from "../session";
import Settings = require("../settings");

enum LaunchType {
    Debug,
    Run,
}

export class RunCodeFeature implements vscode.Disposable {
    private command: vscode.Disposable;

    constructor(private sessionManager: SessionManager) {
        this.command = vscode.commands.registerCommand(
            "PowerShell.RunCode",
            async (runInDebugger: boolean, scriptToRun: string, args: string[]) => {
                await this.launchTask(runInDebugger, scriptToRun, args);
            });
    }

    public dispose() {
        this.command.dispose();
    }

    private async launchTask(
        runInDebugger: boolean,
        scriptToRun: string,
        args: string[]) {

        const launchType = runInDebugger ? LaunchType.Debug : LaunchType.Run;
        const launchConfig = createLaunchConfig(launchType, scriptToRun, args);
        await this.launch(launchConfig);
    }

    private async launch(launchConfig: string | vscode.DebugConfiguration) {
        // Create or show the interactive console
        // TODO: #367: Check if "newSession" mode is configured
        this.sessionManager.showDebugTerminal(true);

        // TODO: Update to handle multiple root workspaces.
        await vscode.debug.startDebugging(vscode.workspace.workspaceFolders?.[0], launchConfig);
    }
}

function createLaunchConfig(launchType: LaunchType, commandToRun: string, args: string[]) {
    const settings = Settings.load();

    const launchConfig = {
        request: "launch",
        type: "PowerShell",
        name: "PowerShell: Run Code",
        internalConsoleOptions: "neverOpen",
        noDebug: (launchType === LaunchType.Run),
        createTemporaryIntegratedConsole: settings.debugging.createTemporaryIntegratedConsole,
        script: commandToRun,
        args,
    };

    return launchConfig;
}
