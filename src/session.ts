// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

"use strict";

import net = require("net");
import path = require("path");
import * as semver from "semver";
import vscode = require("vscode");
import TelemetryReporter, { TelemetryEventProperties, TelemetryEventMeasurements } from "@vscode/extension-telemetry";
import { Message } from "vscode-jsonrpc";
import { Logger } from "./logging";
import { PowerShellProcess } from "./process";
import Settings = require("./settings");
import utils = require("./utils");

import {
    CloseAction, CloseHandlerResult, DocumentSelector, ErrorAction, ErrorHandlerResult,
    LanguageClientOptions, Middleware, NotificationType,
    RequestType0, ResolveCodeLensSignature, RevealOutputChannelOn
} from "vscode-languageclient";
import { LanguageClient, StreamInfo } from "vscode-languageclient/node";

import { GitHubReleaseInformation, InvokePowerShellUpdateCheck } from "./features/UpdatePowerShell";
import {
    getPlatformDetails, IPlatformDetails, IPowerShellExeDetails,
    OperatingSystem, PowerShellExeFinder
} from "./platform";
import { LanguageClientConsumer } from "./languageClientConsumer";

export enum SessionStatus {
    NeverStarted,
    NotStarted,
    Initializing,
    Running,
    Stopping,
    Failed,
}

export enum RunspaceType {
    Local,
    Process,
    Remote,
}
export interface IEditorServicesSessionDetails {
    status: string;
    reason: string;
    detail: string;
    powerShellVersion: string;
    channel: string;
    languageServicePort: number;
    debugServicePort: number;
    languageServicePipeName: string;
    debugServicePipeName: string;
}

export interface IPowerShellVersionDetails {
    version: string;
    displayVersion: string;
    edition: string;
    architecture: string;
}

export interface IRunspaceDetails {
    powerShellVersion: IPowerShellVersionDetails;
    runspaceType: RunspaceType;
    connectionString: string;
}

export type IReadSessionFileCallback = (details: IEditorServicesSessionDetails) => void;

export const SendKeyPressNotificationType =
    new NotificationType<void>("powerShell/sendKeyPress");

export const PowerShellVersionRequestType =
    new RequestType0<IPowerShellVersionDetails, void>(
        "powerShell/getVersion");

export const RunspaceChangedEventType =
    new NotificationType<IRunspaceDetails>(
        "powerShell/runspaceChanged");

export class SessionManager implements Middleware {
    public HostName: string;
    public HostVersion: string;
    public PowerShellExeDetails: IPowerShellExeDetails;
    private ShowSessionMenuCommandName = "PowerShell.ShowSessionMenu";
    private editorServicesArgs: string;
    private sessionStatus: SessionStatus = SessionStatus.NeverStarted;
    private suppressRestartPrompt: boolean;
    private focusConsoleOnExecute: boolean;
    private platformDetails: IPlatformDetails;
    private languageClientConsumers: LanguageClientConsumer[] = [];
    private languageStatusItem: vscode.LanguageStatusItem;
    private languageServerProcess: PowerShellProcess;
    private debugSessionProcess: PowerShellProcess;
    private debugEventHandler: vscode.Disposable;
    private versionDetails: IPowerShellVersionDetails;
    private registeredHandlers: vscode.Disposable[] = [];
    private registeredCommands: vscode.Disposable[] = [];
    private languageClient: LanguageClient = undefined;
    private sessionSettings: Settings.ISettings = undefined;
    private sessionDetails: IEditorServicesSessionDetails;
    private sessionsFolder: vscode.Uri;
    private bundledModulesPath: string;
    private started: boolean = false;

    // Initialized by the start() method, since this requires settings
    private powershellExeFinder: PowerShellExeFinder;

    constructor(
        private extensionContext: vscode.ExtensionContext,
        private log: Logger,
        private documentSelector: DocumentSelector,
        hostName: string,
        version: string,
        private telemetryReporter: TelemetryReporter) {

        // Create a folder for the session files.
        this.sessionsFolder = vscode.Uri.joinPath(extensionContext.globalStorageUri, "sessions");
        vscode.workspace.fs.createDirectory(this.sessionsFolder);

        this.platformDetails = getPlatformDetails();

        this.HostName = hostName;
        this.HostVersion = version;

        const osBitness = this.platformDetails.isOS64Bit ? "64-bit" : "32-bit";
        const procBitness = this.platformDetails.isProcess64Bit ? "64-bit" : "32-bit";

        this.log.write(
            `Visual Studio Code v${vscode.version} ${procBitness}`,
            `${this.HostName} Extension v${this.HostVersion}`,
            `Operating System: ${OperatingSystem[this.platformDetails.operatingSystem]} ${osBitness}`);

        // Fix the host version so that PowerShell can consume it.
        // This is needed when the extension uses a prerelease
        // version string like 0.9.1-insiders-1234.
        this.HostVersion = this.HostVersion.split("-")[0];

        this.registerCommands();
    }

