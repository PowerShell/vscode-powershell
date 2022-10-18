// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import utils = require("./utils");
import os = require("os");
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
    write(message: string, ...additionalMessages: string[]): void;
    writeDiagnostic(message: string, ...additionalMessages: string[]): void;
    writeVerbose(message: string, ...additionalMessages: string[]): void;
    writeWarning(message: string, ...additionalMessages: string[]): void;
    writeAndShowWarning(message: string, ...additionalMessages: string[]): void;
    writeError(message: string, ...additionalMessages: string[]): void;
}

export class Logger implements ILogger {
    public logBasePath: vscode.Uri;
    public logSessionPath: vscode.Uri | undefined;
    public MinimumLogLevel: LogLevel = LogLevel.Normal;

    private commands: vscode.Disposable[];
    private logChannel: vscode.OutputChannel;
    private logFilePath: vscode.Uri | undefined;

    constructor(logBasePath: vscode.Uri) {
        this.logChannel = vscode.window.createOutputChannel("PowerShell Extension Logs");
        this.logBasePath = vscode.Uri.joinPath(logBasePath, "logs");
        this.commands = [
            vscode.commands.registerCommand(
                "PowerShell.ShowLogs",
                () => { this.showLogPanel(); }),

            vscode.commands.registerCommand(
                "PowerShell.OpenLogFolder",
                async () => { await this.openLogFolder(); }),
        ];
    }

    public dispose() {
        this.logChannel.dispose();
        for (const command of this.commands) {
            command.dispose();
        }
    }

    public getLogFilePath(baseName: string): vscode.Uri {
        return vscode.Uri.joinPath(this.logSessionPath!, `${baseName}.log`);
    }

    private writeAtLevel(logLevel: LogLevel, message: string, ...additionalMessages: string[]): void {
        if (logLevel >= this.MinimumLogLevel) {
            this.writeLine(message, logLevel);

            for (const additionalMessage of additionalMessages) {
                this.writeLine(additionalMessage, logLevel);
            }
        }
    }

    public write(message: string, ...additionalMessages: string[]): void {
        this.writeAtLevel(LogLevel.Normal, message, ...additionalMessages);
    }

    public writeDiagnostic(message: string, ...additionalMessages: string[]): void {
        this.writeAtLevel(LogLevel.Diagnostic, message, ...additionalMessages);
    }

    public writeVerbose(message: string, ...additionalMessages: string[]): void {
        this.writeAtLevel(LogLevel.Verbose, message, ...additionalMessages);
    }

    public writeWarning(message: string, ...additionalMessages: string[]): void {
        this.writeAtLevel(LogLevel.Warning, message, ...additionalMessages);
    }

    public writeAndShowWarning(message: string, ...additionalMessages: string[]): void {
        this.writeWarning(message, ...additionalMessages);

        vscode.window.showWarningMessage(message, "Show Logs").then((selection) => {
            if (selection !== undefined) {
                this.showLogPanel();
            }
        });
    }

    public writeError(message: string, ...additionalMessages: string[]): void {
        this.writeAtLevel(LogLevel.Error, message, ...additionalMessages);
    }

    public async writeAndShowError(message: string, ...additionalMessages: string[]): Promise<void> {
        this.writeError(message, ...additionalMessages);

        const choice = await vscode.window.showErrorMessage(message, "Show Logs");
        if (choice !== undefined) {
            this.showLogPanel();
        }
    }

    public async writeAndShowErrorWithActions(
        message: string,
        actions: { prompt: string; action: () => Promise<void> }[]): Promise<void> {
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

    public async startNewLog(minimumLogLevel = "Normal"): Promise<void> {
        this.MinimumLogLevel = Logger.logLevelNameToValue(minimumLogLevel);

        this.logSessionPath =
            vscode.Uri.joinPath(
                this.logBasePath,
                `${Math.floor(Date.now() / 1000)}-${vscode.env.sessionId}`);

        this.logFilePath = this.getLogFilePath("vscode-powershell");
        await vscode.workspace.fs.createDirectory(this.logSessionPath);
    }

    // TODO: Make the enum smarter about strings so this goes away.
    public static logLevelNameToValue(logLevelName: string): LogLevel {
        switch (logLevelName.trim().toLowerCase()) {
        case "diagnostic": return LogLevel.Diagnostic;
        case "verbose": return LogLevel.Verbose;
        case "normal": return LogLevel.Normal;
        case "warning": return LogLevel.Warning;
        case "error": return LogLevel.Error;
        case "none": return LogLevel.None;
        default: return LogLevel.Normal;
        }
    }

    private showLogPanel(): void {
        this.logChannel.show();
    }

    private async openLogFolder(): Promise<void> {
        if (this.logSessionPath) {
            // Open the folder in VS Code since there isn't an easy way to
            // open the folder in the platform's file browser
            await vscode.commands.executeCommand("vscode.openFolder", this.logSessionPath, true);
        }
    }

    // TODO: Should we await this function above?
    private async writeLine(message: string, level: LogLevel = LogLevel.Normal): Promise<void> {
        const now = new Date();
        const timestampedMessage =
            `${now.toLocaleDateString()} ${now.toLocaleTimeString()} [${LogLevel[level].toUpperCase()}] - ${message}${os.EOL}`;

        this.logChannel.appendLine(timestampedMessage);
        if (this.logFilePath && this.MinimumLogLevel !== LogLevel.None) {
            try {
                let log = new Uint8Array();
                if (await utils.checkIfFileExists(this.logFilePath)) {
                    log = await vscode.workspace.fs.readFile(this.logFilePath);
                }
                await vscode.workspace.fs.writeFile(
                    this.logFilePath,
                    Buffer.concat([log, Buffer.from(timestampedMessage)]));
            } catch (e) {
                // tslint:disable-next-line:no-console
                console.log(`Error writing to vscode-powershell log file: ${e}`);
            }
        }
    }
}
