// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import * as path from "path";
import vscode = require("vscode");
import { ILogger } from "../logging";
import { SessionManager } from "../session";
import { getSettings, chosenWorkspace, validateCwdSetting } from "../settings";
import utils = require("../utils");

enum LaunchType {
    Debug,
    Run,
}

export class PesterTestsFeature implements vscode.Disposable {
    private commands: vscode.Disposable[];
    private invokePesterStubScriptPath: string;

    constructor(private sessionManager: SessionManager, private logger: ILogger) {
        this.invokePesterStubScriptPath = path.resolve(__dirname, "../modules/PowerShellEditorServices/InvokePesterStub.ps1");
        this.commands = [
            // File context-menu command - Run Pester Tests
            vscode.commands.registerCommand(
                "PowerShell.RunPesterTestsFromFile",
                (fileUri?) => {
                    return this.launchAllTestsInActiveEditor(LaunchType.Run, fileUri);
                }),

            // File context-menu command - Debug Pester Tests
            vscode.commands.registerCommand(
                "PowerShell.DebugPesterTestsFromFile",
                (fileUri?) => {
                    return this.launchAllTestsInActiveEditor(LaunchType.Debug, fileUri);
                }),

            // This command is provided for usage by PowerShellEditorServices (PSES) only
            vscode.commands.registerCommand(
                "PowerShell.RunPesterTests",
                (uriString, runInDebugger, describeBlockName?, describeBlockLineNumber?, outputPath?) => {
                    return this.launchTests(vscode.Uri.parse(uriString), runInDebugger, describeBlockName, describeBlockLineNumber, outputPath);
                })
        ];
    }

    public dispose() {
        for (const command of this.commands) {
            command.dispose();
        }
    }

    private async launchAllTestsInActiveEditor(
        launchType: LaunchType,
        fileUri?: vscode.Uri): Promise<boolean> {

        if (fileUri === undefined) {
            fileUri = vscode.window.activeTextEditor?.document.uri;
        }

        if (fileUri === undefined) {
            return false;
        }

        const launchConfig = this.createLaunchConfig(fileUri, launchType);
        return this.launch(launchConfig);
    }

    private async launchTests(
        fileUri: vscode.Uri,
        runInDebugger: boolean,
        describeBlockName?: string,
        describeBlockLineNumber?: number,
        outputPath?: string): Promise<boolean> {

        const launchType = runInDebugger ? LaunchType.Debug : LaunchType.Run;
        const launchConfig = this.createLaunchConfig(fileUri, launchType, describeBlockName, describeBlockLineNumber, outputPath);
        return this.launch(launchConfig);
    }

    private createLaunchConfig(
        fileUri: vscode.Uri,
        launchType: LaunchType,
        testName?: string,
        lineNum?: number,
        outputPath?: string): vscode.DebugConfiguration {

        const settings = getSettings();
        const launchConfig = {
            request: "launch",
            type: "PowerShell",
            name: "PowerShell: Launch Pester Tests",
            script: this.invokePesterStubScriptPath,
            args: [
                "-ScriptPath",
                `'${utils.escapeSingleQuotes(fileUri.fsPath)}'`,
            ],
            internalConsoleOptions: "neverOpen",
            noDebug: (launchType === LaunchType.Run),
            createTemporaryIntegratedConsole: settings.debugging.createTemporaryIntegratedConsole
        };

        if (lineNum) {
            launchConfig.args.push("-LineNumber", `${lineNum}`);
        } else if (testName) {
            launchConfig.args.push("-TestName", `'${utils.escapeSingleQuotes(testName)}'`);
        } else {
            launchConfig.args.push("-All");
        }

        if (!settings.pester.useLegacyCodeLens) {
            launchConfig.args.push("-MinimumVersion5");
        }

        if (launchType === LaunchType.Debug) {
            launchConfig.args.push("-Output", `'${settings.pester.debugOutputVerbosity}'`);
        }
        else {
            launchConfig.args.push("-Output", `'${settings.pester.outputVerbosity}'`);
        }

        if (outputPath) {
            launchConfig.args.push("-OutputPath", `'${outputPath}'`);
        }

        return launchConfig;
    }

    private async launch(launchConfig: vscode.DebugConfiguration): Promise<boolean> {
        // Create or show the interactive console
        // TODO: #367 Check if "newSession" mode is configured
        this.sessionManager.showDebugTerminal(true);

        // Ensure the necessary script exists (for testing). The debugger will
        // start regardless, but we also pass its success along.
        await validateCwdSetting(this.logger);
        return await utils.checkIfFileExists(this.invokePesterStubScriptPath)
            && vscode.debug.startDebugging(chosenWorkspace, launchConfig);
    }
}