    public async dispose(): Promise<void> {
        await this.stop();

        for (const handler of this.registeredHandlers) {
            handler.dispose();
        }

        for (const command of this.registeredCommands) {
            command.dispose();
        }

        this.languageClient.dispose();
    }

    public setLanguageClientConsumers(languageClientConsumers: LanguageClientConsumer[]) {
        this.languageClientConsumers = languageClientConsumers;
    }

    public async start(exeNameOverride?: string) {
        await Settings.validateCwdSetting();
        this.sessionSettings = Settings.load();

        if (exeNameOverride) {
            this.sessionSettings.powerShellDefaultVersion = exeNameOverride;
        }

        await this.log.startNewLog(this.sessionSettings.developer.editorServicesLogLevel);

        // Create the PowerShell executable finder now
        this.powershellExeFinder = new PowerShellExeFinder(
            this.platformDetails,
            this.sessionSettings.powerShellAdditionalExePaths);

        this.focusConsoleOnExecute = this.sessionSettings.integratedConsole.focusConsoleOnExecute;

        this.createStatusBarItem();

        await this.promptPowerShellExeSettingsCleanup();

        await this.migrateWhitespaceAroundPipeSetting();

        try {
            let powerShellExeDetails: IPowerShellExeDetails;
            if (this.sessionSettings.powerShellDefaultVersion) {
                for await (const details of this.powershellExeFinder.enumeratePowerShellInstallations()) {
                    // Need to compare names case-insensitively, from https://stackoverflow.com/a/2140723
                    const wantedName = this.sessionSettings.powerShellDefaultVersion;
                    if (wantedName.localeCompare(details.displayName, undefined, { sensitivity: "accent" }) === 0) {
                        powerShellExeDetails = details;
                        break;
                    }
                }
            }
            this.PowerShellExeDetails = powerShellExeDetails ||
                await this.powershellExeFinder.getFirstAvailablePowerShellInstallation();
        } catch (e) {
            this.log.writeError(`Error occurred while searching for a PowerShell executable:\n${e}`);
        }

        this.suppressRestartPrompt = false;

        if (!this.PowerShellExeDetails) {
            const message = "Unable to find PowerShell."
                + " Do you have PowerShell installed?"
                + " You can also configure custom PowerShell installations"
                + " with the 'powershell.powerShellAdditionalExePaths' setting.";

            await this.log.writeAndShowErrorWithActions(message, [
                {
                    prompt: "Get PowerShell",
                    action: async () => {
                        const getPSUri = vscode.Uri.parse("https://aka.ms/get-powershell-vscode");
                        vscode.env.openExternal(getPSUri);
                    },
                },
            ]);
            return;
        }

        this.bundledModulesPath = path.resolve(__dirname, this.sessionSettings.bundledModulesPath);

        if (this.extensionContext.extensionMode === vscode.ExtensionMode.Development) {
            const devBundledModulesPath = path.resolve(__dirname, this.sessionSettings.developer.bundledModulesPath);

            // Make sure the module's bin path exists
            if (await utils.checkIfDirectoryExists(path.join(devBundledModulesPath, "PowerShellEditorServices/bin"))) {
                this.bundledModulesPath = devBundledModulesPath;
            } else {
                this.log.write(
                    "\nWARNING: In development mode but PowerShellEditorServices dev module path cannot be " +
                    `found (or has not been built yet): ${devBundledModulesPath}\n`);
            }
        }

        this.editorServicesArgs =
            `-HostName 'Visual Studio Code Host' ` +
            `-HostProfileId 'Microsoft.VSCode' ` +
            `-HostVersion '${this.HostVersion}' ` +
            `-AdditionalModules @('PowerShellEditorServices.VSCode') ` +
            `-BundledModulesPath '${PowerShellProcess.escapeSingleQuotes(this.bundledModulesPath)}' ` +
            `-EnableConsoleRepl `;

        if (this.sessionSettings.integratedConsole.suppressStartupBanner) {
            this.editorServicesArgs += "-StartupBanner '' ";
        } else if (utils.isWindows && !this.PowerShellExeDetails.supportsProperArguments) {
            // NOTE: On Windows we don't Base64 encode the startup command
            // because it annoys some poorly implemented anti-virus scanners.
            // Unfortunately this means that for some installs of PowerShell
            // (such as through the `dotnet` package manager), we can't include
            // a multi-line startup banner as the quotes break the command.
            this.editorServicesArgs += `-StartupBanner '${this.HostName} Extension v${this.HostVersion}' `;
        } else {
            const startupBanner = `${this.HostName} Extension v${this.HostVersion}
Copyright (c) Microsoft Corporation.

https://aka.ms/vscode-powershell
Type 'help' to get help.
`;
            this.editorServicesArgs += `-StartupBanner "${startupBanner}" `;
        }

        if (this.sessionSettings.developer.editorServicesWaitForDebugger) {
            this.editorServicesArgs += "-WaitForDebugger ";
        }
        if (this.sessionSettings.developer.editorServicesLogLevel) {
            this.editorServicesArgs += `-LogLevel '${this.sessionSettings.developer.editorServicesLogLevel}' `;
        }

        await this.startPowerShell();
    }

