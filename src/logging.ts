// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import utils = require("./utils");
import os = require("os");
import vscode = require("vscode");

// NOTE: This is not a string enum because the order is used for comparison.
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
    getLogFilePath(baseName: string): vscode.Uri;
    updateLogLevel(logLevelName: string): void;
    write(message: string, ...additionalMessages: string[]): void;
    writeAndShowInformation(message: string, ...additionalMessages: string[]): Promise<void>;
    writeDiagnostic(message: string, ...additionalMessages: string[]): void;
    writeVerbose(message: string, ...additionalMessages: string[]): void;
    writeWarning(message: string, ...additionalMessages: string[]): void;
    writeAndShowWarning(message: string, ...additionalMessages: string[]): Promise<void>;
    writeError(message: string, ...additionalMessages: string[]): void;
    writeAndShowError(message: string, ...additionalMessages: string[]): Promise<void>;
    writeAndShowErrorWithActions(
        message: string,
        actions: { prompt: string; action: (() => Promise<void>) | undefined }[]): Promise<void>;
}

export class Logger implements ILogger {
    public logDirectoryPath: vscode.Uri;

    private logLevel: LogLevel;
    private commands: vscode.Disposable[];
    private logChannel: vscode.OutputChannel;
    private logFilePath: vscode.Uri;
    private logDirectoryCreated = false;
    private writingLog = false;

    constructor(logLevelName: string, globalStorageUri: vscode.Uri) {
        this.logLevel = Logger.logLevelNameToValue(logLevelName);
        this.logChannel = vscode.window.createOutputChannel("PowerShell Extension Logs");
        // We have to override the scheme because it defaults to
        // 'vscode-userdata' which breaks UNC paths.
        this.logDirectoryPath = vscode.Uri.joinPath(
            globalStorageUri.with({ scheme: "file" }),
            "logs",
            `${Math.floor(Date.now() / 1000)}-${vscode.env.sessionId}`);
        this.logFilePath = this.getLogFilePath("vscode-powershell");

        // Early logging of the log paths for debugging.
        if (LogLevel.Diagnostic >= this.logLevel) {
            const uriMessage = Logger.timestampMessage(`Global storage URI: '${globalStorageUri}', log file path: '${this.logFilePath}'`, LogLevel.Diagnostic);
            this.logChannel.appendLine(uriMessage);
        }

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
        return vscode.Uri.joinPath(this.logDirectoryPath, `${baseName}.log`);
    }

    private writeAtLevel(logLevel: LogLevel, message: string, ...additionalMessages: string[]): void {
        if (logLevel >= this.logLevel) {
            void this.writeLine(message, logLevel);

            for (const additionalMessage of additionalMessages) {
                void this.writeLine(additionalMessage, logLevel);
            }
        }
    }

    public write(message: string, ...additionalMessages: string[]): void {
        this.writeAtLevel(LogLevel.Normal, message, ...additionalMessages);
    }

    public async writeAndShowInformation(message: string, ...additionalMessages: string[]): Promise<void> {
        this.write(message, ...additionalMessages);

        const selection = await vscode.window.showInformationMessage(message, "Show Logs");
        if (selection !== undefined) {
            this.showLogPanel();
        }
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

    public async writeAndShowWarning(message: string, ...additionalMessages: string[]): Promise<void> {
        this.writeWarning(message, ...additionalMessages);

        const selection = await vscode.window.showWarningMessage(message, "Show Logs");
        if (selection !== undefined) {
            this.showLogPanel();
        }
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
        actions: { prompt: string; action: (() => Promise<void>) | undefined }[]): Promise<void> {
        this.writeError(message);

        const fullActions = [
            ...actions,
            { prompt: "Show Logs", action: () => { this.showLogPanel(); } },
        ];

        const actionKeys: string[] = fullActions.map((action) => action.prompt);

        const choice = await vscode.window.showErrorMessage(message, ...actionKeys);
        if (choice) {
            for (const action of fullActions) {
                if (choice === action.prompt && action.action !== undefined ) {
                    await action.action();
                    return;
                }
            }
        }
    }

    // TODO: Make the enum smarter about strings so this goes away.
    private static logLevelNameToValue(logLevelName: string): LogLevel {
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

    public updateLogLevel(logLevelName: string): void {
        this.logLevel = Logger.logLevelNameToValue(logLevelName);
    }

    private showLogPanel(): void {
        this.logChannel.show();
    }

    private async openLogFolder(): Promise<void> {
        if (this.logDirectoryCreated) {
            // Open the folder in VS Code since there isn't an easy way to
            // open the folder in the platform's file browser
            await vscode.commands.executeCommand("vscode.openFolder", this.logDirectoryPath, true);
        } else {
            void this.writeAndShowError("Cannot open PowerShell log directory as it does not exist!");
        }
    }

    private static timestampMessage(message: string, level: LogLevel): string {
        const now = new Date();
        return `${now.toLocaleDateString()} ${now.toLocaleTimeString()} [${LogLevel[level].toUpperCase()}] - ${message}${os.EOL}`;
    }

    // TODO: Should we await this function above?
    private async writeLine(message: string, level: LogLevel = LogLevel.Normal): Promise<void> {
        const timestampedMessage = Logger.timestampMessage(message, level);
        this.logChannel.appendLine(timestampedMessage);
        if (this.logLevel !== LogLevel.None) {
            // A simple lock because this function isn't re-entrant.
            while (this.writingLog) {
                await utils.sleep(300);
            }
            try {
                this.writingLog = true;
                if (!this.logDirectoryCreated) {
                    this.logChannel.appendLine(Logger.timestampMessage(`Creating log directory at: '${this.logDirectoryPath}'`, level));
                    await vscode.workspace.fs.createDirectory(this.logDirectoryPath);
                    this.logDirectoryCreated = true;
                }
                let log = new Uint8Array();
                if (await utils.checkIfFileExists(this.logFilePath)) {
                    log = await vscode.workspace.fs.readFile(this.logFilePath);
                }
                await vscode.workspace.fs.writeFile(
                    this.logFilePath,
                    Buffer.concat([log, Buffer.from(timestampedMessage)]));
            } catch (e) {
                console.log(`Error writing to vscode-powershell log file: ${e}`);
            } finally {
                this.writingLog = false;
            }
        }
    }
}
