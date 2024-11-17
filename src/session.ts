// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import net = require("net");
import path = require("path");
import vscode = require("vscode");
import TelemetryReporter, { TelemetryEventProperties, TelemetryEventMeasurements } from "@vscode/extension-telemetry";
import { Message } from "vscode-jsonrpc";
import { ILogger, LanguageClientOutputChannelAdapter, LspTraceParser, PsesParser } from "./logging";
import { PowerShellProcess } from "./process";
import { Settings, changeSetting, getSettings, getEffectiveConfigurationTarget, validateCwdSetting } from "./settings";
import utils = require("./utils");

import {
    CloseAction, CloseHandlerResult, DocumentSelector, ErrorAction, ErrorHandlerResult,
    LanguageClientOptions, Middleware, NotificationType,
    RequestType0, ResolveCodeLensSignature,
    RevealOutputChannelOn,
} from "vscode-languageclient";
import { LanguageClient, StreamInfo } from "vscode-languageclient/node";

import { UpdatePowerShell } from "./features/UpdatePowerShell";
import {
    getPlatformDetails, IPlatformDetails, IPowerShellExeDetails,
    OperatingSystem, PowerShellExeFinder
} from "./platform";
import { LanguageClientConsumer } from "./languageClientConsumer";
import { SemVer, satisfies } from "semver";

enum SessionStatus {
    NotStarted = "Not Started",
    Starting = "Starting",
    Running = "Running",
    Busy = "Busy",
    Stopping = "Stopping",
    Failed = "Failed",
}

export enum RunspaceType {
    Local,
    Process,
    Remote,
}
export interface IEditorServicesSessionDetails {
    status: string;
    reason: string;
    powerShellVersion: string;
    channel: string;
    languageServicePort: number;
    debugServicePort: number;
    languageServicePipeName: string;
    debugServicePipeName: string;
}

export interface IPowerShellVersionDetails {
    version: string;
    edition: string;
    commit: string;
    architecture: string;
}

export type IReadSessionFileCallback = (details: IEditorServicesSessionDetails) => void;

export const SendKeyPressNotificationType =
    new NotificationType<void>("powerShell/sendKeyPress");

export const ExecutionBusyStatusNotificationType =
    new NotificationType<boolean>("powerShell/executionBusyStatus");

export const PowerShellVersionRequestType =
    new RequestType0<IPowerShellVersionDetails, void>(
        "powerShell/getVersion");

export class SessionManager implements Middleware {
    public HostName: string;
    public DisplayName: string;
    public HostVersion: string;
    public Publisher: string;
    public PowerShellExeDetails: IPowerShellExeDetails | undefined;
    private readonly ShowSessionMenuCommandName = "PowerShell.ShowSessionMenu";
    private debugEventHandler: vscode.Disposable | undefined;
    private debugSessionProcess: PowerShellProcess | undefined;
    private languageClient: LanguageClient | undefined;
    private languageClientConsumers: LanguageClientConsumer[] = [];
    private languageServerProcess: PowerShellProcess | undefined;
    private languageStatusItem: vscode.LanguageStatusItem;
    private platformDetails: IPlatformDetails;
    private registeredCommands: vscode.Disposable[] = [];
    private registeredHandlers: vscode.Disposable[] = [];
    private sessionDetails: IEditorServicesSessionDetails | undefined;
    private sessionsFolder: vscode.Uri;
    private sessionStatus: SessionStatus = SessionStatus.NotStarted;
    private shellIntegrationEnabled = false;
    private startCancellationTokenSource: vscode.CancellationTokenSource | undefined;
    private suppressRestartPrompt = false;
    private versionDetails: IPowerShellVersionDetails | undefined;
    private traceLogLevelHandler?: vscode.Disposable;

    constructor(
        private extensionContext: vscode.ExtensionContext,
        private sessionSettings: Settings,
        private logger: ILogger,
        private documentSelector: DocumentSelector,
        hostName: string,
        displayName: string,
        hostVersion: string,
        publisher: string,
        private telemetryReporter: TelemetryReporter) {
        // Create the language status item
        this.languageStatusItem = this.createStatusBarItem();
        // We have to override the scheme because it defaults to
        // 'vscode-userdata' which breaks UNC paths.
        this.sessionsFolder = vscode.Uri.joinPath(extensionContext.globalStorageUri.with({ scheme: "file" }), "sessions");

        this.platformDetails = getPlatformDetails();
        this.HostName = hostName;
        this.DisplayName = displayName;
        this.HostVersion = hostVersion;
        this.Publisher = publisher;

        const osBitness = this.platformDetails.isOS64Bit ? "64-bit" : "32-bit";
        const procBitness = this.platformDetails.isProcess64Bit ? "64-bit" : "32-bit";

        this.logger.write(
            `Visual Studio Code: v${vscode.version} ${procBitness}`
            + ` on ${OperatingSystem[this.platformDetails.operatingSystem]} ${osBitness}`,
            `${this.DisplayName} Extension: v${this.HostVersion}`);

        // Fix the host version so that PowerShell can consume it.
        // This is needed when the extension uses a prerelease
        // version string like 0.9.1-insiders-1234.
        this.HostVersion = this.HostVersion.split("-")[0];

        this.registerCommands();
    }

    public async dispose(): Promise<void> {
        await this.stop(); // A whole lot of disposals.

        this.languageStatusItem.dispose();

        for (const handler of this.registeredHandlers) {
            handler.dispose();
        }

        for (const command of this.registeredCommands) {
            command.dispose();
        }
    }

