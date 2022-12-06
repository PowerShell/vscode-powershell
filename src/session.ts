// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import net = require("net");
import path = require("path");
import vscode = require("vscode");
import TelemetryReporter, { TelemetryEventProperties, TelemetryEventMeasurements } from "@vscode/extension-telemetry";
import { Message } from "vscode-jsonrpc";
import { ILogger } from "./logging";
import { PowerShellProcess } from "./process";
import { Settings, changeSetting, getSettings, getEffectiveConfigurationTarget, validateCwdSetting } from "./settings";
import utils = require("./utils");

import {
    CloseAction, CloseHandlerResult, DocumentSelector, ErrorAction, ErrorHandlerResult,
    LanguageClientOptions, Middleware, NotificationType,
    RequestType0, ResolveCodeLensSignature, RevealOutputChannelOn
} from "vscode-languageclient";
import { LanguageClient, StreamInfo } from "vscode-languageclient/node";

import { UpdatePowerShell } from "./features/UpdatePowerShell";
import {
    getPlatformDetails, IPlatformDetails, IPowerShellExeDetails,
    OperatingSystem, PowerShellExeFinder
} from "./platform";
import { LanguageClientConsumer } from "./languageClientConsumer";
import { SemVer } from "semver";

export enum SessionStatus {
    NeverStarted,
    NotStarted,
    Initializing,
    Running,
    Busy,
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
    public HostVersion: string;
    public PowerShellExeDetails: IPowerShellExeDetails | undefined;
    private ShowSessionMenuCommandName = "PowerShell.ShowSessionMenu";
    private sessionStatus: SessionStatus = SessionStatus.NeverStarted;
    private suppressRestartPrompt = false;
    private platformDetails: IPlatformDetails;
    private languageClientConsumers: LanguageClientConsumer[] = [];
    private languageStatusItem: vscode.LanguageStatusItem;
    private languageServerProcess: PowerShellProcess | undefined;
    private debugSessionProcess: PowerShellProcess | undefined;
    private debugEventHandler: vscode.Disposable | undefined;
    private versionDetails: IPowerShellVersionDetails | undefined;
    private registeredHandlers: vscode.Disposable[] = [];
    private registeredCommands: vscode.Disposable[] = [];
    private languageClient: LanguageClient | undefined;
    private sessionDetails: IEditorServicesSessionDetails | undefined;
    private sessionsFolder: vscode.Uri;
    private starting = false;
    private started = false;

