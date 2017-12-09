/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import os = require('os');
import fs = require('fs');
import net = require('net');
import path = require('path');
import utils = require('./utils');
import vscode = require('vscode');
import cp = require('child_process');
import Settings = require('./settings');

import { Logger } from './logging';
import { IFeature } from './feature';
import { Message } from 'vscode-jsonrpc';
import { PowerShellProcess } from './process';
import { StringDecoder } from 'string_decoder';

import {
    LanguageClient, LanguageClientOptions, Executable,
    RequestType, RequestType0, NotificationType,
    StreamInfo, ErrorAction, CloseAction, RevealOutputChannelOn,
    Middleware, ResolveCodeLensSignature } from 'vscode-languageclient';

import {
    OperatingSystem, IPlatformDetails, getDefaultPowerShellPath,
    getPlatformDetails, fixWindowsPowerShellPath,
    getAvailablePowerShellExes } from './platform';

export enum SessionStatus {
    NotStarted,
    Initializing,
    Running,
    Stopping,
    Failed
}

export class SessionManager implements Middleware {

    private ShowSessionMenuCommandName = "PowerShell.ShowSessionMenu";

    private hostVersion: string;
    private editorServicesArgs: string;
    private powerShellExePath: string = "";
    private sessionStatus: SessionStatus;
    private suppressRestartPrompt: boolean;
    private focusConsoleOnExecute: boolean;
    private platformDetails: IPlatformDetails;
    private extensionFeatures: IFeature[] = [];
    private statusBarItem: vscode.StatusBarItem;
    private languageServerProcess: PowerShellProcess;
    private debugSessionProcess: PowerShellProcess;
    private versionDetails: PowerShellVersionDetails;
    private registeredCommands: vscode.Disposable[] = [];
    private languageServerClient: LanguageClient = undefined;
    private sessionSettings: Settings.ISettings = undefined;
    private sessionDetails: utils.IEditorServicesSessionDetails;

    // When in development mode, VS Code's session ID is a fake
    // value of "someValue.machineId".  Use that to detect dev
    // mode for now until Microsoft/vscode#10272 gets implemented.
    private readonly inDevelopmentMode =
        vscode.env.sessionId === "someValue.sessionId";

    constructor(
        private requiredEditorServicesVersion: string,
        private log: Logger) {

        this.platformDetails = getPlatformDetails();

        // Get the current version of this extension
        this.hostVersion =
            vscode
                .extensions
                .getExtension("ms-vscode.PowerShell")
                .packageJSON
                .version;

        let osBitness = this.platformDetails.isOS64Bit ? "64-bit" : "32-bit";
        let procBitness = this.platformDetails.isProcess64Bit ? "64-bit" : "32-bit";

        this.log.write(
            `Visual Studio Code v${vscode.version} ${procBitness}`,
            `PowerShell Extension v${this.hostVersion}`,
            `Operating System: ${OperatingSystem[this.platformDetails.operatingSystem]} ${osBitness}`);

        // Fix the host version so that PowerShell can consume it.
        // This is needed when the extension uses a prerelease
        // version string like 0.9.1-insiders-1234.
        this.hostVersion = this.hostVersion.split('-')[0];

        this.registerCommands();
    }

    public setExtensionFeatures(extensionFeatures: IFeature[]) {
        this.extensionFeatures = extensionFeatures;
    }

