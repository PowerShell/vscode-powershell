/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import cp = require("child_process");
import fs = require("fs");
import net = require("net");
import path = require("path");
import * as semver from "semver";
import vscode = require("vscode");
import TelemetryReporter from "vscode-extension-telemetry";
import { Message } from "vscode-jsonrpc";
import { IFeature } from "./feature";
import { Logger } from "./logging";
import { PowerShellProcess } from "./process";
import Settings = require("./settings");
import utils = require("./utils");

import {
    CloseAction, DocumentSelector, ErrorAction, Executable, LanguageClient, LanguageClientOptions,
    Middleware, NotificationType, RequestType, RequestType0,
    ResolveCodeLensSignature, RevealOutputChannelOn, StreamInfo } from "vscode-languageclient";

import { GitHubReleaseInformation, InvokePowerShellUpdateCheck } from "./features/UpdatePowerShell";
import {
    getPlatformDetails, IPlatformDetails,
    OperatingSystem, PowerShellExeFinder } from "./platform";

export enum SessionStatus {
    NeverStarted,
    NotStarted,
    Initializing,
    Running,
    Stopping,
    Failed,
}

export class SessionManager implements Middleware {
    public HostVersion: string;
    private ShowSessionMenuCommandName = "PowerShell.ShowSessionMenu";
    private editorServicesArgs: string;
    private powerShellExePath: string = "";
    private sessionStatus: SessionStatus = SessionStatus.NeverStarted;
    private suppressRestartPrompt: boolean;
    private focusConsoleOnExecute: boolean;
    private platformDetails: IPlatformDetails;
    private extensionFeatures: IFeature[] = [];
    private statusBarItem: vscode.StatusBarItem;
    private languageServerProcess: PowerShellProcess;
    private debugSessionProcess: PowerShellProcess;
    private versionDetails: IPowerShellVersionDetails;
    private registeredCommands: vscode.Disposable[] = [];
    private languageServerClient: LanguageClient = undefined;
    private sessionSettings: Settings.ISettings = undefined;
    private sessionDetails: utils.IEditorServicesSessionDetails;
    private bundledModulesPath: string;
    private telemetryReporter: TelemetryReporter;

    // Initialized by the start() method, since this requires settings
    private powershellExeFinder: PowerShellExeFinder;

    // When in development mode, VS Code's session ID is a fake
    // value of "someValue.machineId".  Use that to detect dev
    // mode for now until Microsoft/vscode#10272 gets implemented.
    private readonly inDevelopmentMode =
        vscode.env.sessionId === "someValue.sessionId";

    constructor(
        private requiredEditorServicesVersion: string,
        private log: Logger,
        private documentSelector: DocumentSelector,
        private version: string,
        private reporter: TelemetryReporter) {

        this.platformDetails = getPlatformDetails();

        this.HostVersion = version;
        this.telemetryReporter = reporter;

        const osBitness = this.platformDetails.isOS64Bit ? "64-bit" : "32-bit";
        const procBitness = this.platformDetails.isProcess64Bit ? "64-bit" : "32-bit";

        this.log.write(
            `Visual Studio Code v${vscode.version} ${procBitness}`,
            `PowerShell Extension v${this.HostVersion}`,
            `Operating System: ${OperatingSystem[this.platformDetails.operatingSystem]} ${osBitness}`);

        // Fix the host version so that PowerShell can consume it.
        // This is needed when the extension uses a prerelease
        // version string like 0.9.1-insiders-1234.
        this.HostVersion = this.HostVersion.split("-")[0];

        this.registerCommands();
    }

    public dispose(): void {
        // Stop the current session
        this.stop();

        // Dispose of all commands
        this.registeredCommands.forEach((command) => { command.dispose(); });
    }

    public setExtensionFeatures(extensionFeatures: IFeature[]) {
        this.extensionFeatures = extensionFeatures;
    }

