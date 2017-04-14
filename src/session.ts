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
import { StringDecoder } from 'string_decoder';
import { LanguageClient, LanguageClientOptions, Executable, RequestType, RequestType0, NotificationType, StreamInfo } from 'vscode-languageclient';

export enum SessionStatus {
    NotStarted,
    Initializing,
    Running,
    Stopping,
    Failed
}

enum SessionType {
    UseDefault,
    UseCurrent,
    UsePath,
    UseBuiltIn
}

interface DefaultSessionConfiguration {
    type: SessionType.UseDefault
}

interface CurrentSessionConfiguration {
    type: SessionType.UseCurrent,
}

interface PathSessionConfiguration {
    type: SessionType.UsePath,
    path: string;
    isWindowsDevBuild: boolean;
}

interface BuiltInSessionConfiguration {
    type: SessionType.UseBuiltIn;
    path?: string;
    is32Bit: boolean;
}

type SessionConfiguration =
    DefaultSessionConfiguration |
    CurrentSessionConfiguration |
    PathSessionConfiguration |
    BuiltInSessionConfiguration;

export class SessionManager {

    private ShowSessionMenuCommandName = "PowerShell.ShowSessionMenu";

    private hostVersion: string;
    private isWindowsOS: boolean;
    private sessionStatus: SessionStatus;
    private focusConsoleOnExecute: boolean;
    private statusBarItem: vscode.StatusBarItem;
    private sessionConfiguration: SessionConfiguration;
    private versionDetails: PowerShellVersionDetails;
    private registeredCommands: vscode.Disposable[] = [];
    private consoleTerminal: vscode.Terminal = undefined;
    private languageServerClient: LanguageClient = undefined;
    private sessionSettings: Settings.ISettings = undefined;

    // When in development mode, VS Code's session ID is a fake
    // value of "someValue.machineId".  Use that to detect dev
    // mode for now until Microsoft/vscode#10272 gets implemented.
    private readonly inDevelopmentMode =
        vscode.env.sessionId === "someValue.sessionId";

    constructor(
        private requiredEditorServicesVersion: string,
        private log: Logger,
        private extensionFeatures: IFeature[] = []) {

        this.isWindowsOS = os.platform() == "win32";

        // Get the current version of this extension
        // NOTE: Report the host version as 1.0.0 for now to avoid
        //       issues loading the SSASCMDLETS module from SQL Server
        //       Analytics Service.  Once we ship 1.0 of the extension,
        //       this will be changed back to the actual ext version.
        //       (part of a fix for PowerShell/vscode-powershell#599).
        this.hostVersion = "1.0.0";
            // vscode
            //     .extensions
            //     .getExtension("ms-vscode.PowerShell")
            //     .packageJSON
            //     .version;

        // Fix the host version so that PowerShell can consume it.
        // This is needed when the extension uses a prerelease
        // version string like 0.9.1-insiders-1234.
        this.hostVersion = this.hostVersion.split('-')[0];

        this.registerCommands();
    }