    public async stop() {
        this.log.write("Shutting down language client...");

        if (this.sessionStatus === SessionStatus.Failed) {
            // Before moving further, clear out the client and process if
            // the process is already dead (i.e. it crashed).
            this.languageClient = undefined;
            this.languageServerProcess = undefined;
        }

        this.sessionStatus = SessionStatus.Stopping;

        // Stop the language client.
        if (this.languageClient !== undefined) {
            await this.languageClient.stop();
            this.languageClient = undefined;
        }

        // Kill the PowerShell process(es) we spawned.
        if (this.debugSessionProcess) {
            this.debugSessionProcess.dispose();
            this.debugEventHandler.dispose();
        }
        if (this.languageServerProcess) {
            this.languageServerProcess.dispose();
        }

        this.sessionStatus = SessionStatus.NotStarted;
    }

    public async restartSession(exeNameOverride?: string) {
        await this.stop();
        await this.start(exeNameOverride);
    }

    public getSessionDetails(): IEditorServicesSessionDetails {
        return this.sessionDetails;
    }

    public getSessionStatus(): SessionStatus {
        return this.sessionStatus;
    }

    public getPowerShellVersionDetails(): IPowerShellVersionDetails {
        return this.versionDetails;
    }

    public getNewSessionFilePath(): vscode.Uri {
        const uniqueId: number = Math.floor(100000 + Math.random() * 900000);
        return vscode.Uri.joinPath(this.sessionsFolder, "PSES-VSCode-" + process.env.VSCODE_PID + "-" + uniqueId + ".json");
    }

    public createDebugSessionProcess(sessionSettings: Settings.ISettings): PowerShellProcess {
        // NOTE: We only support one temporary Extension Terminal at a time. To
        // support more, we need to track each separately, and tie the session
        // for the event handler to the right process (and dispose of the event
        // handler when the process is disposed).
        if (this.debugSessionProcess) {
            this.debugSessionProcess.dispose()
            this.debugEventHandler.dispose();
        }

        this.debugSessionProcess =
            new PowerShellProcess(
                this.PowerShellExeDetails.exePath,
                this.bundledModulesPath,
                "[TEMP] PowerShell Extension",
                this.log,
                this.editorServicesArgs + "-DebugServiceOnly ",
                this.getNewSessionFilePath(),
                sessionSettings);

        // Similar to the regular Extension Terminal, we need to send a key
        // press to the process spawned for temporary Extension Terminals when
        // the server requests a cancellation os Console.ReadKey.
        this.debugEventHandler = vscode.debug.onDidReceiveDebugSessionCustomEvent(
            e => {
                if (e.event === "powerShell/sendKeyPress") {
                    this.debugSessionProcess.sendKeyPress();
                }
            }
        );

        return this.debugSessionProcess;
    }

    public async waitUntilStarted(): Promise<void> {
        while (!this.started) {
            await utils.sleep(300);
        }
    }