    // The `exeNameOverride` is used by `restartSession` to override ANY other setting.
    // We've made this function idempotent, so it can used to ensure the session has started.
    public async start(): Promise<void> {
        switch (this.sessionStatus) {
        case SessionStatus.NotStarted:
            // Go ahead and start.
            break;
        case SessionStatus.Starting:
            // A simple lock because this function isn't re-entrant.
            this.logger.writeWarning("Re-entered 'start' so waiting...");
            await this.waitWhileStarting();
            return;
        case SessionStatus.Running:
            // We're started, just return.
            this.logger.writeDebug("Already started.");
            return;
        case SessionStatus.Busy:
            // We're started but busy so notify and return.
            // TODO: Make a proper notification for this and when IntelliSense is blocked.
            this.logger.write("The Extension Terminal is currently busy, please wait for your task to finish!");
            return;
        case SessionStatus.Stopping:
            // Wait until done stopping, then start.
            this.logger.writeDebug("Still stopping.");
            await this.waitWhileStopping();
            break;
        case SessionStatus.Failed:
            // Try to start again.
            this.logger.writeDebug("Previously failed, starting again.");
            break;
        }

        // This status needs to be set immediately so the above check works
        this.setSessionStatus("Starting...", SessionStatus.Starting);

        this.startCancellationTokenSource = new vscode.CancellationTokenSource();
        const cancellationToken = this.startCancellationTokenSource.token;

        // Create a folder for the session files.
        await vscode.workspace.fs.createDirectory(this.sessionsFolder);

        // Migrate things.
        await this.migrateWhitespaceAroundPipeSetting();

        // Update non-PowerShell settings.
        this.shellIntegrationEnabled = vscode.workspace.getConfiguration("terminal.integrated.shellIntegration").get<boolean>("enabled") ?? false;

        // Find the PowerShell executable to use for the server.
        this.PowerShellExeDetails = await this.findPowerShell();

        if (this.PowerShellExeDetails === undefined) {
            const message = "Unable to find PowerShell!"
                + " Do you have it installed?"
                + " You can also configure custom installations"
                + " with the 'powershell.powerShellAdditionalExePaths' setting.";
            void this.setSessionFailedGetPowerShell(message);
            return;
        }

        // Refresh the status with the found executable details.
        this.refreshSessionStatus();
        this.logger.write(`Starting '${this.PowerShellExeDetails.displayName}' at: ${this.PowerShellExeDetails.exePath}`);

        // Start the server.
        this.languageServerProcess = await this.startLanguageServerProcess(
            this.PowerShellExeDetails,
            cancellationToken);

        // Check that we got session details and that they had a "started" status.
        if (this.sessionDetails === undefined || !this.sessionStarted(this.sessionDetails)) {
            if (!cancellationToken.isCancellationRequested) {
                // If it failed but we didn't cancel it, handle the common reasons.
                await this.handleFailedProcess(this.languageServerProcess);
            }
            this.languageServerProcess.dispose();
            this.languageServerProcess = undefined;
            return;
        }

        // If we got good session details from the server, try to connect to it.
        this.languageClient = await this.startLanguageClient(this.sessionDetails);

        if (this.languageClient.isRunning()) {
            this.versionDetails = await this.getVersionDetails();
            if (this.versionDetails === undefined) {
                void this.setSessionFailedOpenBug("Unable to get version details!");
                return;
            }

            this.logger.write(`Started PowerShell v${this.versionDetails.version}.`);
            this.setSessionRunningStatus(); // Yay, we made it!

            await this.writePidIfInDevMode(this.languageServerProcess);

            // Fire and forget the updater.
            const updater = new UpdatePowerShell(this.sessionSettings, this.logger, this.versionDetails);
            void updater.checkForUpdate();
        } else {
            void this.setSessionFailedOpenBug("Never finished startup!");
        }
    }

    private async stop(): Promise<void> {
        this.setSessionStatus("Stopping...", SessionStatus.Stopping);
        // Cancel start-up if we're still waiting.
        this.startCancellationTokenSource?.cancel();

        // Stop and dispose the language client.
        try {
            // If the stop fails, so will the dispose, I think this is a bug in
            // the client library.
            await this.languageClient?.stop(3000);
            await this.languageClient?.dispose();
        } catch (err) {
            this.logger.writeError(`Error occurred while stopping language client:\n${err}`);
        }

        this.languageClient = undefined;

        // Stop and dispose the PowerShell process(es).
        this.debugSessionProcess?.dispose();
        this.debugSessionProcess = undefined;
        this.debugEventHandler?.dispose();
        this.debugEventHandler = undefined;

        this.languageServerProcess?.dispose();
        this.languageServerProcess = undefined;

        // Clean up state to start again.
        this.startCancellationTokenSource?.dispose();
        this.startCancellationTokenSource = undefined;
        this.sessionDetails = undefined;
        this.traceLogLevelHandler?.dispose();
        this.traceLogLevelHandler = undefined;

        this.setSessionStatus("Not Started", SessionStatus.NotStarted);
    }

    private async restartSession(exeNameOverride?: string): Promise<void> {
        this.logger.write("Restarting session...");
        await this.stop();

        // Re-load the settings.
        this.sessionSettings = getSettings();

        if (exeNameOverride) {
            // Reset the version and PowerShell details since we're launching a
            // new executable.
            this.logger.writeDebug(`Starting with executable overriden to: ${exeNameOverride}`);
            this.sessionSettings.powerShellDefaultVersion = exeNameOverride;
            this.versionDetails = undefined;
            this.PowerShellExeDetails = undefined;
        }

        await this.start();
    }