    public start(sessionConfig: SessionConfiguration = { type: SessionType.UseDefault }) {
        this.sessionSettings = Settings.load(utils.PowerShellLanguageId);
        this.log.startNewLog(this.sessionSettings.developer.editorServicesLogLevel);

        this.focusConsoleOnExecute = this.sessionSettings.integratedConsole.focusConsoleOnExecute;

        this.createStatusBarItem();

        this.sessionConfiguration = this.resolveSessionConfiguration(sessionConfig);

        if (this.sessionConfiguration.type === SessionType.UsePath ||
            this.sessionConfiguration.type === SessionType.UseBuiltIn) {

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

            var startArgs =
                "-EditorServicesVersion '" + this.requiredEditorServicesVersion + "' " +
                "-HostName 'Visual Studio Code Host' " +
                "-HostProfileId 'Microsoft.VSCode' " +
                "-HostVersion '" + this.hostVersion + "' " +
                "-BundledModulesPath '" + bundledModulesPath + "' " +
                "-EnableConsoleRepl ";

            if (this.sessionSettings.developer.editorServicesWaitForDebugger) {
                startArgs += '-WaitForDebugger ';
            }
            if (this.sessionSettings.developer.editorServicesLogLevel) {
                startArgs += "-LogLevel '" + this.sessionSettings.developer.editorServicesLogLevel + "' "
            }

            var isWindowsDevBuild =
                this.sessionConfiguration.type == SessionType.UsePath
                ? this.sessionConfiguration.isWindowsDevBuild : false;

            this.startPowerShell(
                this.sessionConfiguration.path,
                isWindowsDevBuild,
                bundledModulesPath,
                startArgs);
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
            this.consoleTerminal = undefined;
        }

        this.sessionStatus = SessionStatus.Stopping;

        // Close the language server client
        if (this.languageServerClient !== undefined) {
            this.languageServerClient.stop();
            this.languageServerClient = undefined;
        }

        // Clean up the session file
        utils.deleteSessionFile();

        // Kill the PowerShell process we spawned via the console
        if (this.consoleTerminal !== undefined) {
            this.log.write(os.EOL + "Terminating PowerShell process...");
            this.consoleTerminal.dispose();
            this.consoleTerminal = undefined;
        }

        this.sessionStatus = SessionStatus.NotStarted;
    }

    public dispose() : void {
        // Stop the current session
        this.stop();

        // Dispose of all commands
        this.registeredCommands.forEach(command => { command.dispose(); });
    }

