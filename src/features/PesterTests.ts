/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as path from "path";
import vscode = require("vscode");
import { IFeature, LanguageClient } from "../feature";
import { SessionManager } from "../session";
import Settings = require("../settings");
import utils = require("../utils");

export class PesterTestsFeature implements IFeature {

    private command: vscode.Disposable;
    private languageClient: LanguageClient;

    constructor(private sessionManager: SessionManager) {
        this.command = vscode.commands.registerCommand(
            "PowerShell.RunPesterTests",
            (uriString, runInDebugger, describeBlockName?) => {
                this.launchTests(uriString, runInDebugger, describeBlockName);
            });
    }

    public dispose() {
        this.command.dispose();
    }

    public setLanguageClient(languageClient: LanguageClient) {
        this.languageClient = languageClient;
    }

    private launchTests(uriString, runInDebugger, describeBlockName?) {
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
            script: "Invoke-Pester",
            args: [
                "-Script",
                `'${scriptPath}'`,
                "-PesterOption",
                "@{IncludeVSCodeMarker=$true}",
            ],
            internalConsoleOptions: "neverOpen",
            noDebug: !runInDebugger,
            createTemporaryIntegratedConsole: settings.debugging.createTemporaryIntegratedConsole,
            cwd:
                currentDocument.isUntitled
                    ? vscode.workspace.rootPath
                    : path.dirname(currentDocument.fileName),
        };

        if (describeBlockName) {
            launchConfig.args.push("-TestName");
            launchConfig.args.push(`'${describeBlockName}'`);
        }

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