    /** In Development mode, write the PID to a file where the parent session can find it, to attach the dotnet debugger. */
    private async writePidIfInDevMode(pwshProcess: PowerShellProcess): Promise<void> {
        if (this.extensionContext.extensionMode !== vscode.ExtensionMode.Development) { return; }
        const parentSessionId = process.env.VSCODE_PARENT_SESSION_ID;
        const pidFilePath = vscode.Uri.joinPath(this.sessionsFolder, `PSES-${parentSessionId}.pid`);

        if (parentSessionId === undefined) { return; }

        const fs = vscode.workspace.fs;
        const pid = (await pwshProcess.getPid())!.toString();
        await fs.writeFile(pidFilePath, Buffer.from(pid));
        const deletePidOnExit = pwshProcess.onExited(() => {
            deletePidOnExit.dispose();
            fs.delete(pidFilePath, {useTrash: false});
            console.log(`Deleted PID file: ${pidFilePath}`);
        });
        this.registeredCommands.push(deletePidOnExit);
        this.extensionContext.subscriptions.push(deletePidOnExit);
    }

    public getSessionDetails(): IEditorServicesSessionDetails | undefined {
        // This is used by the debugger which should have already called `start`.
        if (this.sessionDetails === undefined) {
            void this.logger.writeAndShowError("PowerShell session unavailable for debugging!");
        }
        return this.sessionDetails;
    }

    public async getLanguageServerPid(): Promise<number | undefined> {
        if (this.languageServerProcess === undefined) {
            void this.logger.writeAndShowError("PowerShell Extension Terminal unavailable!");
        }
        return this.languageServerProcess?.getPid();
    }

    public getPowerShellVersionDetails(): IPowerShellVersionDetails | undefined {
        return this.versionDetails;
    }

    private getNewSessionFilePath(): vscode.Uri {
        const uniqueId: number = Math.floor(100000 + Math.random() * 900000);
        return vscode.Uri.joinPath(this.sessionsFolder, `PSES-VSCode-${process.env.VSCODE_PID}-${uniqueId}.json`);
    }

    public setLanguageClientConsumers(languageClientConsumers: LanguageClientConsumer[]): void {
        this.languageClientConsumers = languageClientConsumers;
    }

    public async createDebugSessionProcess(settings: Settings): Promise<PowerShellProcess> {
        // NOTE: We only support one temporary Extension Terminal at a time. To
        // support more, we need to track each separately, and tie the session
        // for the event handler to the right process (and dispose of the event
        // handler when the process is disposed).
        this.debugSessionProcess?.dispose();
        this.debugEventHandler?.dispose();
        if (this.PowerShellExeDetails === undefined) {
            return Promise.reject(new Error("Required PowerShellExeDetails undefined!"));
        }

        // TODO: It might not be totally necessary to update the session
        // settings here, but I don't want to accidentally change this behavior
        // just yet. Working on getting things to be more idempotent!
        this.sessionSettings = settings;

        const bundledModulesPath = await this.getBundledModulesPath();
        this.debugSessionProcess =
            new PowerShellProcess(
                this.PowerShellExeDetails.exePath,
                bundledModulesPath,
                true,
                false,
                this.logger,
                this.extensionContext.logUri,
                this.getEditorServicesArgs(bundledModulesPath, this.PowerShellExeDetails) + "-DebugServiceOnly ",
                this.getNewSessionFilePath(),
                this.sessionSettings);

        // Similar to the regular Extension Terminal, we need to send a key
        // press to the process spawned for temporary Extension Terminals when
        // the server requests a cancellation os Console.ReadKey.
        this.debugEventHandler = vscode.debug.onDidReceiveDebugSessionCustomEvent(
            e => {
                if (e.event === "powerShell/sendKeyPress") {
                    this.debugSessionProcess?.sendKeyPress();
                }
            }
        );

        return this.debugSessionProcess;
    }

    public async waitUntilStarted(): Promise<void> {
        while (this.sessionStatus !== SessionStatus.Running) {
            await utils.sleep(300);
        }
    }

    // TODO: Is this used by the magic of "Middleware" in the client library?
    public resolveCodeLens(
        codeLens: vscode.CodeLens,
        token: vscode.CancellationToken,
        next: ResolveCodeLensSignature): vscode.ProviderResult<vscode.CodeLens> {
        const resolvedCodeLens = next(codeLens, token);
        const resolveFunc =
            (codeLensToFix: vscode.CodeLens): vscode.CodeLens => {
                if (codeLensToFix.command?.command === "editor.action.showReferences") {
                    const oldArgs = codeLensToFix.command.arguments;
                    if (oldArgs === undefined || oldArgs.length < 3) {
                        this.logger.writeError("Code Lens arguments were malformed!");
                        return codeLensToFix;
                    }

                    // Our JSON objects don't get handled correctly by
                    // VS Code's built in editor.action.showReferences
                    // command so we need to convert them into the
                    // appropriate types to send them as command
                    // arguments.

                    codeLensToFix.command.arguments = [
                        vscode.Uri.parse(oldArgs[0]),
                        new vscode.Position(oldArgs[1].line, oldArgs[1].character),
                        oldArgs[2].map((position: {
                            uri: string;
                            range: {
                                start: { line: number; character: number; };
                                end: { line: number; character: number; };
                            };
                        }) => {
                            return new vscode.Location(
                                vscode.Uri.parse(position.uri),
                                new vscode.Range(
                                    position.range.start.line,
                                    position.range.start.character,
                                    position.range.end.line,
                                    position.range.end.character));
                        }),
                    ];
                }

                return codeLensToFix;
            };

        // TODO: This makes zero sense, but appears to be "working" and copied by others per https://github.com/microsoft/vscode-languageserver-node/issues/495. Thing is, ESLint says these conditionals are always truthy.
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if ((resolvedCodeLens as Thenable<vscode.CodeLens>).then) {
            return (resolvedCodeLens as Thenable<vscode.CodeLens>).then(resolveFunc);
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        } else if (resolvedCodeLens as vscode.CodeLens) {
            return resolveFunc(resolvedCodeLens as vscode.CodeLens);
        }

        return resolvedCodeLens;
    }