    private onConfigurationUpdated() {
        var settings = Settings.load(utils.PowerShellLanguageId);

        this.focusConsoleOnExecute = settings.integratedConsole.focusConsoleOnExecute;

        // Detect any setting changes that would affect the session
        if (settings.useX86Host !== this.sessionSettings.useX86Host ||
            settings.developer.powerShellExePath.toLowerCase() !== this.sessionSettings.developer.powerShellExePath.toLowerCase() ||
            settings.developer.editorServicesLogLevel.toLowerCase() !== this.sessionSettings.developer.editorServicesLogLevel.toLowerCase() ||
            settings.developer.bundledModulesPath.toLowerCase() !== this.sessionSettings.developer.bundledModulesPath.toLowerCase()) {

            vscode.window.showInformationMessage(
                "The PowerShell runtime configuration has changed, would you like to start a new session?",
                "Yes", "No")
                .then((response) => {
                    if (response === "Yes") {
                        this.restartSession({ type: SessionType.UseDefault })
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
        try
        {
            this.setSessionStatus(
                "Starting PowerShell...",
                SessionStatus.Initializing);

            let startScriptPath =
                path.resolve(
                    __dirname,
                    '../scripts/Start-EditorServices.ps1');

            var editorServicesLogPath = this.log.getLogFilePath("EditorServices");

            var featureFlags =
                this.sessionSettings.developer.featureFlags !== undefined
                ? this.sessionSettings.developer.featureFlags.map(f => `'${f}'`).join(', ')
                : "";

            startArgs +=
                `-LogPath '${editorServicesLogPath}' ` +
                `-SessionDetailsPath '${utils.getSessionFilePath()}' ` +
                `-FeatureFlags @(${featureFlags})`

            var powerShellArgs = [
                "-NoProfile",
                "-NonInteractive"
            ]

            // Only add ExecutionPolicy param on Windows
            if (this.isWindowsOS) {
                powerShellArgs.push("-ExecutionPolicy", "Unrestricted")
            }

            powerShellArgs.push(
                "-Command",
                "& '" + startScriptPath + "' " + startArgs);

            if (isWindowsDevBuild) {
                // Windows PowerShell development builds need the DEVPATH environment
                // variable set to the folder where development binaries are held

                // NOTE: This batch file approach is needed temporarily until VS Code's
                // createTerminal API gets an argument for setting environment variables
                // on the launched process.
                var batScriptPath = path.resolve(__dirname, '../sessions/powershell.bat');
                fs.writeFileSync(
                    batScriptPath,
                    `@set DEVPATH=${path.dirname(powerShellExePath)}\r\n@${powerShellExePath} %*`);

                powerShellExePath = batScriptPath;
            }

            // Make sure no old session file exists
            utils.deleteSessionFile();

            this.log.write(`${utils.getTimestampString()} Language server starting...`);

            // Launch PowerShell in the integrated terminal
            this.consoleTerminal =
                vscode.window.createTerminal(
                    "PowerShell Integrated Console",
                    powerShellExePath,
                    powerShellArgs);

            if (this.sessionSettings.integratedConsole.showOnStartup) {
                this.consoleTerminal.show(true);
            }

            // Start the language client
            utils.waitForSessionFile(
                (sessionDetails, error) => {
                    if (sessionDetails) {
                        if (sessionDetails.status === "started") {
                            this.log.write(`${utils.getTimestampString()} Language server started.`);

                            // Write out the session configuration file
                            utils.writeSessionFile(sessionDetails);

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
                    }
                    else {
                        this.log.write(`${utils.getTimestampString()} Language server startup failed.`);
                        this.setSessionFailure("Could not start language service: ", error);
                    }
                });

            // this.powerShellProcess.stderr.on(
            //     'data',
            //     (data) => {
            //         this.log.writeError("ERROR: " + data);

            //         if (this.sessionStatus === SessionStatus.Initializing) {
            //             this.setSessionFailure("PowerShell could not be started, click 'Show Logs' for more details.");
            //         }
            //         else if (this.sessionStatus === SessionStatus.Running) {
            //             this.promptForRestart();
            //         }
            //     });

            vscode.window.onDidCloseTerminal(
                terminal => {
                    this.log.write(os.EOL + "powershell.exe terminated or terminal UI was closed" + os.EOL);

                    if (this.languageServerClient != undefined) {
                        this.languageServerClient.stop();
                    }

                    if (this.sessionStatus === SessionStatus.Running) {
                        this.setSessionStatus("Session exited", SessionStatus.Failed);
                        this.promptForRestart();
                    }
                });

            this.consoleTerminal.processId.then(
                pid => {
                    console.log("powershell.exe started, pid: " + pid + ", exe: " + powerShellExePath);
                    this.log.write(
                        "powershell.exe started --",
                        "    pid: " + pid,
                        "    exe: " + powerShellExePath,
                        "    args: " + startScriptPath + ' ' + startArgs + os.EOL + os.EOL);
                });
        }
        catch (e)
        {
            this.setSessionFailure("The language service could not be started: ", e);
        }
    }

    private promptForRestart() {
        vscode.window.showErrorMessage(
            "The PowerShell session has terminated due to an error, would you like to restart it?",
            "Yes", "No")
            .then((answer) => { if (answer === "Yes") { this.restartSession(); }});
    }

    private startLanguageClient(sessionDetails: utils.EditorServicesSessionDetails) {

        var port = sessionDetails.languageServicePort;

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
                                // Write out the session configuration file
                                utils.writeSessionFile(sessionDetails);

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
                }
            }

            this.languageServerClient =
                new LanguageClient(
                    'PowerShell Editor Services',
                    connectFunc,
                    clientOptions);

            // Send the new LanguageClient to extension features
            // so that they can register their message handlers
            // before the connection is established.
            this.updateExtensionFeatures(this.languageServerClient);

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
                },
                (reason) => {
                    this.setSessionFailure("Could not start language service: ", reason);
                });

            this.languageServerClient.onNotification(
                RunspaceChangedEvent.type,
                (runspaceDetails) => { this.setStatusBarVersionString(runspaceDetails); });

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

    private restartSession(sessionConfig?: SessionConfiguration) {
        this.stop();
        this.start(sessionConfig);
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

    private resolveSessionConfiguration(sessionConfig: SessionConfiguration): SessionConfiguration {

        switch (sessionConfig.type) {
            case SessionType.UseCurrent: return this.sessionConfiguration;
            case SessionType.UseDefault:
                // Is there a setting override for the PowerShell path?
                var powerShellExePath = (this.sessionSettings.developer.powerShellExePath || "").trim();
                if (powerShellExePath.length > 0) {
                    return this.resolveSessionConfiguration(
                        { type: SessionType.UsePath,
                          path: this.sessionSettings.developer.powerShellExePath,
                          isWindowsDevBuild: this.sessionSettings.developer.powerShellExeIsWindowsDevBuild});
                }
                else {
                    return this.resolveSessionConfiguration(
                        { type: SessionType.UseBuiltIn, is32Bit: this.sessionSettings.useX86Host });
                }

            case SessionType.UsePath:
                sessionConfig.path = this.resolvePowerShellPath(sessionConfig.path);
                return sessionConfig;

            case SessionType.UseBuiltIn:
                sessionConfig.path = this.getBuiltInPowerShellPath(sessionConfig.is32Bit);
                return sessionConfig;
        }
    }

    private getBuiltInPowerShellPath(use32Bit: boolean): string | null {

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

            // Check for OpenSSL dependency on macOS.  Look for the default Homebrew installation
            // path and if that fails check the system-wide library path.
            if (!(utils.checkIfFileExists("/usr/local/opt/openssl/lib/libcrypto.1.0.0.dylib") &&
                  utils.checkIfFileExists("/usr/local/opt/openssl/lib/libssl.1.0.0.dylib")) &&
                !(utils.checkIfFileExists("/usr/local/lib/libcrypto.1.0.0.dylib") &&
                  utils.checkIfFileExists("/usr/local/lib/libssl.1.0.0.dylib"))) {
                    var thenable =
                        vscode.window.showWarningMessage(
                            "The PowerShell extension will not work without OpenSSL on macOS and OS X",
                            "Show Documentation");

                    thenable.then(
                        (s) => {
                            if (s === "Show Documentation") {
                                cp.exec("open https://github.com/PowerShell/vscode-powershell/blob/master/docs/troubleshooting.md#1-powershell-intellisense-does-not-work-cant-debug-scripts");
                            }
                        });

                    // Don't continue initializing since Editor Services will not load successfully
                    this.setSessionFailure("Cannot start PowerShell Editor Services due to missing OpenSSL dependency.");
                    return null;
                }
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

    private showSessionConsole(isExecute?: boolean) {
        if (this.consoleTerminal) {
            this.consoleTerminal.show(
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

        if (this.isWindowsOS) {
            var item32 =
                new SessionMenuItem(
                    "Switch to Windows PowerShell (x86)",
                    () => { this.restartSession({ type: SessionType.UseBuiltIn, is32Bit: true}) });

            var item64 =
                new SessionMenuItem(
                    "Switch to Windows PowerShell (x64)",
                    () => { this.restartSession({ type: SessionType.UseBuiltIn, is32Bit: false }) });

            // If the configured PowerShell path isn't being used, offer it as an option
            if (this.sessionSettings.developer.powerShellExePath !== "" &&
                (this.sessionConfiguration.type !== SessionType.UsePath ||
                 this.sessionConfiguration.path !== this.sessionSettings.developer.powerShellExePath)) {

                 menuItems.push(
                     new SessionMenuItem(
                         `Switch to PowerShell at path: ${this.sessionSettings.developer.powerShellExePath}`,
                         () => {
                             this.restartSession(
                                 { type: SessionType.UsePath,
                                   path: this.sessionSettings.developer.powerShellExePath,
                                   isWindowsDevBuild: this.sessionSettings.developer.powerShellExeIsWindowsDevBuild })
                         }));
            }

            if (this.sessionConfiguration.type === SessionType.UseBuiltIn) {
                menuItems.push(
                    this.sessionConfiguration.is32Bit ? item64 : item32);
            }
            else {
                menuItems.push(item32);
                menuItems.push(item64);
            }
        }
        else {
            if (this.sessionConfiguration.type !== SessionType.UseBuiltIn) {
                menuItems.push(
                    new SessionMenuItem(
                        "Use built-in PowerShell",
                        () => { this.restartSession({ type: SessionType.UseBuiltIn, is32Bit: false }) }));
            }
        }

        menuItems.push(
            new SessionMenuItem(
                "Open Session Logs Folder",
                () => { vscode.commands.executeCommand("PowerShell.OpenLogFolder"); }));

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