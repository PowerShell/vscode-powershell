/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import fs = require("fs");
import os = require("os");
import path = require("path");
import vscode = require("vscode");
import utils = require("./utils");

export enum LogLevel {
    Verbose,
    Normal,
    Warning,
    Error,
}

export class Logger {

    public logBasePath: string;
    public logSessionPath: string;
    public MinimumLogLevel: LogLevel = LogLevel.Normal;

    private commands: vscode.Disposable[];
    private logChannel: vscode.OutputChannel;
    private logFilePath: string;

    constructor() {
        this.logChannel = vscode.window.createOutputChannel("PowerShell Extension Logs");

        this.logBasePath = path.resolve(__dirname, "../../logs");
        utils.ensurePathExists(this.logBasePath);

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

    public getLogFilePath(baseName: string): string {
        return path.resolve(this.logSessionPath, `${baseName}.log`);
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

    public startNewLog(minimumLogLevel: string = "Normal") {
        this.MinimumLogLevel = this.logLevelNameToValue(minimumLogLevel.trim());

        this.logSessionPath =
            path.resolve(
                this.logBasePath,
                `${Math.floor(Date.now() / 1000)}-${vscode.env.sessionId}`);

        this.logFilePath = this.getLogFilePath("vscode-powershell");

        utils.ensurePathExists(this.logSessionPath);
    }

    private logLevelNameToValue(logLevelName: string): LogLevel {
        switch (logLevelName.toLowerCase()) {
            case "normal": return LogLevel.Normal;
            case "verbose": return LogLevel.Verbose;
            case "warning": return LogLevel.Warning;
            case "error": return LogLevel.Error;
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
            vscode.commands.executeCommand(
                "vscode.openFolder",
                vscode.Uri.file(this.logSessionPath),
                true);
        }
    }

    private writeLine(message: string, level: LogLevel = LogLevel.Normal) {
        const now = new Date();
        const timestampedMessage =
            `${now.toLocaleDateString()} ${now.toLocaleTimeString()} [${LogLevel[level].toUpperCase()}] - ${message}`;

        this.logChannel.appendLine(timestampedMessage);
        if (this.logFilePath) {
            fs.appendFile(
                this.logFilePath,
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