    // TODO: Remove this migration code. Move old setting
    // codeFormatting.whitespaceAroundPipe to new setting
    // codeFormatting.addWhitespaceAroundPipe.
    private async migrateWhitespaceAroundPipeSetting(): Promise<void> {
        const configuration = vscode.workspace.getConfiguration(utils.PowerShellLanguageId);
        const deprecatedSetting = "codeFormatting.whitespaceAroundPipe";
        const newSetting = "codeFormatting.addWhitespaceAroundPipe";
        const configurationTargetOfNewSetting = getEffectiveConfigurationTarget(newSetting);
        const configurationTargetOfOldSetting = getEffectiveConfigurationTarget(deprecatedSetting);
        if (configurationTargetOfOldSetting !== undefined && configurationTargetOfNewSetting === undefined) {
            this.logger.writeWarning("Deprecated setting: whitespaceAroundPipe");
            const value = configuration.get(deprecatedSetting, configurationTargetOfOldSetting);
            await changeSetting(newSetting, value, configurationTargetOfOldSetting, this.logger);
            await changeSetting(deprecatedSetting, undefined, configurationTargetOfOldSetting, this.logger);
        }
    }

    /** There are some changes we cannot "hot" set, so these require a restart of the session */
    private async restartOnCriticalConfigChange(changeEvent: vscode.ConfigurationChangeEvent): Promise<void> {
        if (this.suppressRestartPrompt) {return;}
        if (this.sessionStatus !== SessionStatus.Running) {return;}

        // Restart not needed if shell integration is enabled but the shell is backgrounded.
        const settings = getSettings();
        if (changeEvent.affectsConfiguration("terminal.integrated.shellIntegration.enabled")) {
            const shellIntegrationEnabled = vscode.workspace.getConfiguration("terminal.integrated.shellIntegration").get<boolean>("enabled") ?? false;
            if (shellIntegrationEnabled && !settings.integratedConsole.startInBackground) {
                return this.restartWithPrompt();
            }
        }

        // Early return if the change doesn't affect the PowerShell extension settings from this point forward
        if (!changeEvent.affectsConfiguration("powershell")) {return;}


        // Detect any setting changes that would affect the session.
        const coldRestartSettingNames = [
            "developer.traceLsp",
            "developer.traceDap",
            "developer.editorServicesLogLevel",
        ];
        for (const settingName of coldRestartSettingNames) {
            if (changeEvent.affectsConfiguration("powershell" + "." + settingName)) {
                return this.restartWithPrompt();
            }
        }

        // TODO: Migrate these to affectsConfiguration style above
        if (settings.cwd !== this.sessionSettings.cwd
            || settings.powerShellDefaultVersion !== this.sessionSettings.powerShellDefaultVersion
            || settings.developer.bundledModulesPath !== this.sessionSettings.developer.bundledModulesPath
            || settings.developer.editorServicesWaitForDebugger !== this.sessionSettings.developer.editorServicesWaitForDebugger
            || settings.developer.setExecutionPolicy !== this.sessionSettings.developer.setExecutionPolicy
            || settings.integratedConsole.useLegacyReadLine !== this.sessionSettings.integratedConsole.useLegacyReadLine
            || settings.integratedConsole.startInBackground !== this.sessionSettings.integratedConsole.startInBackground
            || settings.integratedConsole.startLocation !== this.sessionSettings.integratedConsole.startLocation
        ) {
            return this.restartWithPrompt();
        }
    }

    private async restartWithPrompt(): Promise<void> {
        this.logger.writeDebug("Settings changed, prompting to restart...");
        const response = await vscode.window.showInformationMessage(
            "The PowerShell runtime configuration has changed, would you like to start a new session?",
            "Yes", "No");

        if (response === "Yes") {
            await this.restartSession();
        }
    }

    private registerCommands(): void {
        this.registeredCommands = [
            vscode.commands.registerCommand("PowerShell.RestartSession", async () => { await this.restartSession(); }),
            vscode.commands.registerCommand(this.ShowSessionMenuCommandName, async () => { await this.showSessionMenu(); }),
            vscode.workspace.onDidChangeConfiguration((e) => this.restartOnCriticalConfigChange(e)),
            vscode.commands.registerCommand(
                "PowerShell.ShowSessionConsole", (isExecute?: boolean) => { this.showSessionTerminal(isExecute); })
        ];
    }

