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
    private isWindowsOS: boolean;
    private editorServicesArgs: string;
    private powerShellExePath: string = "";
    private sessionStatus: SessionStatus;
    private suppressRestartPrompt: boolean;
    private focusConsoleOnExecute: boolean;
    private extensionFeatures: IFeature[] = [];
    private statusBarItem: vscode.StatusBarItem;
    private languageServerProcess: PowerShellProcess;
    private debugSessionProcess: PowerShellProcess;
    private versionDetails: PowerShellVersionDetails;
    private registeredCommands: vscode.Disposable[] = [];
    private languageServerClient: LanguageClient = undefined;
    private sessionSettings: Settings.ISettings = undefined;
    private sessionDetails: utils.EditorServicesSessionDetails;

    // When in development mode, VS Code's session ID is a fake
    // value of "someValue.machineId".  Use that to detect dev
    // mode for now until Microsoft/vscode#10272 gets implemented.
    private readonly inDevelopmentMode =
        vscode.env.sessionId === "someValue.sessionId";

    constructor(
        private requiredEditorServicesVersion: string,
        private log: Logger) {

        this.isWindowsOS = os.platform() == "win32";

        // Get the current version of this extension
        this.hostVersion =
            vscode
                .extensions
                .getExtension("ms-vscode.PowerShell")
                .packageJSON
                .version;

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

            var bundledModulesPath = path.resolve(__dirname, "../modules");

            if (this.inDevelopmentMode) {
                var devBundledModulesPath =
                    // this.sessionSettings.developer.bundledModulesPath ||
                    path.resolve(
                        __dirname,
                        this.sessionSettings.developer.bundledModulesPath ||
                        "../../PowerShellEditorServices/module");

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
        this.log.write(os.EOL + os.EOL + "Shutting down language client...");

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

    public getSessionDetails(): utils.EditorServicesSessionDetails {
        return this.sessionDetails;
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
                        this.log.write(`${utils.getTimestampString()} Language server started.`);

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
                    this.log.write(`${utils.getTimestampString()} Language server startup failed.`);
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

    private startLanguageClient(sessionDetails: utils.EditorServicesSessionDetails) {

        var port = sessionDetails.languageServicePort;

        // Log the session details object
        this.log.write(JSON.stringify(sessionDetails));

        try
        {
            this.log.write("Connecting to language service on port " + port + "..." + os.EOL);

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

    private getPowerShellExePath(): string {

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

        return powerShellExePath.length > 0
            ? this.resolvePowerShellPath(powerShellExePath)
            : this.getDefaultPowerShellPath(this.sessionSettings.useX86Host);
    }

    private changePowerShellExePath(exePath: string) {
        this.suppressRestartPrompt = true;
        Settings
            .change("powerShellExePath", exePath, true)
            .then(() => this.restartSession());
    }

    private getPowerShellExeItems(): PowerShellExeDetails[] {

        var paths: PowerShellExeDetails[] = [];

        if (this.isWindowsOS) {
            const is64Bit = process.env.hasOwnProperty('PROCESSOR_ARCHITEW6432');
            const rootInstallPath = (is64Bit ? process.env.ProgramW6432 : process.env.ProgramFiles) + '\\PowerShell';

            if (fs.existsSync(rootInstallPath)) {
                var psCorePaths =
                    fs.readdirSync(rootInstallPath)
                    .map(item => path.join(rootInstallPath, item))
                    .filter(item => fs.lstatSync(item).isDirectory())
                    .map(item => {
                        return {
                            versionName: `PowerShell Core ${path.parse(item).base}`,
                            exePath: path.join(item, "powershell.exe")
                        };
                    });

                if (psCorePaths) {
                    paths = paths.concat(psCorePaths);
                }
            }

            if (is64Bit) {
                paths.push({
                    versionName: "Windows PowerShell (x64)",
                    exePath: process.env.windir + '\\Sysnative\\WindowsPowerShell\\v1.0\\powershell.exe'
                })
            }

            paths.push({
                versionName: "Windows PowerShell (x86)",
                exePath: process.env.windir + '\\System32\\WindowsPowerShell\\v1.0\\powershell.exe'
            })
        }
        else {
            paths.push({
                versionName: "PowerShell Core",
                exePath:
                    os.platform() === "darwin"
                         ? "/usr/local/bin/powershell"
                         : "/usr/bin/powershell"
            });
        }

        return paths;
    }

    private getDefaultPowerShellPath(use32Bit: boolean): string | null {

        // Find the path to powershell.exe based on the current platform
        // and the user's desire to run the x86 version of PowerShell
        var powerShellExePath = undefined;

        if (this.isWindowsOS) {
            powerShellExePath =
                use32Bit || !process.env.hasOwnProperty('PROCESSOR_ARCHITEW6432')
                ? process.env.windir + '\\System32\\WindowsPowerShell\\v1.0\\powershell.exe'
                : process.env.windir + '\\Sysnative\\WindowsPowerShell\\v1.0\\powershell.exe';
        }
        else if (os.platform() == "darwin") {
            powerShellExePath = "/usr/local/bin/powershell";
        }
        else {
            powerShellExePath = "/usr/bin/powershell";
        }

        return this.resolvePowerShellPath(powerShellExePath);
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

        if (this.sessionStatus === SessionStatus.Initializing ||
            this.sessionStatus === SessionStatus.NotStarted ||
            this.sessionStatus === SessionStatus.Stopping) {

            // Don't show a menu for these states
            return;
        }

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

        var currentExePath = this.powerShellExePath.toLowerCase();
        var powerShellItems =
            this.getPowerShellExeItems()
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

interface PowerShellExeDetails {
    versionName: string;
    exePath: string;
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