    constructor(
        private extensionContext: vscode.ExtensionContext,
        private sessionSettings: Settings,
        private logger: ILogger,
        private documentSelector: DocumentSelector,
        hostName: string,
        hostVersion: string,
        private telemetryReporter: TelemetryReporter) {

        // Create the language status item
        this.languageStatusItem = this.createStatusBarItem();
        // We have to override the scheme because it defaults to
        // 'vscode-userdata' which breaks UNC paths.
        this.sessionsFolder = vscode.Uri.joinPath(extensionContext.globalStorageUri.with({ scheme: "file"}), "sessions");
        this.platformDetails = getPlatformDetails();
        this.HostName = hostName;
        this.HostVersion = hostVersion;

        const osBitness = this.platformDetails.isOS64Bit ? "64-bit" : "32-bit";
        const procBitness = this.platformDetails.isProcess64Bit ? "64-bit" : "32-bit";

        this.logger.write(
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

        await this.languageClient?.dispose();
    }

    public setLanguageClientConsumers(languageClientConsumers: LanguageClientConsumer[]) {
        this.languageClientConsumers = languageClientConsumers;
    }

    // The `exeNameOverride` is used by `restartSession` to override ANY other setting.
    public async start(exeNameOverride?: string) {
        // A simple lock because this function isn't re-entrant.
        if (this.started || this.starting) {
            return await this.waitUntilStarted();
        }
        try {
            this.starting = true;
            if (exeNameOverride) {
                this.sessionSettings.powerShellDefaultVersion = exeNameOverride;
            }
            // Create a folder for the session files.
            await vscode.workspace.fs.createDirectory(this.sessionsFolder);
            await this.promptPowerShellExeSettingsCleanup();
            await this.migrateWhitespaceAroundPipeSetting();
            this.PowerShellExeDetails = await this.findPowerShell();
            this.languageServerProcess = await this.startPowerShell();
        } finally {
            this.starting = false;
        }
    }

    public async stop() {
        this.logger.write("Shutting down language client...");

        try {
            if (this.sessionStatus === SessionStatus.Failed) {
                // Before moving further, clear out the client and process if
                // the process is already dead (i.e. it crashed).
                await this.languageClient?.dispose();
                this.languageClient = undefined;
                await this.languageServerProcess?.dispose();
                this.languageServerProcess = undefined;
            }

            this.sessionStatus = SessionStatus.Stopping;

            // Stop the language client.
            await this.languageClient?.stop();
            await this.languageClient?.dispose();
            this.languageClient = undefined;

            // Kill the PowerShell process(es) we spawned.
            await this.debugSessionProcess?.dispose();
            this.debugSessionProcess = undefined;
            this.debugEventHandler?.dispose();
            this.debugEventHandler = undefined;

            await this.languageServerProcess?.dispose();
            this.languageServerProcess = undefined;

        } finally {
            this.sessionStatus = SessionStatus.NotStarted;
            this.started = false;
        }
    }

    public async restartSession(exeNameOverride?: string) {
        await this.stop();

        // Re-load and validate the settings.
        await validateCwdSetting(this.logger);
        this.sessionSettings = getSettings();

        await this.start(exeNameOverride);
    }

    public getSessionDetails(): IEditorServicesSessionDetails | undefined {
        return this.sessionDetails;
    }

    public getSessionStatus(): SessionStatus {
        return this.sessionStatus;
    }

    public getPowerShellVersionDetails(): IPowerShellVersionDetails | undefined {
        return this.versionDetails;
    }

    public getNewSessionFilePath(): vscode.Uri {
        const uniqueId: number = Math.floor(100000 + Math.random() * 900000);
        return vscode.Uri.joinPath(this.sessionsFolder, `PSES-VSCode-${process.env.VSCODE_PID}-${uniqueId}.json`);
    }

    public async createDebugSessionProcess(settings: Settings): Promise<PowerShellProcess> {
        // NOTE: We only support one temporary Extension Terminal at a time. To
        // support more, we need to track each separately, and tie the session
        // for the event handler to the right process (and dispose of the event
        // handler when the process is disposed).
        await this.debugSessionProcess?.dispose();
        this.debugEventHandler?.dispose();

        if (this.PowerShellExeDetails === undefined) {
            return Promise.reject("Required PowerShellExeDetails undefined!");
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
                "[TEMP] PowerShell Extension",
                this.logger,
                this.buildEditorServicesArgs(bundledModulesPath, this.PowerShellExeDetails) + "-DebugServiceOnly ",
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
                    if (oldArgs === undefined || oldArgs.length < 3) {
                        this.logger.writeError("Code Lens arguments were malformed");
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

    // Move old setting codeFormatting.whitespaceAroundPipe to new setting codeFormatting.addWhitespaceAroundPipe
    private async migrateWhitespaceAroundPipeSetting() {
        const configuration = vscode.workspace.getConfiguration(utils.PowerShellLanguageId);
        const deprecatedSetting = "codeFormatting.whitespaceAroundPipe";
        const newSetting = "codeFormatting.addWhitespaceAroundPipe";
        const configurationTargetOfNewSetting = getEffectiveConfigurationTarget(newSetting);
        const configurationTargetOfOldSetting = getEffectiveConfigurationTarget(deprecatedSetting);
        if (configurationTargetOfOldSetting !== undefined && configurationTargetOfNewSetting === undefined) {
            const value = configuration.get(deprecatedSetting, configurationTargetOfOldSetting);
            await changeSetting(newSetting, value, configurationTargetOfOldSetting, this.logger);
            await changeSetting(deprecatedSetting, undefined, configurationTargetOfOldSetting, this.logger);
        }
    }

    // TODO: Remove this migration code.
    private async promptPowerShellExeSettingsCleanup() {
        if (this.sessionSettings.powerShellExePath === "") {
            return;
        }

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
            await changeSetting("powerShellExePath", undefined, true, this.logger);
        } finally {
            this.suppressRestartPrompt = false;
        }

        // Show the session menu at the end if they don't have a PowerShellDefaultVersion.
        if (this.sessionSettings.powerShellDefaultVersion === "") {
            await vscode.commands.executeCommand(this.ShowSessionMenuCommandName);
        }
    }

    private async onConfigurationUpdated() {
        const settings = getSettings();
        this.logger.updateLogLevel(settings.developer.editorServicesLogLevel);

        // Detect any setting changes that would affect the session
        if (!this.suppressRestartPrompt &&
            (settings.cwd.toLowerCase() !== this.sessionSettings.cwd.toLowerCase()
                || settings.powerShellDefaultVersion.toLowerCase() !== this.sessionSettings.powerShellDefaultVersion.toLowerCase()
                || settings.developer.editorServicesLogLevel.toLowerCase() !== this.sessionSettings.developer.editorServicesLogLevel.toLowerCase()
                || settings.developer.bundledModulesPath.toLowerCase() !== this.sessionSettings.developer.bundledModulesPath.toLowerCase()
                || settings.integratedConsole.useLegacyReadLine !== this.sessionSettings.integratedConsole.useLegacyReadLine
                || settings.integratedConsole.startInBackground !== this.sessionSettings.integratedConsole.startInBackground)) {
            const response = await vscode.window.showInformationMessage(
                "The PowerShell runtime configuration has changed, would you like to start a new session?",
                "Yes", "No");

            if (response === "Yes") {
                await this.restartSession();
            }
        }
    }

    private registerCommands(): void {
        this.registeredCommands = [
            vscode.commands.registerCommand("PowerShell.RestartSession", async () => { await this.restartSession(); }),
            vscode.commands.registerCommand(this.ShowSessionMenuCommandName, async () => { await this.showSessionMenu(); }),
            vscode.workspace.onDidChangeConfiguration(async () => { await this.onConfigurationUpdated(); }),
            vscode.commands.registerCommand(
                "PowerShell.ShowSessionConsole", (isExecute?: boolean) => { this.showSessionTerminal(isExecute); }),
            vscode.commands.registerCommand(
                "PowerShell.WalkthroughTelemetry", (satisfaction: number) => {
                    this.sendTelemetryEvent("powershellWalkthroughSatisfaction", undefined, { level: satisfaction });
                }
            )
        ];
    }

    private async startPowerShell(): Promise<PowerShellProcess | undefined> {
        if (this.PowerShellExeDetails === undefined) {
            this.setSessionFailure("Unable to find PowerShell.");
            return;
        }

        this.setSessionStatus("Starting...", SessionStatus.Initializing);

        const bundledModulesPath = await this.getBundledModulesPath();
        const languageServerProcess =
            new PowerShellProcess(
                this.PowerShellExeDetails.exePath,
                bundledModulesPath,
                "PowerShell Extension",
                this.logger,
                this.buildEditorServicesArgs(bundledModulesPath, this.PowerShellExeDetails),
                this.getNewSessionFilePath(),
                this.sessionSettings);

        languageServerProcess.onExited(
            async () => {
                if (this.sessionStatus === SessionStatus.Running) {
                    this.setSessionStatus("Session Exited!", SessionStatus.Failed);
                    await this.promptForRestart();
                }
            });

        try {
            this.sessionDetails = await languageServerProcess.start("EditorServices");
        } catch (err) {
            this.setSessionFailure("PowerShell process failed to start: ", err instanceof Error ? err.message : "unknown");
        }

        if (this.sessionDetails?.status === "started") {
            this.logger.write("Language server started.");
            try {
                await this.startLanguageClient(this.sessionDetails);
            } catch (err) {
                this.setSessionFailure("Language client failed to start: ", err instanceof Error ? err.message : "unknown");
            }
        } else if (this.sessionDetails?.status === "failed") {
            if (this.sessionDetails.reason === "unsupported") {
                this.setSessionFailure(
                    "PowerShell language features are only supported on PowerShell version 5.1 and 7+. " +
                    `The current version is ${this.sessionDetails.powerShellVersion}.`);
            } else if (this.sessionDetails.reason === "languageMode") {
                this.setSessionFailure(
                    "PowerShell language features are disabled due to an unsupported LanguageMode: " +
                    `${this.sessionDetails.detail}`);
            } else {
                this.setSessionFailure(
                    `PowerShell could not be started for an unknown reason '${this.sessionDetails.reason}'`);
            }
        } else {
            this.setSessionFailure(
                `Unknown session status '${this.sessionDetails?.status}' with reason '${this.sessionDetails?.reason}`);
        }

        return languageServerProcess;
    }

    private async findPowerShell(): Promise<IPowerShellExeDetails | undefined> {
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
        } catch (e) {
            this.logger.writeError(`Error occurred while searching for a PowerShell executable:\n${e}`);
        }

        if (foundPowerShell === undefined) {
            const message = "Unable to find PowerShell."
                + " Do you have PowerShell installed?"
                + " You can also configure custom PowerShell installations"
                + " with the 'powershell.powerShellAdditionalExePaths' setting.";

            await this.logger.writeAndShowErrorWithActions(message, [
                {
                    prompt: "Get PowerShell",
                    action: async () => {
                        const getPSUri = vscode.Uri.parse("https://aka.ms/get-powershell-vscode");
                        await vscode.env.openExternal(getPSUri);
                    },
                },
            ]);
        }

        return foundPowerShell;
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

    private buildEditorServicesArgs(bundledModulesPath: string, powerShellExeDetails: IPowerShellExeDetails): string {
        let editorServicesArgs =
            "-HostName 'Visual Studio Code Host' " +
            "-HostProfileId 'Microsoft.VSCode' " +
            `-HostVersion '${this.HostVersion}' ` +
            "-AdditionalModules @('PowerShellEditorServices.VSCode') " +
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
            editorServicesArgs += `-StartupBanner '${this.HostName} Extension v${this.HostVersion}' `;
        } else {
            const startupBanner = `${this.HostName} Extension v${this.HostVersion}
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

        editorServicesArgs += `-LogLevel '${this.sessionSettings.developer.editorServicesLogLevel}' `;

        return editorServicesArgs;
    }

    private async promptForRestart() {
        await this.logger.writeAndShowErrorWithActions(
            "The PowerShell Extension Terminal has stopped, would you like to restart it? IntelliSense and other features will not work without it!",
            [
                {
                    prompt: "Yes",
                    action: async () => { await this.restartSession(); }
                },
                {
                    prompt: "No",
                    action: undefined
                }
            ]
        );
    }

    private sendTelemetryEvent(eventName: string, properties?: TelemetryEventProperties, measures?: TelemetryEventMeasurements) {
        if (this.extensionContext.extensionMode === vscode.ExtensionMode.Production) {
            this.telemetryReporter.sendTelemetryEvent(eventName, properties, measures);
        }
    }

    private async startLanguageClient(sessionDetails: IEditorServicesSessionDetails) {
        this.logger.write(`Connecting to language service on pipe: ${sessionDetails.languageServicePipeName}`);
        this.logger.write("Session details: " + JSON.stringify(sessionDetails));

        const connectFunc = () => {
            return new Promise<StreamInfo>(
                (resolve, _reject) => {
                    const socket = net.connect(sessionDetails.languageServicePipeName);
                    socket.on(
                        "connect",
                        () => {
                            this.logger.write("Language service socket connected.");
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
            initializationOptions: {
                enableProfileLoading: this.sessionSettings.enableProfileLoading,
                initialWorkingDirectory: this.sessionSettings.cwd,
                shellIntegrationEnabled: vscode.workspace.getConfiguration("terminal.integrated.shellIntegration").get<boolean>("enabled"),
            },
            errorHandler: {
                // Override the default error handler to prevent it from
                // closing the LanguageClient incorrectly when the socket
                // hangs up (ECONNRESET errors).
                error: (_error: Error, _message: Message, _count: number): ErrorHandlerResult => {
                    // TODO: Is there any error worth terminating on?
                    return { action: ErrorAction.Continue };
                },
                closed: (): CloseHandlerResult => {
                    // We have our own restart experience
                    return {
                        action: CloseAction.DoNotRestart,
                        message: "Connection to PowerShell Editor Services (the Extension Terminal) was closed. See below prompt to restart!"
                    };
                },
            },
            revealOutputChannelOn: RevealOutputChannelOn.Never,
            middleware: this,
        };

        this.languageClient = new LanguageClient("PowerShell Editor Services", connectFunc, clientOptions);

        // This enables handling Semantic Highlighting messages in PowerShell Editor Services
        // TODO: We should only turn this on in preview.
        this.languageClient.registerProposedFeatures();

        this.languageClient.onTelemetry((event) => {
            const eventName: string = event.eventName ? event.eventName : "PSESEvent";
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const data: any = event.data ? event.data : event;
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
                () => { this.languageServerProcess?.sendKeyPress(); }),

            this.languageClient.onNotification(
                ExecutionBusyStatusNotificationType,
                (isBusy: boolean) => {
                    if (isBusy) { this.setSessionBusyStatus(); }
                    else { this.setSessionRunningStatus(); }
                }
            ),
        ];

        try {
            await this.languageClient.start();
        } catch (err) {
            this.setSessionFailure("Could not start language service: ", err instanceof Error ? err.message : "unknown");
            return;
        }

        this.versionDetails = await this.languageClient.sendRequest(PowerShellVersionRequestType);
        this.setSessionRunningStatus();
        this.sendTelemetryEvent("powershellVersionCheck", { powershellVersion: this.versionDetails.version });

        // We haven't "started" until we're done getting the version information.
        this.started = true;

        const updater = new UpdatePowerShell(this, this.sessionSettings, this.logger, this.versionDetails);
        // NOTE: We specifically don't want to wait for this.
        void updater.checkForUpdate();
    }

    private createStatusBarItem(): vscode.LanguageStatusItem {
        const statusTitle = "Show PowerShell Session Menu";
        const languageStatusItem = vscode.languages.createLanguageStatusItem("powershell", this.documentSelector);
        languageStatusItem.command = { title: statusTitle, command: this.ShowSessionMenuCommandName };
        languageStatusItem.text = "$(terminal-powershell)";
        languageStatusItem.detail = "PowerShell";
        return languageStatusItem;
    }

    private setSessionStatus(statusText: string, status: SessionStatus): void {
        this.sessionStatus = status;
        this.languageStatusItem.detail = "PowerShell";

        if (this.versionDetails !== undefined) {
            const semver = new SemVer(this.versionDetails.version);
            this.languageStatusItem.text = `$(terminal-powershell) ${semver.major}.${semver.minor}`;
            this.languageStatusItem.detail += ` ${this.versionDetails.commit} (${this.versionDetails.architecture.toLowerCase()})`;
        }

        if (statusText) {
            this.languageStatusItem.detail += ": " + statusText;
        }

        switch (status) {
        case SessionStatus.Running:
        case SessionStatus.NeverStarted:
        case SessionStatus.NotStarted:
            this.languageStatusItem.busy = false;
            this.languageStatusItem.severity = vscode.LanguageStatusSeverity.Information;
            break;
        case SessionStatus.Busy:
            this.languageStatusItem.busy = true;
            this.languageStatusItem.severity = vscode.LanguageStatusSeverity.Information;
            break;
        case SessionStatus.Initializing:
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

    private setSessionRunningStatus(): void {
        this.setSessionStatus("", SessionStatus.Running);
    }

    private setSessionBusyStatus(): void {
        this.setSessionStatus("Executing...", SessionStatus.Busy);
    }

    private setSessionFailure(message: string, ...additionalMessages: string[]): void {
        this.setSessionStatus("Initialization Error!", SessionStatus.Failed);
        void this.logger.writeAndShowError(message, ...additionalMessages);
    }

    private async changePowerShellDefaultVersion(exePath: IPowerShellExeDetails) {
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
    public showDebugTerminal(isExecute?: boolean) {
        if (this.debugSessionProcess) {
            this.debugSessionProcess.showTerminal(isExecute && !this.sessionSettings.integratedConsole.focusConsoleOnExecute);
        } else {
            this.languageServerProcess?.showTerminal(isExecute && !this.sessionSettings.integratedConsole.focusConsoleOnExecute);
        }
    }

    // Always shows the session terminal.
    public showSessionTerminal(isExecute?: boolean) {
        this.languageServerProcess?.showTerminal(isExecute && !this.sessionSettings.integratedConsole.focusConsoleOnExecute);
    }

    private async showSessionMenu() {
        const powershellExeFinder = new PowerShellExeFinder(
            this.platformDetails,
            this.sessionSettings.powerShellAdditionalExePaths,
            this.logger);
        const availablePowerShellExes = await powershellExeFinder.getAllAvailablePowerShellInstallations();

        let sessionText: string;

        switch (this.sessionStatus) {
        case SessionStatus.Running:
        case SessionStatus.Initializing:
        case SessionStatus.NotStarted:
        case SessionStatus.NeverStarted:
        case SessionStatus.Stopping:
            if (this.PowerShellExeDetails && this.versionDetails) {
                const currentPowerShellExe =
                        availablePowerShellExes
                            .find((item) => item.displayName.toLowerCase() === this.PowerShellExeDetails!.displayName.toLowerCase());

                const powerShellSessionName =
                        currentPowerShellExe ?
                            currentPowerShellExe.displayName :
                            `PowerShell ${this.versionDetails.version} ` +
                            `(${this.versionDetails.architecture.toLowerCase()}) ${this.versionDetails.edition} Edition ` +
                            `[${this.versionDetails.version}]`;

                sessionText = `Current session: ${powerShellSessionName}`;
            } else {
                sessionText = "Current session: Unknown";
            }
            break;

        case SessionStatus.Failed:
            sessionText = "Session initialization failed, click here to show PowerShell extension logs";
            break;

        default:
            throw new TypeError("Not a valid value for the enum 'SessionStatus'");
        }

        const powerShellItems =
            availablePowerShellExes
                .filter((item) => item.displayName !== this.PowerShellExeDetails?.displayName)
                .map((item) => {
                    return new SessionMenuItem(
                        `Switch to: ${item.displayName}`,
                        async () => { await this.changePowerShellDefaultVersion(item); });
                });

        const menuItems: SessionMenuItem[] = [
            new SessionMenuItem(
                sessionText,
                async () => { await vscode.commands.executeCommand("PowerShell.ShowLogs"); }),

            // Add all of the different PowerShell options
            ...powerShellItems,

            new SessionMenuItem(
                "Restart Current Session",
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
                "Open Session Logs Folder",
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
        public readonly callback = async () => { }) {
    }
}