    private async findPowerShell(): Promise<IPowerShellExeDetails | undefined> {
        this.logger.writeDebug("Finding PowerShell...");
        const powershellExeFinder = new PowerShellExeFinder(
            this.platformDetails,
            this.sessionSettings.powerShellAdditionalExePaths,
            this.logger);

        let foundPowerShell: IPowerShellExeDetails | undefined;
        try {
            let defaultPowerShell: IPowerShellExeDetails | undefined;
            const wantedName = this.sessionSettings.powerShellDefaultVersion;
            if (wantedName !== "") {
                for await (const details of powershellExeFinder.enumeratePowerShellInstallations()) {
                    // Need to compare names case-insensitively, from https://stackoverflow.com/a/2140723
                    if (wantedName.localeCompare(details.displayName, undefined, { sensitivity: "accent" }) === 0) {
                        defaultPowerShell = details;
                        break;
                    }
                }
            }
            foundPowerShell = defaultPowerShell ?? await powershellExeFinder.getFirstAvailablePowerShellInstallation();
            if (wantedName !== "" && defaultPowerShell === undefined && foundPowerShell !== undefined) {
                void this.logger.writeAndShowWarning(`The 'powerShellDefaultVersion' setting was '${wantedName}' but this was not found!`
                    + ` Instead using first available installation '${foundPowerShell.displayName}' at '${foundPowerShell.exePath}'!`);
            }
        } catch (err) {
            this.logger.writeError(`Error occurred while searching for a PowerShell executable:\n${err}`);
        }

        return foundPowerShell;
    }

    private async startLanguageServerProcess(
        powerShellExeDetails: IPowerShellExeDetails,
        cancellationToken: vscode.CancellationToken): Promise<PowerShellProcess> {

        const bundledModulesPath = await this.getBundledModulesPath();

        // Dispose any stale terminals from previous killed sessions.
        PowerShellProcess.cleanUpTerminals();
        const languageServerProcess =
            new PowerShellProcess(
                powerShellExeDetails.exePath,
                bundledModulesPath,
                false,
                this.shellIntegrationEnabled,
                this.logger,
                this.extensionContext.logUri,
                this.getEditorServicesArgs(bundledModulesPath, powerShellExeDetails),
                this.getNewSessionFilePath(),
                this.sessionSettings,
                this.extensionContext.extensionMode == vscode.ExtensionMode.Development);

        languageServerProcess.onExited(
            () => {
                LanguageClientConsumer.onLanguageClientExited();

                if (this.sessionStatus === SessionStatus.Running
                    || this.sessionStatus === SessionStatus.Busy) {
                    this.setSessionStatus("Session Exited!", SessionStatus.Failed);
                    void this.promptForRestart();
                }
            });

        this.sessionDetails = await languageServerProcess.start(cancellationToken);

        return languageServerProcess;
    }

    // The process failed to start, so check for common user errors (generally
    // out-of-support versions of PowerShell).
    private async handleFailedProcess(powerShellProcess: PowerShellProcess): Promise<void> {
        const version = await powerShellProcess.getVersionCli();
        let shouldUpdate = true;

        if (satisfies(version, "<5.1.0")) {
            void this.setSessionFailedGetPowerShell(`PowerShell v${version} is not supported, please update!`);
        } else if (satisfies(version, ">=5.1.0 <6.0.0")) {
            void this.setSessionFailedGetPowerShell("It looks like you're trying to use Windows PowerShell, which is supported on a best-effort basis. Can you try PowerShell 7?");
        } else if (satisfies(version, ">=6.0.0 <7.4.0")) {
            void this.setSessionFailedGetPowerShell(`PowerShell v${version} has reached end-of-support, please update!`);
        } else {
            shouldUpdate = false;
            void this.setSessionFailedOpenBug("PowerShell Language Server process didn't start!");
        }

        if (shouldUpdate) {
            // Run the update notifier since it won't run later as we failed
            // to start, but we have enough details to do so now.
            const versionDetails: IPowerShellVersionDetails = {
                "version": version,
                "edition": "", // Unused by UpdatePowerShell
                "commit": version, // Actually used by UpdatePowerShell
                "architecture": process.arch // Best guess based off Code's architecture
            };
            const updater = new UpdatePowerShell(this.sessionSettings, this.logger, versionDetails);
            void updater.checkForUpdate();
        }
    }

    private sessionStarted(sessionDetails: IEditorServicesSessionDetails): boolean {
        this.logger.writeDebug(`Session details: ${JSON.stringify(sessionDetails, undefined, 2)}`);
        if (sessionDetails.status === "started") { // Successful server start with a session file
            return true;
        }
        if (sessionDetails.status === "failed") { // Server started but indicated it failed
            if (sessionDetails.reason === "powerShellVersion") {
                void this.setSessionFailedGetPowerShell(`PowerShell ${sessionDetails.powerShellVersion} is not supported, please update!`);
            } else if (sessionDetails.reason === "dotNetVersion") { // Only applies to PowerShell 5.1
                void this.setSessionFailedGetDotNet(".NET Framework is out-of-date, please install at least 4.8!");
            } else {
                void this.setSessionFailedOpenBug(`PowerShell could not be started for an unknown reason: ${sessionDetails.reason}`);
            }
        } else {
            void this.setSessionFailedOpenBug(`PowerShell could not be started with an unknown status: ${sessionDetails.status}, and reason: ${sessionDetails.reason}`);
        }
        return false;
    }

