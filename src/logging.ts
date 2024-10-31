// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { LogOutputChannel, Uri, Disposable, LogLevel, window, commands, Event } from "vscode";

/** Interface for logging operations. New features should use this interface for the "type" of logger.
 *  This will allow for easy mocking of the logger during unit tests.
 */
export interface ILogger {
    logDirectoryPath: Uri;
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
    public logDirectoryPath: Uri; // The folder for all the logs
    private commands: Disposable[];
    // Log output channel handles all the verbosity management so we don't have to.
    private logChannel: LogOutputChannel;
    public get logLevel(): LogLevel { return this.logChannel.logLevel;}

    constructor(logPath: Uri, logChannel?: LogOutputChannel) {
        this.logChannel = logChannel ?? window.createOutputChannel("PowerShell", {log: true});
        // We have to override the scheme because it defaults to
        // 'vscode-userdata' which breaks UNC paths.
        this.logDirectoryPath = logPath;

        // Early logging of the log paths for debugging.
        if (this.logLevel > LogLevel.Off) {
            this.logChannel.trace(`Log directory: ${this.logDirectoryPath.fsPath}`);
        }

        this.commands = [
            commands.registerCommand(
                "PowerShell.ShowLogs",
                () => { this.showLogPanel(); }),

            commands.registerCommand(
                "PowerShell.OpenLogFolder",
                async () => { await this.openLogFolder(); }),
        ];
    }

    public dispose(): void {
        this.logChannel.dispose();
        for (const command of this.commands) {
            command.dispose();
        }
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
        this.writeAtLevel(LogLevel.Info, message, ...additionalMessages);
    }

    public async writeAndShowInformation(message: string, ...additionalMessages: string[]): Promise<void> {
        this.write(message, ...additionalMessages);

        const selection = await window.showInformationMessage(message, "Show Logs", "Okay");
        if (selection === "Show Logs") {
            this.showLogPanel();
        }
    }

    public writeDiagnostic(message: string, ...additionalMessages: string[]): void {
        this.writeAtLevel(LogLevel.Trace, message, ...additionalMessages);
    }

    public writeVerbose(message: string, ...additionalMessages: string[]): void {
        this.writeAtLevel(LogLevel.Debug, message, ...additionalMessages);
    }

    public writeWarning(message: string, ...additionalMessages: string[]): void {
        this.writeAtLevel(LogLevel.Warning, message, ...additionalMessages);
    }

    public async writeAndShowWarning(message: string, ...additionalMessages: string[]): Promise<void> {
        this.writeWarning(message, ...additionalMessages);

        const selection = await window.showWarningMessage(message, "Show Logs");
        if (selection !== undefined) {
            this.showLogPanel();
        }
    }

    public writeError(message: string, ...additionalMessages: string[]): void {
        this.writeAtLevel(LogLevel.Error, message, ...additionalMessages);
    }

    public async writeAndShowError(message: string, ...additionalMessages: string[]): Promise<void> {
        this.writeError(message, ...additionalMessages);

        const choice = await window.showErrorMessage(message, "Show Logs");
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
            { prompt: "Show Logs", action: (): void => { this.showLogPanel(); } },
        ];

        const actionKeys: string[] = fullActions.map((action) => action.prompt);

        const choice = await window.showErrorMessage(message, ...actionKeys);
        if (choice) {
            for (const action of fullActions) {
                if (choice === action.prompt && action.action !== undefined ) {
                    await action.action();
                    return;
                }
            }
        }
    }

    private showLogPanel(): void {
        this.logChannel.show();
    }

    private async openLogFolder(): Promise<void> {
        await commands.executeCommand("openFolder", this.logDirectoryPath, true);
    }

    private async writeLine(message: string, level: LogLevel = LogLevel.Info): Promise<void> {
        return new Promise<void>((resolve) => {
            switch (level) {
            case LogLevel.Off: break;
            case LogLevel.Trace: this.logChannel.trace(message); break;
            case LogLevel.Debug: this.logChannel.debug(message); break;
            case LogLevel.Info: this.logChannel.info(message); break;
            case LogLevel.Warning: this.logChannel.warn(message); break;
            case LogLevel.Error: this.logChannel.error(message); break;
            default: this.logChannel.appendLine(message); break;
            }
            resolve();
        });
    }
}

