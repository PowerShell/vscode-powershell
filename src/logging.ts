// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import fs = require("fs");
import os = require("os");
import path = require("path");
import vscode = require("vscode");

export enum LogLevel {
    Diagnostic,
    Verbose,
    Normal,
    Warning,
    Error,
    None,
}

/** Interface for logging operations. New features should use this interface for the "type" of logger.
 *  This will allow for easy mocking of the logger during unit tests.
 */
export interface ILogger {
    write(message: string, ...additionalMessages: string[]);
    writeDiagnostic(message: string, ...additionalMessages: string[]);
    writeVerbose(message: string, ...additionalMessages: string[]);
    writeWarning(message: string, ...additionalMessages: string[]);
    writeAndShowWarning(message: string, ...additionalMessages: string[]);
    writeError(message: string, ...additionalMessages: string[]);
}

export class Logger implements ILogger {

    public logBasePath: vscode.Uri;
    public logSessionPath: vscode.Uri;
    public MinimumLogLevel: LogLevel = LogLevel.Normal;

    private commands: vscode.Disposable[];
    private logChannel: vscode.OutputChannel;
    private logFilePath: vscode.Uri;

    constructor(logBasePath: vscode.Uri) {
        this.logChannel = vscode.window.createOutputChannel("PowerShell Extension Logs");
        this.logBasePath = vscode.Uri.joinPath(logBasePath, "logs");

        this.commands = [
            vscode.commands.registerCommand(
                "PowerShell.ShowLogs",
                () => { this.showLogPanel(); }),

            vscode.commands.registerCommand(
                "PowerShell.OpenLogFolder",
                () => { this.openLogFolder(); }),
        ];
    }

    public dispose() {
        this.commands.forEach((command) => { command.dispose(); });
        this.logChannel.dispose();
    }

    public getLogFilePath(baseName: string): vscode.Uri {
        return vscode.Uri.joinPath(this.logSessionPath, `${baseName}.log`);
    }

    public writeAtLevel(logLevel: LogLevel, message: string, ...additionalMessages: string[]) {
        if (logLevel >= this.MinimumLogLevel) {
            this.writeLine(message, logLevel);

            additionalMessages.forEach((line) => {
                this.writeLine(line, logLevel);
            });
        }
    }

    public write(message: string, ...additionalMessages: string[]) {
        this.writeAtLevel(LogLevel.Normal, message, ...additionalMessages);
    }

    public writeDiagnostic(message: string, ...additionalMessages: string[]) {
        this.writeAtLevel(LogLevel.Diagnostic, message, ...additionalMessages);
    }

    public writeVerbose(message: string, ...additionalMessages: string[]) {
        this.writeAtLevel(LogLevel.Verbose, message, ...additionalMessages);
    }

    public writeWarning(message: string, ...additionalMessages: string[]) {
        this.writeAtLevel(LogLevel.Warning, message, ...additionalMessages);
    }

    public writeAndShowWarning(message: string, ...additionalMessages: string[]) {
        this.writeWarning(message, ...additionalMessages);

        vscode.window.showWarningMessage(message, "Show Logs").then((selection) => {
            if (selection !== undefined) {
                this.showLogPanel();
            }
        });
    }

    public writeError(message: string, ...additionalMessages: string[]) {
        this.writeAtLevel(LogLevel.Error, message, ...additionalMessages);
    }

    public writeAndShowError(message: string, ...additionalMessages: string[]) {
        this.writeError(message, ...additionalMessages);

        vscode.window.showErrorMessage(message, "Show Logs").then((selection) => {
            if (selection !== undefined) {
                this.showLogPanel();
            }
        });
    }

    public async writeAndShowErrorWithActions(
        message: string,
        actions: { prompt: string; action: () => Promise<void> }[]) {
        this.writeError(message);

        const fullActions = [
            ...actions,
            { prompt: "Show Logs", action: async () => { this.showLogPanel(); } },
        ];

        const actionKeys: string[] = fullActions.map((action) => action.prompt);

        const choice = await vscode.window.showErrorMessage(message, ...actionKeys);
        if (choice) {
            for (const action of fullActions) {
                if (choice === action.prompt) {
                    await action.action();
                    return;
                }
            }
        }
    }

    public async startNewLog(minimumLogLevel: string = "Normal") {
        this.MinimumLogLevel = this.logLevelNameToValue(minimumLogLevel.trim());

        this.logSessionPath =
            vscode.Uri.joinPath(
                this.logBasePath,
                `${Math.floor(Date.now() / 1000)}-${vscode.env.sessionId}`);

        this.logFilePath = this.getLogFilePath("vscode-powershell");
        await vscode.workspace.fs.createDirectory(this.logSessionPath);
    }

    private logLevelNameToValue(logLevelName: string): LogLevel {
        switch (logLevelName.toLowerCase()) {
            case "diagnostic": return LogLevel.Diagnostic;
            case "verbose": return LogLevel.Verbose;
            case "normal": return LogLevel.Normal;
            case "warning": return LogLevel.Warning;
            case "error": return LogLevel.Error;
            case "none": return LogLevel.None;
            default: return LogLevel.Normal;
        }
    }

    private showLogPanel() {
        this.logChannel.show();
    }

    private openLogFolder() {
        if (this.logSessionPath) {
            // Open the folder in VS Code since there isn't an easy way to
            // open the folder in the platform's file browser
            vscode.commands.executeCommand("vscode.openFolder", this.logSessionPath, true);
        }
    }

    private writeLine(message: string, level: LogLevel = LogLevel.Normal) {
        const now = new Date();
        const timestampedMessage =
            `${now.toLocaleDateString()} ${now.toLocaleTimeString()} [${LogLevel[level].toUpperCase()}] - ${message}`;

        this.logChannel.appendLine(timestampedMessage);
        if (this.logFilePath && this.MinimumLogLevel !== LogLevel.None) {
            fs.appendFile(
                this.logFilePath.fsPath,
                timestampedMessage + os.EOL,
                (err) => {
                    if (err) {
                        // tslint:disable-next-line:no-console
                        console.log(`Error writing to vscode-powershell log file: ${err}`);
                    }
                });
        }
    }
}