    private async startLanguageClient(sessionDetails: IEditorServicesSessionDetails): Promise<LanguageClient> {
        this.logger.writeDebug("Connecting to language service...");
        const connectFunc = (): Promise<StreamInfo> => {
            return new Promise<StreamInfo>(
                (resolve, _reject) => {
                    const socket = net.connect(sessionDetails.languageServicePipeName);
                    socket.on(
                        "connect",
                        () => {
                            this.logger.writeDebug("Language service connected.");
                            resolve({ writer: socket, reader: socket });
                        });
                });
        };

        const clientOptions: LanguageClientOptions = {
            documentSelector: this.documentSelector,
            synchronize: {
                // TODO: This is deprecated and they should be pulled by the server.
                // backend uses "files" and "search" to ignore references.
                configurationSection: [utils.PowerShellLanguageId, "files", "search"],
                // TODO: fileEvents: vscode.workspace.createFileSystemWatcher('**/.eslintrc')
            },
            // NOTE: Some settings are only applicable on startup, so we send them during initialization.
            // When Terminal Shell Integration is enabled, we pass the path to the script that the server should execute.
            // Passing an empty string implies integration is disabled.
            initializationOptions: {
                enableProfileLoading: this.sessionSettings.enableProfileLoading,
                initialWorkingDirectory: await validateCwdSetting(this.logger),
                shellIntegrationScript: this.shellIntegrationEnabled
                    ? utils.ShellIntegrationScript : "",
            },
            errorHandler: {
                // Override the default error handler to prevent it from
                // closing the LanguageClient incorrectly when the socket
                // hangs up (ECONNRESET errors).
                error: (_error: Error, _message: Message, _count: number): ErrorHandlerResult => {
                    // TODO: Is there any error worth terminating on?
                    this.logger.writeError(`${_error.name}: ${_error.message} ${_error.cause}`);
                    return { action: ErrorAction.Continue };
                },
                closed: (): CloseHandlerResult => {
                    this.logger.write("Language service connection closed.");
                    // We have our own restart experience
                    return {
                        action: CloseAction.DoNotRestart,
                        message: "Connection to PowerShell Editor Services (the Extension Terminal) was closed. See below prompt to restart!"
                    };
                },
            },
            middleware: this,
            traceOutputChannel: new LanguageClientOutputChannelAdapter("PowerShell: Trace LSP", LspTraceParser),
            // This is named the same as the Client log to merge the logs, but will be handled and disposed separately.
            outputChannel: new LanguageClientOutputChannelAdapter("PowerShell", PsesParser),
            revealOutputChannelOn: RevealOutputChannelOn.Never
        };

        const languageClient = new LanguageClient("powershell", "PowerShell Editor Services Client", connectFunc, clientOptions);

        // This enables handling Semantic Highlighting messages in PowerShell Editor Services
        // TODO: We should only turn this on in preview.
        languageClient.registerProposedFeatures();

        // NOTE: We don't currently send any events from PSES, but may again in
        // the future so we're leaving this side wired up.
        languageClient.onTelemetry((event) => {
            const eventName: string = event.eventName ? event.eventName : "PSESEvent";
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const data: any = event.data ? event.data : event;
            this.sendTelemetryEvent(eventName, data);
        });

        // Send the new LanguageClient to extension features
        // so that they can register their message handlers
        // before the connection is established.
        for (const consumer of this.languageClientConsumers) {
            consumer.onLanguageClientSet(languageClient);
        }

        this.registeredHandlers = [
            // NOTE: This fixes a quirk where PSES has a thread stuck on
            // Console.ReadKey, since it's not cancellable. On
            // "cancellation" the server asks us to send pretend to
            // press a key, thus mitigating all the quirk.
            languageClient.onNotification(
                SendKeyPressNotificationType,
                () => { this.languageServerProcess?.sendKeyPress(); }),

            languageClient.onNotification(
                ExecutionBusyStatusNotificationType,
                (isBusy: boolean) => {
                    if (isBusy) { this.setSessionBusyStatus(); }
                    else { this.setSessionRunningStatus(); }
                }
            ),
        ];

        try {
            await languageClient.start();
            LanguageClientConsumer.onLanguageClientStarted(languageClient);
        } catch (err) {
            void this.setSessionFailedOpenBug("Language client failed to start: " + (err instanceof Error ? err.message : "unknown"));
        }

        return languageClient;
    }

    private async getBundledModulesPath(): Promise<string> {
        // Because the extension is always at `<root>/out/main.js`
        let bundledModulesPath = path.resolve(__dirname, "../modules");

        if (this.extensionContext.extensionMode === vscode.ExtensionMode.Development) {
            const devBundledModulesPath = path.resolve(__dirname, this.sessionSettings.developer.bundledModulesPath);

            // Make sure the module's bin path exists
            if (await utils.checkIfDirectoryExists(devBundledModulesPath)) {
                bundledModulesPath = devBundledModulesPath;
            } else {
                void this.logger.writeAndShowWarning(
                    "In development mode but PowerShellEditorServices dev module path cannot be " +
                    `found (or has not been built yet): ${devBundledModulesPath}\n`);
            }
        }

        return bundledModulesPath;
    }

