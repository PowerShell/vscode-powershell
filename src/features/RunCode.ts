// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import vscode = require("vscode");
import { SessionManager } from "../session";
import { ILogger } from "../logging";
import { getSettings, chosenWorkspace, validateCwdSetting } from "../settings";

enum LaunchType {
    Debug,
    Run,
}

export class RunCodeFeature implements vscode.Disposable {
    private command: vscode.Disposable;

    constructor(private sessionManager: SessionManager, private logger: ILogger) {
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

        await validateCwdSetting(this.logger);
        await vscode.debug.startDebugging(chosenWorkspace, launchConfig);
    }
}

function createLaunchConfig(launchType: LaunchType, commandToRun: string, args: string[]) {
    const settings = getSettings();

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
