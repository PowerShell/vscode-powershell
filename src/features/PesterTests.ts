// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import * as path from "path";
import vscode = require("vscode");
import { SessionManager } from "../session";
import Settings = require("../settings");
import utils = require("../utils");

enum LaunchType {
    Debug,
    Run,
}

export class PesterTestsFeature implements vscode.Disposable {

    private command: vscode.Disposable;
    private invokePesterStubScriptPath: string;

    constructor(private sessionManager: SessionManager) {
        this.invokePesterStubScriptPath = path.resolve(__dirname, "../modules/PowerShellEditorServices/InvokePesterStub.ps1");

        // File context-menu command - Run Pester Tests
        this.command = vscode.commands.registerCommand(
            "PowerShell.RunPesterTestsFromFile",
            (fileUri) => {
                return this.launchAllTestsInActiveEditor(LaunchType.Run, fileUri);
            });
        // File context-menu command - Debug Pester Tests
        this.command = vscode.commands.registerCommand(
            "PowerShell.DebugPesterTestsFromFile",
            (fileUri) => {
                return this.launchAllTestsInActiveEditor(LaunchType.Debug, fileUri);
            });
        // This command is provided for usage by PowerShellEditorServices (PSES) only
        this.command = vscode.commands.registerCommand(
            "PowerShell.RunPesterTests",
            (uriString, runInDebugger, describeBlockName?, describeBlockLineNumber?, outputPath?) => {
                return this.launchTests(uriString, runInDebugger, describeBlockName, describeBlockLineNumber, outputPath);
            });
    }

    public dispose() {
        this.command.dispose();
    }

    private async launchAllTestsInActiveEditor(
        launchType: LaunchType,
        fileUri: vscode.Uri): Promise<boolean> {

        const uriString = (fileUri || vscode.window.activeTextEditor.document.uri).toString();
        const launchConfig = this.createLaunchConfig(uriString, launchType);
        return this.launch(launchConfig);
    }

    private async launchTests(
        uriString: string,
        runInDebugger: boolean,
        describeBlockName?: string,
        describeBlockLineNumber?: number,
        outputPath?: string): Promise<boolean> {

        const launchType = runInDebugger ? LaunchType.Debug : LaunchType.Run;
        const launchConfig = this.createLaunchConfig(uriString, launchType, describeBlockName, describeBlockLineNumber, outputPath);
        return this.launch(launchConfig);
    }

    private createLaunchConfig(
        uriString: string,
        launchType: LaunchType,
        testName?: string,
        lineNum?: number,
        outputPath?: string) {

        const uri = vscode.Uri.parse(uriString);
        const currentDocument = vscode.window.activeTextEditor.document;
        const settings = Settings.load();

        // Since we pass the script path to PSES in single quotes to avoid issues with PowerShell
        // special chars like & $ @ () [], we do have to double up the interior single quotes.
        const scriptPath = uri.fsPath.replace(/'/g, "''");

        const launchConfig = {
            request: "launch",
            type: "PowerShell",
            name: "PowerShell Launch Pester Tests",
            script: this.invokePesterStubScriptPath,
            args: [
                "-ScriptPath",
                `'${scriptPath}'`,
            ],
            internalConsoleOptions: "neverOpen",
            noDebug: (launchType === LaunchType.Run),
            createTemporaryIntegratedConsole: settings.debugging.createTemporaryIntegratedConsole
        };

        if (lineNum) {
            launchConfig.args.push("-LineNumber", `${lineNum}`);
        } else if (testName) {
            // Escape single quotes inside double quotes by doubling them up
            if (testName.includes("'")) {
                testName = testName.replace(/'/g, "''");
            }

            launchConfig.args.push("-TestName", `'${testName}'`);
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

    private async launch(launchConfig): Promise<boolean> {
        // Create or show the interactive console
        // TODO: #367 Check if "newSession" mode is configured
        await vscode.commands.executeCommand("PowerShell.ShowSessionConsole", true);

        // TODO: Update to handle multiple root workspaces.
        //
        // Ensure the necessary script exists (for testing). The debugger will
        // start regardless, but we also pass its success along.
        return utils.fileExists(this.invokePesterStubScriptPath)
            && vscode.debug.startDebugging(vscode.workspace.workspaceFolders?.[0], launchConfig);
    }
}