    private getEditorServicesArgs(bundledModulesPath: string, powerShellExeDetails: IPowerShellExeDetails): string {
        let editorServicesArgs =
            "-HostName 'Visual Studio Code Host' " +
            "-HostProfileId 'Microsoft.VSCode' " +
            `-HostVersion '${this.HostVersion}' ` +
            `-BundledModulesPath '${utils.escapeSingleQuotes(bundledModulesPath)}' ` +
            "-EnableConsoleRepl ";

        if (this.sessionSettings.integratedConsole.suppressStartupBanner) {
            editorServicesArgs += "-StartupBanner '' ";
        } else if (utils.isWindows && !powerShellExeDetails.supportsProperArguments) {
            // NOTE: On Windows we don't Base64 encode the startup command
            // because it annoys some poorly implemented anti-virus scanners.
            // Unfortunately this means that for some installs of PowerShell
            // (such as through the `dotnet` package manager), we can't include
            // a multi-line startup banner as the quotes break the command.
            editorServicesArgs += `-StartupBanner '${this.DisplayName} Extension v${this.HostVersion}' `;
        } else {
            const startupBanner = `${this.DisplayName} Extension v${this.HostVersion}
Copyright (c) Microsoft Corporation.

https://aka.ms/vscode-powershell
Type 'help' to get help.
`;
            editorServicesArgs += `-StartupBanner "${startupBanner}" `;
        }

        // We guard this here too out of an abundance of precaution.
        if (this.sessionSettings.developer.editorServicesWaitForDebugger
            && this.extensionContext.extensionMode === vscode.ExtensionMode.Development) {
            editorServicesArgs += "-WaitForDebugger ";
        }
        const logLevel = vscode.workspace.getConfiguration("powershell.developer").get<string>("editorServicesLogLevel");
        editorServicesArgs += `-LogLevel '${logLevel}' `;

        return editorServicesArgs;
    }

    private async getVersionDetails(): Promise<IPowerShellVersionDetails | undefined> {
        // Take one minute to get version details, otherwise cancel and fail.
        const timeout = new vscode.CancellationTokenSource();
        setTimeout(() => { timeout.cancel(); }, 60 * 1000);

        const versionDetails = await this.languageClient?.sendRequest(
            PowerShellVersionRequestType, timeout.token);

        // This is pretty much the only telemetry event we care about.
        // TODO: We actually could send this earlier from PSES itself.
        this.sendTelemetryEvent("powershellVersionCheck",
            { powershellVersion: versionDetails?.version ?? "unknown" });

        return versionDetails;
    }

    private async promptForRestart(): Promise<void> {
        await this.logger.writeAndShowErrorWithActions(
            "The PowerShell Extension Terminal has stopped, would you like to restart it? IntelliSense and other features will not work without it!",
            [
                {
                    prompt: "Yes",
                    action: async (): Promise<void> => { await this.restartSession(); }
                },
                {
                    prompt: "No",
                    action: undefined
                }
            ]
        );
    }

    private sendTelemetryEvent(
        eventName: string,
        properties?: TelemetryEventProperties,
        measures?: TelemetryEventMeasurements): void {

        if (this.extensionContext.extensionMode === vscode.ExtensionMode.Production) {
            this.telemetryReporter.sendTelemetryEvent(eventName, properties, measures);
        }
    }

    private createStatusBarItem(): vscode.LanguageStatusItem {
        const statusTitle = "Show PowerShell Session Menu";
        const languageStatusItem = vscode.languages.createLanguageStatusItem("powershell", this.documentSelector);
        languageStatusItem.command = { title: statusTitle, command: this.ShowSessionMenuCommandName };
        languageStatusItem.text = "$(terminal-powershell)";
        languageStatusItem.detail = "PowerShell";
        return languageStatusItem;
    }

    private async waitWhileStarting(): Promise<void> {
        while (this.sessionStatus === SessionStatus.Starting) {
            if (this.startCancellationTokenSource?.token.isCancellationRequested) {
                return;
            }
            await utils.sleep(300);
        }
    }

    private async waitWhileStopping(): Promise<void> {
        while (this.sessionStatus === SessionStatus.Stopping) {
            await utils.sleep(300);
        }
    }

    private setSessionStatus(detail: string, status: SessionStatus): void {
        this.logger.writeDebug(`Session status changing from '${this.sessionStatus}' to '${status}'.`);
        this.sessionStatus = status;
        this.languageStatusItem.text = "$(terminal-powershell)";
        this.languageStatusItem.detail = "PowerShell";

        if (this.versionDetails !== undefined) {
            const semver = new SemVer(this.versionDetails.version);
            this.languageStatusItem.text += ` ${semver.major}.${semver.minor}`;
            this.languageStatusItem.detail += ` ${this.versionDetails.commit} (${this.versionDetails.architecture.toLowerCase()})`;
        } else if (this.PowerShellExeDetails?.displayName) { // When it hasn't started yet.
            this.languageStatusItem.text += ` ${this.PowerShellExeDetails.displayName}`;
            this.languageStatusItem.detail += ` at '${this.PowerShellExeDetails.exePath}'`;
        } else if (this.sessionSettings.powerShellDefaultVersion) { // When it hasn't been found yet.
            this.languageStatusItem.text += ` ${this.sessionSettings.powerShellDefaultVersion}`;
            this.languageStatusItem.detail = `Looking for '${this.sessionSettings.powerShellDefaultVersion}'...`;
        }

        if (detail) {
            this.languageStatusItem.detail += ": " + detail;
        }

        switch (status) {
        case SessionStatus.Running:
        case SessionStatus.NotStarted:
            this.languageStatusItem.busy = false;
            this.languageStatusItem.severity = vscode.LanguageStatusSeverity.Information;
            break;
        case SessionStatus.Busy:
            this.languageStatusItem.busy = true;
            this.languageStatusItem.severity = vscode.LanguageStatusSeverity.Information;
            break;
        case SessionStatus.Starting:
        case SessionStatus.Stopping:
            this.languageStatusItem.busy = true;
            this.languageStatusItem.severity = vscode.LanguageStatusSeverity.Warning;
            break;
        case SessionStatus.Failed:
            this.languageStatusItem.busy = false;
            this.languageStatusItem.severity = vscode.LanguageStatusSeverity.Error;
            break;
        }
    }

