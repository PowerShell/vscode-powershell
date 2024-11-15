// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { LogOutputChannel, LogLevel, window, Event } from "vscode";

/** Interface for logging operations. New features should use this interface for the "type" of logger.
 *  This will allow for easy mocking of the logger during unit tests.
 */
export interface ILogger {
    write(message: string, ...additionalMessages: string[]): void;
    writeAndShowInformation(message: string, ...additionalMessages: string[]): Promise<void>;
    writeTrace(message: string, ...additionalMessages: string[]): void;
    writeDebug(message: string, ...additionalMessages: string[]): void;
    writeWarning(message: string, ...additionalMessages: string[]): void;
    writeAndShowWarning(message: string, ...additionalMessages: string[]): Promise<void>;
    writeError(message: string, ...additionalMessages: string[]): void;
    writeAndShowError(message: string, ...additionalMessages: string[]): Promise<void>;
    writeAndShowErrorWithActions(
        message: string,
        actions: { prompt: string; action: (() => Promise<void>) | undefined }[]): Promise<void>;
}

export class Logger implements ILogger {
    // Log output channel handles all the verbosity management so we don't have to.
    private logChannel: LogOutputChannel;
    public get logLevel(): LogLevel { return this.logChannel.logLevel;}

    constructor(logChannel?: LogOutputChannel) {
        this.logChannel = logChannel ?? window.createOutputChannel("PowerShell", {log: true});
    }

    public dispose(): void {
        this.logChannel.dispose();
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

    public writeTrace(message: string, ...additionalMessages: string[]): void {
        this.writeAtLevel(LogLevel.Trace, message, ...additionalMessages);
    }

    public writeDebug(message: string, ...additionalMessages: string[]): void {
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

    public showLogPanel(): void {
        this.logChannel.show();
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
 * HACK: This is for legacy compatability and can be removed when https://github.com/microsoft/vscode-languageserver-node/issues/1116 is merged and replaced with a normal LogOutputChannel. We don't use a middleware here because any direct logging calls like client.warn() and server-initiated messages would not be captured by middleware.
 */
export class LanguageClientOutputChannelAdapter implements LogOutputChannel {
    private _channel: LogOutputChannel | undefined;
    private get channel(): LogOutputChannel {
        if (!this._channel) {
            this._channel = window.createOutputChannel(this.channelName, {log: true});
        }
        return this._channel;
    }

    /**
     * Creates an instance of the logging class.
     *
     * @param channelName - The name of the output channel.
     * @param parser - A function that parses a log message and returns a tuple containing the parsed message and its log level, or undefined if the log should be filtered.
     */
    constructor(
        private channelName: string,
        private parser: (message: string) => [string, LogLevel] | undefined = LanguageClientOutputChannelAdapter.omnisharpLspParser.bind(this)
    ) {
    }

    public appendLine(message: string): void {
        this.append(message);
    }

    public append(message: string): void {
        const parseResult = this.parser(message);
        if (parseResult !== undefined) {this.sendLogMessage(...parseResult);}
    }

    /** Converts from Omnisharp logs since middleware for LogMessage does not currently exist **/
    public static omnisharpLspParser(message: string): [string, LogLevel] {
        const logLevelMatch = /^\[(?<level>Trace|Debug|Info|Warn|Error) +- \d+:\d+:\d+ [AP]M\] (?<message>.+)/.exec(message);
        const logLevel: LogLevel = logLevelMatch?.groups?.level
            ? LogLevel[logLevelMatch.groups.level as keyof typeof LogLevel]
            : LogLevel.Info;
        const logMessage = logLevelMatch?.groups?.message ?? message;

        return [logMessage, logLevel];
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
            this.channel.error("!UNKNOWN LOG LEVEL!: " + message);
            break;
        }
    }

    // #region Passthru Implementation
    public get name(): string {
        // prevents the window from being created unless we get a log request
        return this.channelName;
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

/** Special parsing for PowerShell Editor Services LSP messages since the LogLevel cannot be read due to vscode
 * LanguageClient Limitations (https://github.com/microsoft/vscode-languageserver-node/issues/1116)
  */
export function PsesParser(message: string): [string, LogLevel] {
    const logLevelMatch = /^<(?<level>Trace|Debug|Info|Warning|Error)>(?<message>.+)/.exec(message);
    const logLevel: LogLevel = logLevelMatch?.groups?.level
        ? LogLevel[logLevelMatch.groups.level as keyof typeof LogLevel]
        : LogLevel.Info;
    const logMessage = logLevelMatch?.groups?.message ?? message;

    return ["[PSES] " + logMessage, logLevel];
}

/** Lsp Trace Parser that does some additional parsing and formatting to make it look nicer */
export function LspTraceParser(message: string): [string, LogLevel] {
    let [parsedMessage, level] = LanguageClientOutputChannelAdapter.omnisharpLspParser(message);
    if (parsedMessage.startsWith("Sending ")) {
        parsedMessage = parsedMessage.replace("Sending", "➡️");
        level = LogLevel.Debug;
    }
    if (parsedMessage.startsWith("Received ")) {
        parsedMessage = parsedMessage.replace("Received", "⬅️");
        level = LogLevel.Debug;
    }
    if (parsedMessage.startsWith("Params:")
        || parsedMessage.startsWith("Result:")
    ) {
        level = LogLevel.Trace;
    }

    // These are PSES messages that get logged to the output channel anyways so we drop these to trace for easy noise filtering
    if (parsedMessage.startsWith("⬅️ notification 'window/logMessage'")) {
        level = LogLevel.Trace;
    }

    return [parsedMessage.trimEnd(), level];
}