    public resolveCodeLens(
        codeLens: vscode.CodeLens,
        token: vscode.CancellationToken,
        next: ResolveCodeLensSignature): vscode.ProviderResult<vscode.CodeLens> {
        const resolvedCodeLens = next(codeLens, token);
        const resolveFunc =
            (codeLensToFix: vscode.CodeLens): vscode.CodeLens => {
                if (codeLensToFix.command?.command === "editor.action.showReferences") {
                    const oldArgs = codeLensToFix.command.arguments;

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

        if ((resolvedCodeLens as Thenable<vscode.CodeLens>).then) {
            return (resolvedCodeLens as Thenable<vscode.CodeLens>).then(resolveFunc);
        } else if (resolvedCodeLens as vscode.CodeLens) {
            return resolveFunc(resolvedCodeLens as vscode.CodeLens);
        }

        return resolvedCodeLens;
    }

    // Move old setting codeFormatting.whitespaceAroundPipe to new setting codeFormatting.addWhitespaceAroundPipe
    private async migrateWhitespaceAroundPipeSetting() {
        const configuration = vscode.workspace.getConfiguration(utils.PowerShellLanguageId);
        const deprecatedSetting = 'codeFormatting.whitespaceAroundPipe'
        const newSetting = 'codeFormatting.addWhitespaceAroundPipe'
        const configurationTargetOfNewSetting = await Settings.getEffectiveConfigurationTarget(newSetting);
        const configurationTargetOfOldSetting = await Settings.getEffectiveConfigurationTarget(deprecatedSetting);
        if (configurationTargetOfOldSetting !== null && configurationTargetOfNewSetting === null) {
            const value = configuration.get(deprecatedSetting, configurationTargetOfOldSetting)
            await Settings.change(newSetting, value, configurationTargetOfOldSetting);
            await Settings.change(deprecatedSetting, undefined, configurationTargetOfOldSetting);
        }
    }

    private async promptPowerShellExeSettingsCleanup() {
        if (this.sessionSettings.powerShellExePath) {
            let warningMessage = "The 'powerShell.powerShellExePath' setting is no longer used. ";
            warningMessage += this.sessionSettings.powerShellDefaultVersion
                ? "We can automatically remove it for you."
                : "We can remove it from your settings and prompt you for which PowerShell you want to use.";

            const choice = await vscode.window.showWarningMessage(warningMessage, "Let's do it!");

            if (choice === undefined) {
                // They hit the 'x' to close the dialog.
                return;
            }

            this.suppressRestartPrompt = true;
            try {
                await Settings.change("powerShellExePath", undefined, true);
            } finally {
                this.suppressRestartPrompt = false;
            }

            // Show the session menu at the end if they don't have a PowerShellDefaultVersion.
            if (!this.sessionSettings.powerShellDefaultVersion) {
                await vscode.commands.executeCommand(this.ShowSessionMenuCommandName);
            }
        }
    }

    private async onConfigurationUpdated() {
        const settings = Settings.load();

        this.focusConsoleOnExecute = settings.integratedConsole.focusConsoleOnExecute;

        // Detect any setting changes that would affect the session
        if (!this.suppressRestartPrompt &&
            (settings.cwd?.toLowerCase() !==
                this.sessionSettings.cwd?.toLowerCase() ||
                settings.powerShellDefaultVersion.toLowerCase() !==
                this.sessionSettings.powerShellDefaultVersion.toLowerCase() ||
            settings.developer.editorServicesLogLevel.toLowerCase() !==
                this.sessionSettings.developer.editorServicesLogLevel.toLowerCase() ||
            settings.developer.bundledModulesPath.toLowerCase() !==
                this.sessionSettings.developer.bundledModulesPath.toLowerCase() ||
            settings.integratedConsole.useLegacyReadLine !==
                this.sessionSettings.integratedConsole.useLegacyReadLine)) {

            const response: string = await vscode.window.showInformationMessage(
                "The PowerShell runtime configuration has changed, would you like to start a new session?",
                "Yes", "No");

            if (response === "Yes") {
                await this.restartSession();
            }
        }
    }

    private setStatusBarVersionString(runspaceDetails: IRunspaceDetails) {
        const psVersion = runspaceDetails.powerShellVersion;

        let versionString =
            this.versionDetails.architecture === "x86"
                ? `${psVersion.displayVersion} (${psVersion.architecture})`
                : psVersion.displayVersion;

        if (runspaceDetails.runspaceType !== RunspaceType.Local) {
            versionString += ` [${runspaceDetails.connectionString}]`;
        }

        this.setSessionVersion(versionString);
    }

    private registerCommands(): void {
        this.registeredCommands = [
            vscode.commands.registerCommand("PowerShell.RestartSession", async () => { await this.restartSession(); }),
            vscode.commands.registerCommand(this.ShowSessionMenuCommandName, async () => { await this.showSessionMenu(); }),
            vscode.workspace.onDidChangeConfiguration(async () => { await this.onConfigurationUpdated(); }),
            vscode.commands.registerCommand(
                "PowerShell.ShowSessionConsole", (isExecute?: boolean) => { this.showSessionConsole(isExecute); }),
            vscode.commands.registerCommand(
                "PowerShell.WalkthroughTelemetry", (satisfaction: number) => {
                    this.sendTelemetryEvent("powershellWalkthroughSatisfaction", null, { level: satisfaction });
                }
            )
        ];
    }

    private async startPowerShell() {
        this.setSessionStatus("Starting...", SessionStatus.Initializing);

        this.languageServerProcess =
            new PowerShellProcess(
                this.PowerShellExeDetails.exePath,
                this.bundledModulesPath,
                "PowerShell Extension",
                this.log,
                this.editorServicesArgs,
                this.getNewSessionFilePath(),
                this.sessionSettings);

        this.languageServerProcess.onExited(
            async () => {
                if (this.sessionStatus === SessionStatus.Running) {
                    this.setSessionStatus("Session Exited", SessionStatus.Failed);
                    await this.promptForRestart();
                }
            });

        try {
            this.sessionDetails = await this.languageServerProcess.start("EditorServices");
        } catch (error) {
            this.log.write("PowerShell process failed to start.");
            await this.setSessionFailure("PowerShell process failed to start: ", error);
        }

        if (this.sessionDetails.status === "started") {
            this.log.write("Language server started.");
            try {
                await this.startLanguageClient(this.sessionDetails);
            } catch (error) {
                await this.setSessionFailure("Language client failed to start: ", error);
            }
        } else if (this.sessionDetails.status === "failed") {
            if (this.sessionDetails.reason === "unsupported") {
                await this.setSessionFailure(
                    "PowerShell language features are only supported on PowerShell version 5.1 and 7+. " +
                    `The current version is ${this.sessionDetails.powerShellVersion}.`);
            } else if (this.sessionDetails.reason === "languageMode") {
                await this.setSessionFailure(
                    "PowerShell language features are disabled due to an unsupported LanguageMode: " +
                    `${this.sessionDetails.detail}`);
            } else {
                await this.setSessionFailure(
                    `PowerShell could not be started for an unknown reason '${this.sessionDetails.reason}'`);
            }
        } else {
            // TODO: Handle other response cases
        }
    }

    private async promptForRestart() {
        const response: string = await vscode.window.showErrorMessage(
            "The PowerShell Extension Terminal has stopped, would you like to restart it? IntelliSense and other features will not work without it!",
            "Yes", "No");

        if (response === "Yes") {
            await this.restartSession();
        }
    }

    private async sendTelemetryEvent(eventName: string, properties?: TelemetryEventProperties, measures?: TelemetryEventMeasurements) {
        if (this.extensionContext.extensionMode === vscode.ExtensionMode.Production) {
            this.telemetryReporter.sendTelemetryEvent(eventName, properties, measures);
        }
    }

    private async startLanguageClient(sessionDetails: IEditorServicesSessionDetails) {
        this.log.write(`Connecting to language service on pipe: ${sessionDetails.languageServicePipeName}`);
        this.log.write("Session details: " + JSON.stringify(sessionDetails));

        const connectFunc = () => {
            return new Promise<StreamInfo>(
                (resolve, _reject) => {
                    const socket = net.connect(sessionDetails.languageServicePipeName);
                    socket.on(
                        "connect",
                        () => {
                            this.log.write("Language service socket connected.");
                            resolve({ writer: socket, reader: socket });
                        });
                });
        };

        const clientOptions: LanguageClientOptions = {
            documentSelector: this.documentSelector,
            synchronize: {
                // backend uses "files" and "search" to ignore references.
                configurationSection: [utils.PowerShellLanguageId, "files", "search"],
                // TODO: fileEvents: vscode.workspace.createFileSystemWatcher('**/.eslintrc')
            },
            // NOTE: Some settings are only applicable on startup, so we send them during initialization.
            initializationOptions: {
                enableProfileLoading: this.sessionSettings.enableProfileLoading,
                initialWorkingDirectory: this.sessionSettings.cwd,
            },
            errorHandler: {
                // Override the default error handler to prevent it from
                // closing the LanguageClient incorrectly when the socket
                // hangs up (ECONNRESET errors).
                error: (_error: any, _message: Message, _count: number): ErrorHandlerResult => {
                    // TODO: Is there any error worth terminating on?
                    return { action: ErrorAction.Continue };
                },
                closed: (): CloseHandlerResult => {
                    // We have our own restart experience
                    return { action: CloseAction.DoNotRestart };
                },
            },
            revealOutputChannelOn: RevealOutputChannelOn.Never,
            middleware: this,
        };

        this.languageClient = new LanguageClient("PowerShell Editor Services", connectFunc, clientOptions);

        // This enables handling Semantic Highlighting messages in PowerShell Editor Services
        this.languageClient.registerProposedFeatures();

        this.languageClient.onTelemetry((event) => {
            const eventName: string = event.eventName ? event.eventName : "PSESEvent";
            const data: any = event.data ? event.data : event
            this.sendTelemetryEvent(eventName, data);
        });

        // Send the new LanguageClient to extension features
        // so that they can register their message handlers
        // before the connection is established.
        for (const consumer of this.languageClientConsumers) {
            consumer.setLanguageClient(this.languageClient);
        }

        this.registeredHandlers = [
            // NOTE: This fixes a quirk where PSES has a thread stuck on
            // Console.ReadKey, since it's not cancellable. On
            // "cancellation" the server asks us to send pretend to
            // press a key, thus mitigating all the quirk.
            this.languageClient.onNotification(
                SendKeyPressNotificationType,
                () => { this.languageServerProcess.sendKeyPress(); }),

            // TODO: I'm not sure we're still receiving these notifications...
            this.languageClient.onNotification(
                RunspaceChangedEventType,
                (runspaceDetails) => { this.setStatusBarVersionString(runspaceDetails); }),
        ]

        try {
            await this.languageClient.start();
        } catch (error) {
            await this.setSessionFailure("Could not start language service: ", error);
            return;
        }

        this.versionDetails = await this.languageClient.sendRequest(PowerShellVersionRequestType);

        this.sendTelemetryEvent("powershellVersionCheck", { powershellVersion: this.versionDetails.version });

        this.setSessionVersion(this.versionDetails.architecture === "x86"
            ? `${this.versionDetails.displayVersion} (${this.versionDetails.architecture})`
            : this.versionDetails.displayVersion);

        // We haven't "started" until we're done getting the version information.
        this.started = true;

        // NOTE: We specifically don't want to wait for this.
        this.checkForPowerShellUpdate();
    }

    private async checkForPowerShellUpdate() {
        // If the user opted to not check for updates, then don't.
        if (!this.sessionSettings.promptToUpdatePowerShell) {
            return;
        }

        const localVersion = semver.parse(this.versionDetails.version);
        if (semver.lt(localVersion, "6.0.0")) {
            // Skip prompting when using Windows PowerShell for now.
            return;
        }

        try {
            // Fetch the latest PowerShell releases from GitHub.
            const isPreRelease = !!semver.prerelease(localVersion);
            const release: GitHubReleaseInformation =
                await GitHubReleaseInformation.FetchLatestRelease(isPreRelease);

            await InvokePowerShellUpdateCheck(
                this,
                this.languageClient,
                localVersion,
                this.versionDetails.architecture,
                release);
        } catch (error) {
            // Best effort. This probably failed to fetch the data from GitHub.
            this.log.writeWarning(error.message);
        }
    }

    private createStatusBarItem() {
        const statusTitle: string = "Show PowerShell Session Menu";
        if (this.languageStatusItem !== undefined) {
            return;
        }
        this.languageStatusItem = vscode.languages.createLanguageStatusItem("powershell", this.documentSelector);
        this.languageStatusItem.command = { title: statusTitle, command: this.ShowSessionMenuCommandName };
        this.languageStatusItem.text = "$(terminal-powershell)";
    }

    private setSessionStatus(statusText: string, status: SessionStatus): void {
        this.sessionStatus = status;
        this.languageStatusItem.detail = "PowerShell " + statusText;
        switch (status) {
            case SessionStatus.Running:
            case SessionStatus.NeverStarted:
            case SessionStatus.NotStarted:
                this.languageStatusItem.busy = false;
                // @ts-ignore
                this.languageStatusItem.severity = vscode.LanguageStatusSeverity.Information;
                break;
            case SessionStatus.Initializing:
            case SessionStatus.Stopping:
                this.languageStatusItem.busy = true;
                // @ts-ignore
                this.languageStatusItem.severity = vscode.LanguageStatusSeverity.Warning;
                break;
            case SessionStatus.Failed:
                this.languageStatusItem.busy = false;
                // @ts-ignore
                this.languageStatusItem.severity = vscode.LanguageStatusSeverity.Error;
                break;
        }

    }

    private setSessionVersion(version: string): void {
        // TODO: Accept a VersionDetails object instead of a string.
        this.languageStatusItem.text = "$(terminal-powershell) " + version;
        this.setSessionStatus(version, SessionStatus.Running);
    }

    private async setSessionFailure(message: string, ...additionalMessages: string[]) {
        this.setSessionStatus("Initialization Error", SessionStatus.Failed);
        await this.log.writeAndShowError(message, ...additionalMessages);
    }

    private async changePowerShellDefaultVersion(exePath: IPowerShellExeDetails) {
        this.suppressRestartPrompt = true;
        await Settings.change("powerShellDefaultVersion", exePath.displayName, true);

        // We pass in the display name so that we force the extension to use that version
        // rather than pull from the settings. The issue we prevent here is when a
        // workspace setting is defined which gets priority over user settings which
        // is what the change above sets.
        await this.restartSession(exePath.displayName);
    }

    private showSessionConsole(isExecute?: boolean) {
        if (this.languageServerProcess) {
            this.languageServerProcess.showConsole(isExecute && !this.focusConsoleOnExecute);
        }
    }

    private async showSessionMenu() {
        const availablePowerShellExes = await this.powershellExeFinder.getAllAvailablePowerShellInstallations();

        let sessionText: string;

        switch (this.sessionStatus) {
            case SessionStatus.Running:
            case SessionStatus.Initializing:
            case SessionStatus.NotStarted:
            case SessionStatus.NeverStarted:
            case SessionStatus.Stopping:
                const currentPowerShellExe =
                    availablePowerShellExes
                        .find((item) => item.displayName.toLowerCase() === this.PowerShellExeDetails.displayName.toLowerCase());

                const powerShellSessionName =
                    currentPowerShellExe ?
                        currentPowerShellExe.displayName :
                        `PowerShell ${this.versionDetails.displayVersion} ` +
                        `(${this.versionDetails.architecture}) ${this.versionDetails.edition} Edition ` +
                        `[${this.versionDetails.version}]`;

                sessionText = `Current session: ${powerShellSessionName}`;
                break;

            case SessionStatus.Failed:
                sessionText = "Session initialization failed, click here to show PowerShell extension logs";
                break;

            default:
                throw new TypeError("Not a valid value for the enum 'SessionStatus'");
        }

        const powerShellItems =
            availablePowerShellExes
                .filter((item) => item.displayName !== this.PowerShellExeDetails.displayName)
                .map((item) => {
                    return new SessionMenuItem(
                        `Switch to: ${item.displayName}`,
                        () => { this.changePowerShellDefaultVersion(item); });
                });

        const menuItems: SessionMenuItem[] = [
            new SessionMenuItem(
                sessionText,
                () => { vscode.commands.executeCommand("PowerShell.ShowLogs"); }),

            // Add all of the different PowerShell options
            ...powerShellItems,

            new SessionMenuItem(
                "Restart Current Session",
                async () => {
                    // We pass in the display name so we guarantee that the session
                    // will be the same PowerShell.
                    await this.restartSession(this.PowerShellExeDetails.displayName);
                }),

            new SessionMenuItem(
                "Open Session Logs Folder",
                () => { vscode.commands.executeCommand("PowerShell.OpenLogFolder"); }),

            new SessionMenuItem(
                "Modify list of additional PowerShell locations",
                () => { vscode.commands.executeCommand("workbench.action.openSettings", "powerShellAdditionalExePaths"); }),
        ];

        vscode
            .window
            .showQuickPick<SessionMenuItem>(menuItems)
            .then((selectedItem) => { selectedItem.callback(); });
    }
}

class SessionMenuItem implements vscode.QuickPickItem {
    public description: string;

    constructor(
        public readonly label: string,
        // tslint:disable-next-line:no-empty
        public readonly callback: () => void = () => { }) {
    }
}