    // Refreshes the Language Status Item details with ehe same status.
    private refreshSessionStatus(): void {
        this.setSessionStatus("", this.sessionStatus);
    }

    private setSessionRunningStatus(): void {
        this.setSessionStatus("", SessionStatus.Running);
    }

    private setSessionBusyStatus(): void {
        this.setSessionStatus("Executing...", SessionStatus.Busy);
    }

    private async setSessionFailedOpenBug(message: string): Promise<void> {
        this.setSessionStatus("Startup Error!", SessionStatus.Failed);
        await this.logger.writeAndShowErrorWithActions(message, [{
            prompt: "Open an Issue",
            action: async (): Promise<void> => {
                await vscode.commands.executeCommand("PowerShell.GenerateBugReport");
            }
        }]
        );
    }

    private async setSessionFailedGetPowerShell(message: string): Promise<void> {
        this.setSessionStatus("Startup Error!", SessionStatus.Failed);
        await this.logger.writeAndShowErrorWithActions(message, [{
            prompt: "Open PowerShell Install Documentation",
            action: async (): Promise<void> => {
                await vscode.env.openExternal(
                    vscode.Uri.parse("https://aka.ms/get-powershell-vscode"));
            }
        }]
        );
    }

    private async setSessionFailedGetDotNet(message: string): Promise<void> {
        this.setSessionStatus("Startup Error!", SessionStatus.Failed);
        await this.logger.writeAndShowErrorWithActions(message, [{
            prompt: "Open .NET Framework Documentation",
            action: async (): Promise<void> => {
                await vscode.env.openExternal(
                    vscode.Uri.parse("https://dotnet.microsoft.com/en-us/download/dotnet-framework"));
            }
        }]
        );
    }

    private async changePowerShellDefaultVersion(exePath: IPowerShellExeDetails): Promise<void> {
        this.suppressRestartPrompt = true;
        try {
            await changeSetting("powerShellDefaultVersion", exePath.displayName, true, this.logger);
        } finally {
            this.suppressRestartPrompt = false;
        }

        // We pass in the display name so that we force the extension to use that version
        // rather than pull from the settings. The issue we prevent here is when a
        // workspace setting is defined which gets priority over user settings which
        // is what the change above sets.
        await this.restartSession(exePath.displayName);
    }

    // Shows the temp debug terminal if it exists, otherwise the session terminal.
    public showDebugTerminal(isExecute?: boolean): void {
        if (this.debugSessionProcess) {
            this.debugSessionProcess.showTerminal(isExecute && !this.sessionSettings.integratedConsole.focusConsoleOnExecute);
        } else {
            this.languageServerProcess?.showTerminal(isExecute && !this.sessionSettings.integratedConsole.focusConsoleOnExecute);
        }
    }

    // Always shows the session terminal.
    private showSessionTerminal(isExecute?: boolean): void {
        this.languageServerProcess?.showTerminal(isExecute && !this.sessionSettings.integratedConsole.focusConsoleOnExecute);
    }

    private async showSessionMenu(): Promise<void> {
        const powershellExeFinder = new PowerShellExeFinder(
            this.platformDetails,
            // We don't pull from session settings because we want them fresh!
            getSettings().powerShellAdditionalExePaths,
            this.logger);
        const availablePowerShellExes = await powershellExeFinder.getAllAvailablePowerShellInstallations();

        const powerShellItems = availablePowerShellExes
            .filter((item) => item.displayName !== this.PowerShellExeDetails?.displayName)
            .map((item) => {
                return new SessionMenuItem(
                    `Switch to: ${item.displayName}`,
                    async () => { await this.changePowerShellDefaultVersion(item); });
            });

        const menuItems: SessionMenuItem[] = [
            new SessionMenuItem(
                `Current session: ${this.PowerShellExeDetails?.displayName ?? "Unknown"} (click to show logs)`,
                async () => { await vscode.commands.executeCommand("PowerShell.ShowLogs"); }),

            // Add all of the different PowerShell options
            ...powerShellItems,

            new SessionMenuItem(
                "Restart current session",
                async () => {
                    // We pass in the display name so we guarantee that the session
                    // will be the same PowerShell.
                    if (this.PowerShellExeDetails) {
                        await this.restartSession(this.PowerShellExeDetails.displayName);
                    } else {
                        await this.restartSession();
                    }
                }),

            new SessionMenuItem(
                "Open session logs folder",
                async () => { await vscode.commands.executeCommand("PowerShell.OpenLogFolder"); }),

            new SessionMenuItem(
                "Modify list of additional PowerShell locations",
                async () => { await vscode.commands.executeCommand("workbench.action.openSettings", "powerShellAdditionalExePaths"); }),
        ];

        const selectedItem = await vscode.window.showQuickPick<SessionMenuItem>(menuItems);
        await selectedItem?.callback();
    }
}

class SessionMenuItem implements vscode.QuickPickItem {
    public description: string | undefined;

    constructor(
        public readonly label: string,
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        public readonly callback = async (): Promise<void> => { }) {
    }
}
