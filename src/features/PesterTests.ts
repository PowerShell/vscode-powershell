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

export class PesterTestsFeature implements IFeature {

    private command: vscode.Disposable;
    private languageClient: LanguageClient;
    private invokePesterStubScriptPath: string;

    constructor(private sessionManager: SessionManager) {
        this.invokePesterStubScriptPath = path.resolve(__dirname, "../../../InvokePesterStub.ps1");

        // File context-menu command - Run Pester Tests
        this.command = vscode.commands.registerCommand(
            "PowerShell.RunPesterTestsFromFile",
            () => {
                this.launchAllTestsInActiveEditor(LaunchType.Run);
            });
        // File context-menu command - Debug Pester Tests
        this.command = vscode.commands.registerCommand(
            "PowerShell.DebugPesterTestsFromFile",
            () => {
                this.launchAllTestsInActiveEditor(LaunchType.Debug);
            });
        // This command is provided for usage by PowerShellEditorServices (PSES) only
        this.command = vscode.commands.registerCommand(
            "PowerShell.RunPesterTests",
            (uriString, runInDebugger, describeBlockName?, describeBlockLineNumber?) => {
                this.launchTests(uriString, runInDebugger, describeBlockName, describeBlockLineNumber);
            });
    }

    public dispose() {
        this.command.dispose();
    }

    public setLanguageClient(languageClient: LanguageClient) {
        this.languageClient = languageClient;
    }

    private launchAllTestsInActiveEditor(launchType: LaunchType) {
        const uriString = vscode.window.activeTextEditor.document.uri.toString();
        const launchConfig = this.createLaunchConfig(uriString, launchType);
        this.launch(launchConfig);
    }

    private async launchTests(uriString: string, runInDebugger: boolean, describeBlockName?: string, lineNum?: number) {
        // PSES passes null for the describeBlockName to signal that it can't evaluate the TestName.
        if (!describeBlockName) {
            const answer = await vscode.window.showErrorMessage(
                "This Describe block's TestName parameter cannot be evaluated. " +
                `Would you like to ${runInDebugger ? "debug" : "run"} all the tests in this file?`,
                "Yes", "No");

            if (answer !== "Yes") {
                return;
            }
        }

        const launchType = runInDebugger ? LaunchType.Debug : LaunchType.Run;
        const launchConfig = this.createLaunchConfig(uriString, launchType, describeBlockName, lineNum);
        this.launch(launchConfig);
    }

    private createLaunchConfig(uriString: string, launchType: LaunchType, testName?: string, lineNum?: number) {
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
            createTemporaryIntegratedConsole: settings.debugging.createTemporaryIntegratedConsole,
            cwd:
                currentDocument.isUntitled
                    ? vscode.workspace.rootPath
                    : path.dirname(currentDocument.fileName),
        };

        if (lineNum) {
            launchConfig.args.push("-LineNumber", `${lineNum}`);
        }

        if (testName) {
            // Escape single quotes inside double quotes by doubling them up
            if (testName.includes("'")) {
                testName = testName.replace(/'/g, "''");
            }

            launchConfig.args.push("-TestName", `'${testName}'`);
        }

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