    public start() {
        this.sessionSettings = Settings.load();

        this.log.startNewLog(this.sessionSettings.developer.editorServicesLogLevel);

        // Create the PowerShell executable finder now
        this.powershellExeFinder = new PowerShellExeFinder(
            this.platformDetails,
            this.sessionSettings.powerShellAdditionalExePaths);

        this.focusConsoleOnExecute = this.sessionSettings.integratedConsole.focusConsoleOnExecute;

        this.createStatusBarItem();

        try {
            this.powerShellExePath = this.getPowerShellExePath();
        } catch (e) {
            this.log.writeError(`Error occurred while searching for a PowerShell executable:\n${e}`);
        }

        this.suppressRestartPrompt = false;

        if (!this.powerShellExePath) {
            const message = "Unable to find PowerShell."
                + " Do you have PowerShell installed?"
                + " You can also configure custom PowerShell installations"
                + " with the 'powershell.powerShellAdditionalExePaths' setting.";

            this.log.writeAndShowErrorWithActions(message, [
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

        if (this.inDevelopmentMode) {
            const devBundledModulesPath =
                path.resolve(
                    __dirname,
                    this.sessionSettings.developer.bundledModulesPath);

            // Make sure the module's bin path exists
            if (fs.existsSync(path.join(devBundledModulesPath, "PowerShellEditorServices/bin"))) {
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

        if (this.sessionSettings.developer.editorServicesWaitForDebugger) {
            this.editorServicesArgs += "-WaitForDebugger ";
        }
        if (this.sessionSettings.developer.editorServicesLogLevel) {
            this.editorServicesArgs += `-LogLevel '${this.sessionSettings.developer.editorServicesLogLevel}' `;
        }

        this.startPowerShell();
    }

    public stop() {

        // Shut down existing session if there is one
        this.log.write("Shutting down language client...");

        if (this.sessionStatus === SessionStatus.Failed) {
            // Before moving further, clear out the client and process if
            // the process is already dead (i.e. it crashed)
            this.languageServerClient = undefined;
            this.languageServerProcess = undefined;
        }

        this.sessionStatus = SessionStatus.Stopping;

        // Close the language server client
        if (this.languageServerClient !== undefined) {
            this.languageServerClient.stop();
            this.languageServerClient = undefined;
        }

        // Kill the PowerShell proceses we spawned
        if (this.debugSessionProcess) {
            this.debugSessionProcess.dispose();
        }
        if (this.languageServerProcess) {
            this.languageServerProcess.dispose();
        }

        this.sessionStatus = SessionStatus.NotStarted;
    }

    public getSessionDetails(): utils.IEditorServicesSessionDetails {
        return this.sessionDetails;
    }

    public getSessionStatus(): SessionStatus {
        return this.sessionStatus;
    }

    public getPowerShellVersionDetails(): IPowerShellVersionDetails {
        return this.versionDetails;
    }

    public createDebugSessionProcess(
        sessionPath: string,
        sessionSettings: Settings.ISettings): PowerShellProcess {

        this.debugSessionProcess =
            new PowerShellProcess(
                this.powerShellExePath,
                this.bundledModulesPath,
                "[TEMP] PowerShell Integrated Console",
                this.log,
                this.editorServicesArgs + "-DebugServiceOnly ",
                sessionPath,
                sessionSettings);

        return this.debugSessionProcess;
    }

    public getPowerShellExePath(): string {
        if (!this.sessionSettings.powerShellExePath &&
            this.sessionSettings.developer.powerShellExePath) {
            // Show deprecation message with fix action.
            // We don't need to wait on this to complete
            // because we can finish gathering the configured
            // PowerShell path without the fix
            this.showExePathSettingDeprecationWarning();
        }

        let powerShellExePath: string = this.getConfiguredPowerShellExePath().trim();

        // New versions of PS Core uninstall the previous version
        // so make sure the path stored in the settings exists.
        if (!fs.existsSync(powerShellExePath)) {
            this.log.write(
                `Path specified by 'powerShellExePath' setting - '${powerShellExePath}' - not found, ` +
                "reverting to default PowerShell path.");
            powerShellExePath = "";
        }

        if (powerShellExePath) {
            if (this.platformDetails.operatingSystem === OperatingSystem.Windows) {
                // Check the path bitness
                const fixedPath = this.powershellExeFinder.fixWindowsPowerShellPath(
                    powerShellExePath);

                if (fixedPath !== powerShellExePath) {
                    // Show deprecation message with fix action.
                    // We don't need to wait on this to complete
                    // because we can finish gathering the configured
                    // PowerShell path without the fix
                    this.showBitnessPathFixWarning(fixedPath);
                    powerShellExePath = fixedPath;
                }
            }

            return this.resolvePowerShellPath(powerShellExePath);
        }

        // No need to resolve this path, since the finder guarantees its existence
        const firstPowerShell = this.powershellExeFinder.getFirstAvailablePowerShellInstallation();
        return firstPowerShell && firstPowerShell.exePath || null;
    }

    // ----- LanguageClient middleware methods -----

    public resolveCodeLens(
        codeLens: vscode.CodeLens,
        token: vscode.CancellationToken,
        next: ResolveCodeLensSignature): vscode.ProviderResult<vscode.CodeLens> {
            const resolvedCodeLens = next(codeLens, token);
            const resolveFunc =
                (codeLensToFix: vscode.CodeLens): vscode.CodeLens => {
                    if (codeLensToFix.command.command === "editor.action.showReferences") {
                        const oldArgs = codeLensToFix.command.arguments;

                        // Our JSON objects don't get handled correctly by
                        // VS Code's built in editor.action.showReferences
                        // command so we need to convert them into the
                        // appropriate types to send them as command
                        // arguments.

                        codeLensToFix.command.arguments = [
                            vscode.Uri.parse(oldArgs[0]),
                            new vscode.Position(oldArgs[1].Line, oldArgs[1].Character),
                            oldArgs[2].map((position) => {
                                return new vscode.Location(
                                    vscode.Uri.parse(position.Uri),
                                    new vscode.Range(
                                        position.Range.Start.Line,
                                        position.Range.Start.Character,
                                        position.Range.End.Line,
                                        position.Range.End.Character));
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

    private async showExePathSettingDeprecationWarning(): Promise<void> {
        const choice: string = await vscode.window.showWarningMessage(
            "The 'powershell.developer.powerShellExePath' setting is deprecated, use " +
            "'powershell.powerShellExePath' instead.",
            "Fix Automatically");

        if (!choice) {
            return;
        }

        this.suppressRestartPrompt = true;
        await Settings.change("powerShellExePath", this.sessionSettings.developer.powerShellExePath, true);
        await Settings.change("developer.powerShellExePath", undefined, true);
        this.suppressRestartPrompt = false;
    }

    private async showBitnessPathFixWarning(fixedPath: string): Promise<void> {
        const bitness = this.platformDetails.isOS64Bit ? "64" : "32";

        const choice = await vscode.window.showWarningMessage(
            `The specified PowerShell path is incorrect for ${bitness}-bit VS Code, using '${fixedPath}' instead.`,
            "Fix Setting Automatically");

        if (!choice) {
            return;
        }

        this.suppressRestartPrompt = true;
        await Settings.change("powerShellExePath", this.sessionSettings.developer.powerShellExePath, true);
        await Settings.change("developer.powerShellExePath", undefined, true);
        this.suppressRestartPrompt = false;
    }

    private getConfiguredPowerShellExePath(): string {
        // If powershell.powerShellDefaultVersion specified, attempt to find the PowerShell exe path
        // of the version specified by the setting.
        if (this.sessionSettings.powerShellDefaultVersion && this.sessionStatus === SessionStatus.NeverStarted) {
            for (const pwshExe of this.powershellExeFinder.enumeratePowerShellInstallations()) {
                if (pwshExe.displayName === this.sessionSettings.powerShellDefaultVersion) {
                    return pwshExe.exePath;
                }
            }

            // Default PowerShell version was configured but we didn't find it
            this.log.writeWarning(
                `Could not find powerShellDefaultVersion: '${this.sessionSettings.powerShellDefaultVersion}'`);
        }

        if (this.sessionSettings.powerShellExePath) {
            return this.sessionSettings.powerShellExePath;
        }

        if (this.sessionSettings.developer.powerShellExePath) {
            this.showExePathSettingDeprecationWarning();
            return this.sessionSettings.developer.powerShellExePath;
        }

        return "";
    }

    private onConfigurationUpdated() {
        const settings = Settings.load();

        this.focusConsoleOnExecute = settings.integratedConsole.focusConsoleOnExecute;

        // Detect any setting changes that would affect the session
        if (!this.suppressRestartPrompt &&
            (settings.useX86Host !== this.sessionSettings.useX86Host ||
             settings.powerShellExePath.toLowerCase() !== this.sessionSettings.powerShellExePath.toLowerCase() ||
             (settings.developer.powerShellExePath ? settings.developer.powerShellExePath.toLowerCase() : null) !==
                (this.sessionSettings.developer.powerShellExePath
                    ? this.sessionSettings.developer.powerShellExePath.toLowerCase() : null) ||
             settings.developer.editorServicesLogLevel.toLowerCase() !==
                this.sessionSettings.developer.editorServicesLogLevel.toLowerCase() ||
             settings.developer.bundledModulesPath.toLowerCase() !==
                this.sessionSettings.developer.bundledModulesPath.toLowerCase())) {

            vscode.window.showInformationMessage(
                "The PowerShell runtime configuration has changed, would you like to start a new session?",
                "Yes", "No")
                .then((response) => {
                    if (response === "Yes") {
                        this.restartSession();
                    }
                });
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

        this.setSessionStatus(
            versionString,
            SessionStatus.Running);
    }

    private registerCommands(): void {
        this.registeredCommands = [
            vscode.commands.registerCommand("PowerShell.RestartSession", () => { this.restartSession(); }),
            vscode.commands.registerCommand(this.ShowSessionMenuCommandName, () => { this.showSessionMenu(); }),
            vscode.workspace.onDidChangeConfiguration(() => this.onConfigurationUpdated()),
            vscode.commands.registerCommand(
                "PowerShell.ShowSessionConsole", (isExecute?: boolean) => { this.showSessionConsole(isExecute); }),
        ];
    }

    private startPowerShell() {

        this.setSessionStatus(
            "Starting PowerShell...",
            SessionStatus.Initializing);

        const sessionFilePath =
            utils.getSessionFilePath(
                Math.floor(100000 + Math.random() * 900000));

        this.languageServerProcess =
            new PowerShellProcess(
                this.powerShellExePath,
                this.bundledModulesPath,
                "PowerShell Integrated Console",
                this.log,
                this.editorServicesArgs,
                sessionFilePath,
                this.sessionSettings);

        this.languageServerProcess.onExited(
            () => {
                if (this.sessionStatus === SessionStatus.Running) {
                    this.setSessionStatus("Session exited", SessionStatus.Failed);
                    this.promptForRestart();
                }
            });

        this.languageServerProcess
            .start("EditorServices")
            .then(
                (sessionDetails) => {
                    this.sessionDetails = sessionDetails;

                    if (sessionDetails.status === "started") {
                        this.log.write("Language server started.");

                        // Start the language service client
                        this.startLanguageClient(sessionDetails);
                    } else if (sessionDetails.status === "failed") {
                        if (sessionDetails.reason === "unsupported") {
                            this.setSessionFailure(
                                "PowerShell language features are only supported on PowerShell version 5.1 and 6.1" +
                                ` and above. The current version is ${sessionDetails.powerShellVersion}.`);
                        } else if (sessionDetails.reason === "languageMode") {
                            this.setSessionFailure(
                                "PowerShell language features are disabled due to an unsupported LanguageMode: " +
                                `${sessionDetails.detail}`);
                        } else {
                            this.setSessionFailure(
                                `PowerShell could not be started for an unknown reason '${sessionDetails.reason}'`);
                        }
                    } else {
                        // TODO: Handle other response cases
                    }
                },
                (error) => {
                    this.log.write("Language server startup failed.");
                    this.setSessionFailure("The language service could not be started: ", error);
                },
            );
    }

    private promptForRestart() {
        vscode.window.showErrorMessage(
            "The PowerShell session has terminated due to an error, would you like to restart it?",
            "Yes", "No")
            .then((answer) => { if (answer === "Yes") { this.restartSession(); }});
    }

    private startLanguageClient(sessionDetails: utils.IEditorServicesSessionDetails) {
        // Log the session details object
        this.log.write(JSON.stringify(sessionDetails));

        try {
            this.log.write(`Connecting to language service on pipe ${sessionDetails.languageServicePipeName}...`);

            const connectFunc = () => {
                return new Promise<StreamInfo>(
                    (resolve, reject) => {
                        const socket = net.connect(sessionDetails.languageServicePipeName);
                        socket.on(
                            "connect",
                            () => {
                                this.log.write("Language service connected.");
                                resolve({writer: socket, reader: socket});
                            });
                    });
            };

            const clientOptions: LanguageClientOptions = {
                documentSelector: this.documentSelector,
                synchronize: {
                    configurationSection: utils.PowerShellLanguageId,
                    // fileEvents: vscode.workspace.createFileSystemWatcher('**/.eslintrc')
                },
                errorHandler: {
                    // Override the default error handler to prevent it from
                    // closing the LanguageClient incorrectly when the socket
                    // hangs up (ECONNRESET errors).
                    error: (error: any, message: Message, count: number): ErrorAction => {
                        // TODO: Is there any error worth terminating on?
                        return ErrorAction.Continue;
                    },
                    closed: () => {
                        // We have our own restart experience
                        return CloseAction.DoNotRestart;
                    },
                },
                revealOutputChannelOn: RevealOutputChannelOn.Never,
                middleware: this,
            };

            this.languageServerClient =
                new LanguageClient(
                    "PowerShell Editor Services",
                    connectFunc,
                    clientOptions);

            this.languageServerClient.onReady().then(
                () => {
                    this.languageServerClient
                        .sendRequest(PowerShellVersionRequestType)
                        .then(
                            async (versionDetails) => {
                                this.versionDetails = versionDetails;

                                if (!this.inDevelopmentMode) {
                                    this.telemetryReporter.sendTelemetryEvent("powershellVersionCheck",
                                        { powershellVersion: versionDetails.version });
                                }

                                this.setSessionStatus(
                                    this.versionDetails.architecture === "x86"
                                        ? `${this.versionDetails.displayVersion} (${this.versionDetails.architecture})`
                                        : this.versionDetails.displayVersion,
                                    SessionStatus.Running);

                                // If the user opted to not check for updates, then don't.
                                if (!this.sessionSettings.promptToUpdatePowerShell) { return; }

                                try {
                                    const localVersion = semver.parse(this.versionDetails.version);
                                    if (semver.lt(localVersion, "6.0.0")) {
                                        // Skip prompting when using Windows PowerShell for now.
                                        return;
                                    }

                                    // Fetch the latest PowerShell releases from GitHub.
                                    const isPreRelease = !!semver.prerelease(localVersion);
                                    const release: GitHubReleaseInformation =
                                        await GitHubReleaseInformation.FetchLatestRelease(isPreRelease);

                                    await InvokePowerShellUpdateCheck(
                                        this.languageServerClient,
                                        localVersion,
                                        this.versionDetails.architecture,
                                        release);
                                } catch (e) {
                                    // best effort. This probably failed to fetch the data from GitHub.
                                    this.log.writeWarning(e.message);
                                }
                            });

                    // Send the new LanguageClient to extension features
                    // so that they can register their message handlers
                    // before the connection is established.
                    this.updateExtensionFeatures(this.languageServerClient);
                    this.languageServerClient.onNotification(
                        RunspaceChangedEventType,
                        (runspaceDetails) => { this.setStatusBarVersionString(runspaceDetails); });
                },
                (reason) => {
                    this.setSessionFailure("Could not start language service: ", reason);
                });

            this.languageServerClient.start();
        } catch (e) {
            this.setSessionFailure("The language service could not be started: ", e);
        }
    }

    private updateExtensionFeatures(languageClient: LanguageClient) {
        this.extensionFeatures.forEach((feature) => {
            feature.setLanguageClient(languageClient);
        });
    }

    private restartSession() {
        this.stop();
        this.start();
    }

    private createStatusBarItem() {
        if (this.statusBarItem === undefined) {
            // Create the status bar item and place it right next
            // to the language indicator
            this.statusBarItem =
                vscode.window.createStatusBarItem(
                    vscode.StatusBarAlignment.Right,
                    1);

            this.statusBarItem.command = this.ShowSessionMenuCommandName;
            this.statusBarItem.tooltip = "Show PowerShell Session Menu";
            this.statusBarItem.show();
            vscode.window.onDidChangeActiveTextEditor((textEditor) => {
                if (textEditor === undefined
                    || textEditor.document.languageId !== "powershell") {
                    this.statusBarItem.hide();
                } else {
                    this.statusBarItem.show();
                }
            });
        }
    }

    private setSessionStatus(statusText: string, status: SessionStatus): void {
        // Set color and icon for 'Running' by default
        let statusIconText = "$(terminal) ";
        let statusColor = "#affc74";

        if (status === SessionStatus.Initializing) {
            statusIconText = "$(sync) ";
            statusColor = "#f3fc74";
        } else if (status === SessionStatus.Failed) {
            statusIconText = "$(alert) ";
            statusColor = "#fcc174";
        }

        this.sessionStatus = status;
        this.statusBarItem.color = statusColor;
        this.statusBarItem.text = statusIconText + statusText;
    }

    private setSessionFailure(message: string, ...additionalMessages: string[]) {
        this.log.writeAndShowError(message, ...additionalMessages);

        this.setSessionStatus(
            "Initialization Error",
            SessionStatus.Failed);
    }

    private changePowerShellExePath(exePath: string) {
        this.suppressRestartPrompt = true;
        Settings
            .change("powerShellExePath", exePath, true)
            .then(() => this.restartSession());
    }

    private resolvePowerShellPath(powerShellExePath: string): string {
        const resolvedPath = path.resolve(__dirname, powerShellExePath);

        // If the path does not exist, show an error
        if (!utils.checkIfFileExists(resolvedPath)) {
            const pwshPath = resolvedPath || powerShellExePath;
            const pwshExeName = path.basename(pwshPath) || "PowerShell executable";

            this.setSessionFailure(`${pwshExeName} cannot be found or is not accessible at path '${pwshPath}'`);

            return null;
        }

        return resolvedPath;
    }

    private getPowerShellVersionLabel(): string {
        if (this.powerShellExePath) {
            const powerShellCommandLine = [
                this.powerShellExePath,
                "-NoProfile",
                "-NonInteractive",
            ];

            // Only add ExecutionPolicy param on Windows
            if (utils.isWindowsOS()) {
                powerShellCommandLine.push("-ExecutionPolicy", "Bypass");
            }

            powerShellCommandLine.push(
                "-Command",
                "'$PSVersionTable | ConvertTo-Json'");

            const powerShellOutput = cp.execSync(powerShellCommandLine.join(" "));
            const versionDetails = JSON.parse(powerShellOutput.toString());
            return versionDetails.PSVersion.Label;
        } else {
            // TODO: throw instead?
            return null;
        }
    }

    private showSessionConsole(isExecute?: boolean) {
        if (this.languageServerProcess) {
            this.languageServerProcess.showConsole(isExecute && !this.focusConsoleOnExecute);
        }
    }

    private showSessionMenu() {
        const currentExePath = (this.powerShellExePath || "").toLowerCase();
        const availablePowerShellExes = this.powershellExeFinder.getAllAvailablePowerShellInstallations();

        let sessionText: string;

        switch (this.sessionStatus) {
            case SessionStatus.Running:
            case SessionStatus.Initializing:
            case SessionStatus.NotStarted:
            case SessionStatus.NeverStarted:
            case SessionStatus.Stopping:
                const currentPowerShellExe =
                availablePowerShellExes
                    .find((item) => item.exePath.toLowerCase() === currentExePath);

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
                .filter((item) => item.exePath.toLowerCase() !== currentExePath)
                .map((item) => {
                    return new SessionMenuItem(
                        `Switch to: ${item.displayName}`,
                        () => { this.changePowerShellExePath(item.exePath); });
                });

        const menuItems: SessionMenuItem[] = [
            new SessionMenuItem(
                sessionText,
                () => { vscode.commands.executeCommand("PowerShell.ShowLogs"); }),

            new SessionMenuItem(
                "Restart Current Session",
                () => { this.restartSession(); }),

            // Add all of the different PowerShell options
            ...powerShellItems,

            new SessionMenuItem(
                "Open Session Logs Folder",
                () => { vscode.commands.executeCommand("PowerShell.OpenLogFolder"); }),
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
        public readonly callback: () => void = () => {}) {
    }
}

export const PowerShellVersionRequestType =
    new RequestType0<IPowerShellVersionDetails, void, void>(
        "powerShell/getVersion");

export const RunspaceChangedEventType =
    new NotificationType<IRunspaceDetails, void>(
        "powerShell/runspaceChanged");

export enum RunspaceType {
    Local,
    Process,
    Remote,
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