    public start() {
        this.sessionSettings = Settings.load();
        this.log.startNewLog(this.sessionSettings.developer.editorServicesLogLevel);

        this.focusConsoleOnExecute = this.sessionSettings.integratedConsole.focusConsoleOnExecute;

        this.createStatusBarItem();

        this.powerShellExePath = this.getPowerShellExePath();

        // Check for OpenSSL dependency on macOS when running PowerShell Core alpha. Look for the default
        // Homebrew installation path and if that fails check the system-wide library path.
        if (os.platform() == "darwin" && this.getPowerShellVersionLabel() == "alpha") {
            if (!(utils.checkIfFileExists("/usr/local/opt/openssl/lib/libcrypto.1.0.0.dylib") &&
                    utils.checkIfFileExists("/usr/local/opt/openssl/lib/libssl.1.0.0.dylib")) &&
                !(utils.checkIfFileExists("/usr/local/lib/libcrypto.1.0.0.dylib") &&
                    utils.checkIfFileExists("/usr/local/lib/libssl.1.0.0.dylib"))) {
                    var thenable =
                        vscode.window.showWarningMessage(
                            "The PowerShell extension will not work without OpenSSL on macOS and OS X when using PowerShell alpha",
                            "Show Documentation");

                    thenable.then(
                        (s) => {
                            if (s === "Show Documentation") {
                                cp.exec("open https://github.com/PowerShell/vscode-powershell/blob/master/docs/troubleshooting.md#1-powershell-intellisense-does-not-work-cant-debug-scripts");
                            }
                        });

                    // Don't continue initializing since Editor Services will not load successfully
                    this.setSessionFailure("Cannot start PowerShell Editor Services due to missing OpenSSL dependency.");
                    return;
            }
        }

        this.suppressRestartPrompt = false;

        if (this.powerShellExePath) {

            var bundledModulesPath = path.resolve(__dirname, "../../modules");

            if (this.inDevelopmentMode) {
                var devBundledModulesPath =
                    // this.sessionSettings.developer.bundledModulesPath ||
                    path.resolve(
                        __dirname,
                        this.sessionSettings.developer.bundledModulesPath ||
                        "../../../PowerShellEditorServices/module");

                // Make sure the module's bin path exists
                if (fs.existsSync(path.join(devBundledModulesPath, "PowerShellEditorServices/bin"))) {
                    bundledModulesPath = devBundledModulesPath;
                }
                else {
                    this.log.write(
                        `\nWARNING: In development mode but PowerShellEditorServices dev module path cannot be found (or has not been built yet): ${devBundledModulesPath}\n`);
                }
            }

            this.editorServicesArgs =
                "-EditorServicesVersion '" + this.requiredEditorServicesVersion + "' " +
                "-HostName 'Visual Studio Code Host' " +
                "-HostProfileId 'Microsoft.VSCode' " +
                "-HostVersion '" + this.hostVersion + "' " +
                "-AdditionalModules @('PowerShellEditorServices.VSCode') " +
                "-BundledModulesPath '" + bundledModulesPath + "' " +
                "-EnableConsoleRepl ";

            if (this.sessionSettings.developer.editorServicesWaitForDebugger) {
                this.editorServicesArgs += '-WaitForDebugger ';
            }
            if (this.sessionSettings.developer.editorServicesLogLevel) {
                this.editorServicesArgs += "-LogLevel '" + this.sessionSettings.developer.editorServicesLogLevel + "' "
            }

            this.startPowerShell(
                this.powerShellExePath,
                this.sessionSettings.developer.powerShellExeIsWindowsDevBuild,
                bundledModulesPath,
                this.editorServicesArgs);
        }
        else {
            this.setSessionFailure("PowerShell could not be started, click 'Show Logs' for more details.");
        }
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

    public getPowerShellVersionDetails() : PowerShellVersionDetails {
        return this.versionDetails;
    }

    public dispose() : void {
        // Stop the current session
        this.stop();

        // Dispose of all commands
        this.registeredCommands.forEach(command => { command.dispose(); });
    }

    public createDebugSessionProcess(
        sessionPath: string,
        sessionSettings: Settings.ISettings): PowerShellProcess {

        this.debugSessionProcess =
            new PowerShellProcess(
                this.powerShellExePath,
                "[DBG] PowerShell Integrated Console",
                this.log,
                this.editorServicesArgs + "-DebugServiceOnly ",
                sessionPath,
                sessionSettings);

        return this.debugSessionProcess;
    }

    private onConfigurationUpdated() {
        var settings = Settings.load();

        this.focusConsoleOnExecute = settings.integratedConsole.focusConsoleOnExecute;

        // Detect any setting changes that would affect the session
        if (!this.suppressRestartPrompt &&
            (settings.useX86Host !== this.sessionSettings.useX86Host ||
             settings.powerShellExePath.toLowerCase() !== this.sessionSettings.powerShellExePath.toLowerCase() ||
             settings.developer.powerShellExePath.toLowerCase() !== this.sessionSettings.developer.powerShellExePath.toLowerCase() ||
             settings.developer.editorServicesLogLevel.toLowerCase() !== this.sessionSettings.developer.editorServicesLogLevel.toLowerCase() ||
             settings.developer.bundledModulesPath.toLowerCase() !== this.sessionSettings.developer.bundledModulesPath.toLowerCase())) {

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

    private setStatusBarVersionString(
        runspaceDetails: RunspaceDetails) {

        var versionString =
            this.versionDetails.architecture === "x86"
                ? `${runspaceDetails.powerShellVersion.displayVersion} (${runspaceDetails.powerShellVersion.architecture})`
                : runspaceDetails.powerShellVersion.displayVersion;

        if (runspaceDetails.runspaceType != RunspaceType.Local) {
            versionString += ` [${runspaceDetails.connectionString}]`
        }

        this.setSessionStatus(
            versionString,
            SessionStatus.Running);
    }

    private registerCommands() : void {
        this.registeredCommands = [
            vscode.commands.registerCommand('PowerShell.RestartSession', () => { this.restartSession(); }),
            vscode.commands.registerCommand(this.ShowSessionMenuCommandName, () => { this.showSessionMenu(); }),
            vscode.workspace.onDidChangeConfiguration(() => this.onConfigurationUpdated()),
            vscode.commands.registerCommand('PowerShell.ShowSessionConsole', (isExecute?: boolean) => { this.showSessionConsole(isExecute); })
        ]
    }

    private startPowerShell(
        powerShellExePath: string,
        isWindowsDevBuild: boolean,
        bundledModulesPath: string,
        startArgs: string) {

        this.setSessionStatus(
            "Starting PowerShell...",
            SessionStatus.Initializing);

        var sessionFilePath =
            utils.getSessionFilePath(
                Math.floor(100000 + Math.random() * 900000));

        this.languageServerProcess =
            new PowerShellProcess(
                this.powerShellExePath,
                "PowerShell Integrated Console",
                this.log,
                startArgs,
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
                sessionDetails => {
                    this.sessionDetails = sessionDetails;

                    if (sessionDetails.status === "started") {
                        this.log.write("Language server started.");

                        // Start the language service client
                        this.startLanguageClient(sessionDetails);
                    }
                    else if (sessionDetails.status === "failed") {
                        if (sessionDetails.reason === "unsupported") {
                            this.setSessionFailure(
                                `PowerShell language features are only supported on PowerShell version 3 and above.  The current version is ${sessionDetails.powerShellVersion}.`)
                        }
                        else if (sessionDetails.reason === "languageMode") {
                            this.setSessionFailure(
                                `PowerShell language features are disabled due to an unsupported LanguageMode: ${sessionDetails.detail}`);
                        }
                        else {
                            this.setSessionFailure(`PowerShell could not be started for an unknown reason '${sessionDetails.reason}'`)
                        }
                    }
                    else {
                        // TODO: Handle other response cases
                    }
                },
                error => {
                    this.log.write("Language server startup failed.");
                    this.setSessionFailure("The language service could not be started: ", error);
                }
            );
    }

    private promptForRestart() {
        vscode.window.showErrorMessage(
            "The PowerShell session has terminated due to an error, would you like to restart it?",
            "Yes", "No")
            .then((answer) => { if (answer === "Yes") { this.restartSession(); }});
    }

    private startLanguageClient(sessionDetails: utils.IEditorServicesSessionDetails) {

        var port = sessionDetails.languageServicePort;

        // Log the session details object
        this.log.write(JSON.stringify(sessionDetails));

        try
        {
            this.log.write("Connecting to language service on port " + port + "...");

            let connectFunc = () => {
                return new Promise<StreamInfo>(
                    (resolve, reject) => {
                        var socket = net.connect(port);
                        socket.on(
                            'connect',
                            () => {
                                this.log.write("Language service connected.");
                                resolve({writer: socket, reader: socket})
                            });
                    });
            };

            let clientOptions: LanguageClientOptions = {
                documentSelector: [utils.PowerShellLanguageId],
                synchronize: {
                    configurationSection: utils.PowerShellLanguageId,
                    //fileEvents: vscode.workspace.createFileSystemWatcher('**/.eslintrc')
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
                        return CloseAction.DoNotRestart
                    }
                },
                revealOutputChannelOn: RevealOutputChannelOn.Never,
                middleware: this
            }

            this.languageServerClient =
                new LanguageClient(
                    'PowerShell Editor Services',
                    connectFunc,
                    clientOptions);

            this.languageServerClient.onReady().then(
                () => {
                    this.languageServerClient
                        .sendRequest(PowerShellVersionRequest.type)
                        .then(
                            (versionDetails) => {
                                this.versionDetails = versionDetails;
                                this.setSessionStatus(
                                    this.versionDetails.architecture === "x86"
                                        ? `${this.versionDetails.displayVersion} (${this.versionDetails.architecture})`
                                        : this.versionDetails.displayVersion,
                                    SessionStatus.Running);
                            });

                    // Send the new LanguageClient to extension features
                    // so that they can register their message handlers
                    // before the connection is established.
                    this.updateExtensionFeatures(this.languageServerClient);
                    this.languageServerClient.onNotification(
                        RunspaceChangedEvent.type,
                        (runspaceDetails) => { this.setStatusBarVersionString(runspaceDetails); });
                },
                (reason) => {
                    this.setSessionFailure("Could not start language service: ", reason);
                });


            this.languageServerClient.start();
        }
        catch (e)
        {
            this.setSessionFailure("The language service could not be started: ", e);
        }
    }

    private updateExtensionFeatures(languageClient: LanguageClient) {
        this.extensionFeatures.forEach(feature => {
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
            vscode.window.onDidChangeActiveTextEditor(textEditor => {
                if (textEditor === undefined
                    || textEditor.document.languageId !== "powershell") {
                    this.statusBarItem.hide();
                }
                else {
                    this.statusBarItem.show();
                }
            })
        }
    }

    private setSessionStatus(statusText: string, status: SessionStatus): void {
        // Set color and icon for 'Running' by default
        var statusIconText = "$(terminal) ";
        var statusColor = "#affc74";

        if (status == SessionStatus.Initializing) {
            statusIconText = "$(sync) ";
            statusColor = "#f3fc74";
        }
        else if (status == SessionStatus.Failed) {
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

    public getPowerShellExePath(): string {

        if (!this.sessionSettings.powerShellExePath &&
            this.sessionSettings.developer.powerShellExePath)
        {
            // Show deprecation message with fix action.
            // We don't need to wait on this to complete
            // because we can finish gathering the configured
            // PowerShell path without the fix
            vscode
                .window
                .showWarningMessage(
                    "The 'powershell.developer.powerShellExePath' setting is deprecated, use 'powershell.powerShellExePath' instead.",
                    "Fix Automatically")
                .then(choice => {
                    if (choice) {
                        this.suppressRestartPrompt = true;
                        Settings
                            .change(
                                "powerShellExePath",
                                this.sessionSettings.developer.powerShellExePath,
                                true)
                            .then(() => {
                                return Settings.change(
                                    "developer.powerShellExePath",
                                    undefined,
                                    true)
                            })
                            .then(() => {
                                this.suppressRestartPrompt = false;
                            });
                    }
                });
        }

        // Is there a setting override for the PowerShell path?
        var powerShellExePath =
            (this.sessionSettings.powerShellExePath ||
             this.sessionSettings.developer.powerShellExePath ||
             "").trim();

        // New versions of PS Core uninstall the previous version
        // so make sure the path stored in the settings exists.
        if (!fs.existsSync(powerShellExePath)) {
            this.log.write(
                `Path specified by 'powerShellExePath' setting - '${powerShellExePath}' - not found, reverting to default PowerShell path.`);
            powerShellExePath = "";
        }

        if (this.platformDetails.operatingSystem === OperatingSystem.Windows &&
            powerShellExePath.length > 0) {

            // Check the path bitness
            let fixedPath =
                fixWindowsPowerShellPath(
                    powerShellExePath,
                    this.platformDetails);

            if (fixedPath !== powerShellExePath) {
                let bitness = this.platformDetails.isOS64Bit ? 64 : 32;
                // Show deprecation message with fix action.
                // We don't need to wait on this to complete
                // because we can finish gathering the configured
                // PowerShell path without the fix
                vscode
                    .window
                    .showWarningMessage(
                        `The specified PowerShell path is incorrect for ${bitness}-bit VS Code, using '${fixedPath}' instead.`,
                        "Fix Setting Automatically")
                    .then(choice => {
                        if (choice) {
                            this.suppressRestartPrompt = true;
                            Settings
                                .change(
                                    "powerShellExePath",
                                    this.sessionSettings.developer.powerShellExePath,
                                    true)
                                .then(() => {
                                    return Settings.change(
                                        "developer.powerShellExePath",
                                        undefined,
                                        true)
                                })
                                .then(() => {
                                    this.suppressRestartPrompt = false;
                                });
                        }
                    });

                powerShellExePath = fixedPath;
            }
        }

        return powerShellExePath.length > 0
            ? this.resolvePowerShellPath(powerShellExePath)
            : getDefaultPowerShellPath(this.platformDetails, this.sessionSettings.useX86Host);
    }

    private changePowerShellExePath(exePath: string) {
        this.suppressRestartPrompt = true;
        Settings
            .change("powerShellExePath", exePath, true)
            .then(() => this.restartSession());
    }

    private resolvePowerShellPath(powerShellExePath: string): string {
        var resolvedPath = path.resolve(__dirname, powerShellExePath);

        // If the path does not exist, show an error
        if (!utils.checkIfFileExists(resolvedPath)) {
            this.setSessionFailure(
                "powershell.exe cannot be found or is not accessible at path " + resolvedPath);

            return null;
        }

        return resolvedPath;
    }

    private getPowerShellVersionLabel(): string {
        if (this.powerShellExePath) {
            var powerShellCommandLine = [
                this.powerShellExePath,
                "-NoProfile",
                "-NonInteractive"
            ];

            // Only add ExecutionPolicy param on Windows
            if (utils.isWindowsOS()) {
                powerShellCommandLine.push("-ExecutionPolicy", "Bypass")
            }

            powerShellCommandLine.push(
                "-Command",
                "'$PSVersionTable | ConvertTo-Json'");

            var powerShellOutput = cp.execSync(powerShellCommandLine.join(' '));
            var versionDetails = JSON.parse(powerShellOutput.toString());
            return versionDetails.PSVersion.Label;
        }
        else {
            // TODO: throw instead?
            return null;
        }
    }

    private showSessionConsole(isExecute?: boolean) {
        if (this.languageServerProcess) {
            this.languageServerProcess.showConsole(
                isExecute && !this.focusConsoleOnExecute);
        }
    }

    private showSessionMenu() {
        var menuItems: SessionMenuItem[] = [];

        if (this.sessionStatus === SessionStatus.Running) {
            menuItems = [
                new SessionMenuItem(
                    `Current session: PowerShell ${this.versionDetails.displayVersion} (${this.versionDetails.architecture}) ${this.versionDetails.edition} Edition [${this.versionDetails.version}]`,
                    () => { vscode.commands.executeCommand("PowerShell.ShowLogs"); }),

                new SessionMenuItem(
                    "Restart Current Session",
                    () => { this.restartSession(); }),
            ];
        }
        else if (this.sessionStatus === SessionStatus.Failed) {
            menuItems = [
                new SessionMenuItem(
                    `Session initialization failed, click here to show PowerShell extension logs`,
                    () => { vscode.commands.executeCommand("PowerShell.ShowLogs"); }),
            ];
        }

        var currentExePath = (this.powerShellExePath || "").toLowerCase();
        var powerShellItems =
            getAvailablePowerShellExes(this.platformDetails)
                .filter(item => item.exePath.toLowerCase() !== currentExePath)
                .map(item => {
                    return new SessionMenuItem(
                        `Switch to ${item.versionName}`,
                        () => { this.changePowerShellExePath(item.exePath) });
                });

        menuItems = menuItems.concat(powerShellItems);

        menuItems.push(
            new SessionMenuItem(
                "Open Session Logs Folder",
                () => { vscode.commands.executeCommand("PowerShell.OpenLogFolder"); }));

        vscode
            .window
            .showQuickPick<SessionMenuItem>(menuItems)
            .then((selectedItem) => { selectedItem.callback(); });
    }

    // ----- LanguageClient middleware methods -----

    resolveCodeLens(
        codeLens: vscode.CodeLens,
        token: vscode.CancellationToken,
        next: ResolveCodeLensSignature): vscode.ProviderResult<vscode.CodeLens> {
            var resolvedCodeLens = next(codeLens, token);

            let resolveFunc =
                (codeLens: vscode.CodeLens): vscode.CodeLens => {
                    if (codeLens.command.command === "editor.action.showReferences") {
                        var oldArgs = codeLens.command.arguments;

                        // Our JSON objects don't get handled correctly by
                        // VS Code's built in editor.action.showReferences
                        // command so we need to convert them into the
                        // appropriate types to send them as command
                        // arguments.

                        codeLens.command.arguments = [
                            vscode.Uri.parse(oldArgs[0]),
                            new vscode.Position(oldArgs[1].line, oldArgs[1].character),
                            oldArgs[2].map(position => {
                                return new vscode.Location(
                                    vscode.Uri.parse(position.uri),
                                    new vscode.Range(
                                        position.range.start.line,
                                        position.range.start.character,
                                        position.range.end.line,
                                        position.range.end.character));
                            })
                        ]
                    }

                    return codeLens;
                }

            if ((<Thenable<vscode.CodeLens>>resolvedCodeLens).then) {
                return (<Thenable<vscode.CodeLens>>resolvedCodeLens).then(resolveFunc);
            }
            else if (<vscode.CodeLens>resolvedCodeLens) {
                return resolveFunc(<vscode.CodeLens>resolvedCodeLens);
            }

            return resolvedCodeLens;
    }
}

class SessionMenuItem implements vscode.QuickPickItem {
    public description: string;

    constructor(
        public readonly label: string,
        public readonly callback: () => void = () => { })
    {
    }
}

export namespace PowerShellVersionRequest {
    export const type = new RequestType0<PowerShellVersionDetails, void, void>('powerShell/getVersion');
}

export interface PowerShellVersionDetails {
    version: string;
    displayVersion: string;
    edition: string;
    architecture: string;
}

export enum RunspaceType {
    Local,
    Process,
    Remote
}

export interface RunspaceDetails {
    powerShellVersion: PowerShellVersionDetails;
    runspaceType: RunspaceType;
    connectionString: string;
}

export namespace RunspaceChangedEvent {
    export const type = new NotificationType<RunspaceDetails, void>('powerShell/runspaceChanged');
}