/** Parses logs received via the legacy OutputChannel to LogOutputChannel with proper severity.
 *
 * HACK: This is for legacy compatability and can be removed when https://github.com/microsoft/vscode-languageserver-node/issues/1116 is merged and replaced with a normal LogOutputChannel. We don't use a middleware here because any direct logging calls like client.warn() would not be captured by middleware.
 */
export class LanguageClientOutputChannelAdapter implements LogOutputChannel {
    private channel: LogOutputChannel;
    constructor(channel: LogOutputChannel) {
        this.channel = channel;
    }

    public appendLine(message: string): void {
        this.append(message);
    }

    public append(message: string): void {
        const [parsedMessage, level] = this.parse(message);
        this.sendLogMessage(parsedMessage, level);
    }

    protected parse(message: string): [string, LogLevel] {
        const logLevelMatch = /^\[(?<level>Trace|Debug|Info|Warn|Error) +- \d+:\d+:\d+ [AP]M\] (?<message>.+)/.exec(message);
        if (logLevelMatch) {
            const { level, message } = logLevelMatch.groups!;
            let logLevel: LogLevel;
            switch (level) {
            case "Trace":
                logLevel = LogLevel.Trace;
                break;
            case "Debug":
                logLevel = LogLevel.Debug;
                break;
            case "Info":
                logLevel = LogLevel.Info;
                break;
            case "Warn":
                logLevel = LogLevel.Warning;
                break;
            case "Error":
                logLevel = LogLevel.Error;
                break;
            default:
                logLevel = LogLevel.Info;
                break;
            }
            return [message, logLevel];
        } else {
            return [message, LogLevel.Info];
        }
    }

    protected sendLogMessage(message: string, level: LogLevel): void {
        switch (level) {
        case LogLevel.Trace:
            this.channel.trace(message);
            break;
        case LogLevel.Debug:
            this.channel.debug(message);
            break;
        case LogLevel.Info:
            this.channel.info(message);
            break;
        case LogLevel.Warning:
            this.channel.warn(message);
            break;
        case LogLevel.Error:
            this.channel.error(message);
            break;
        default:
            this.channel.trace(message);
            break;
        }
    }

    // #region Passthru Implementation
    public get name(): string {
        return this.channel.name;
    }
    public get logLevel(): LogLevel {
        return this.channel.logLevel;
    }
    replace(value: string): void {
        this.channel.replace(value);
    }
    show(_column?: undefined, preserveFocus?: boolean): void {
        this.channel.show(preserveFocus);
    }
    public get onDidChangeLogLevel(): Event<LogLevel> {
        return this.channel.onDidChangeLogLevel;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public trace(message: string, ...args: any[]): void {
        this.channel.trace(message, ...args);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public debug(message: string, ...args: any[]): void {
        this.channel.debug(message, ...args);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public info(message: string, ...args: any[]): void {
        this.channel.info(message, ...args);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public warn(message: string, ...args: any[]): void {
        this.channel.warn(message, ...args);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public error(message: string, ...args: any[]): void {
        this.channel.error(message, ...args);
    }
    public clear(): void {
        this.channel.clear();
    }
    public hide(): void {
        this.channel.hide();
    }
    public dispose(): void {
        this.channel.dispose();
    }
    // #endregion
}

/** Overrides the severity of some LSP traces to be more logical */
export class LanguageClientTraceFormatter extends LanguageClientOutputChannelAdapter {

    public override appendLine(message: string): void {
        this.append(message);
    }

    public override append(message: string): void {
        // eslint-disable-next-line prefer-const
        let [parsedMessage, level] = this.parse(message);

        // Override some LSP traces to be more logical
        if (parsedMessage.startsWith("Sending ")) {
            parsedMessage = parsedMessage.replace("Sending", "▶️");
            level = LogLevel.Debug;
        }
        if (parsedMessage.startsWith("Received ")) {
            parsedMessage = parsedMessage.replace("Received", "◀️");
            level = LogLevel.Debug;
        }
        if (parsedMessage.startsWith("Params:")
            || parsedMessage.startsWith("Result:")
        ) {
            level = LogLevel.Trace;
        }

        // These are PSES messages we don't really need to see so we drop these to trace
        if (parsedMessage.startsWith("◀️ notification 'window/logMessage'")) {
            level = LogLevel.Trace;
        }

        this.sendLogMessage(parsedMessage.trimEnd(), level);
    }
}
