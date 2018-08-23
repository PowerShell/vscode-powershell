/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import vscode = require("vscode");
import { CancellationToken, DebugConfiguration, DebugConfigurationProvider,
    ExtensionContext, ProviderResult, WorkspaceFolder } from "vscode";
import { LanguageClient, NotificationType, RequestType } from "vscode-languageclient";
import { IFeature } from "../feature";
import { getPlatformDetails, OperatingSystem } from "../platform";
import { PowerShellProcess} from "../process";
import { SessionManager, SessionStatus } from "../session";
import Settings = require("../settings");
import utils = require("../utils");

export const StartDebuggerNotificationType =
    new NotificationType<void, void>("powerShell/startDebugger");

export class DebugSessionFeature implements IFeature, DebugConfigurationProvider {

    private sessionCount: number = 1;
    private command: vscode.Disposable;
    private tempDebugProcess: PowerShellProcess;

    constructor(context: ExtensionContext, private sessionManager: SessionManager) {
        // Register a debug configuration provider
        context.subscriptions.push(vscode.debug.registerDebugConfigurationProvider("PowerShell", this));
    }

    public dispose() {
        this.command.dispose();
    }

    public setLanguageClient(languageClient: LanguageClient) {
        languageClient.onNotification(
            StartDebuggerNotificationType,
            () =>
                vscode.debug.startDebugging(undefined, {
                    request: "launch",
                    type: "PowerShell",
                    name: "PowerShell Interactive Session",
        }));
    }

    // DebugConfigurationProvider method
    public resolveDebugConfiguration(
        folder: WorkspaceFolder | undefined,
        config: DebugConfiguration,
        token?: CancellationToken): ProviderResult<DebugConfiguration> {

        // Make sure there is a session running before attempting to debug/run a program
        if (this.sessionManager.getSessionStatus() !== SessionStatus.Running) {
            const msg = "Cannot debug or run a PowerShell script until the PowerShell session has started. " +
                "Wait for the PowerShell session to finish starting and try again.";
            vscode.window.showWarningMessage(msg);
            return;
        }

        // Starting a debug session can be done when there is no document open e.g. attach to PS host process
        const currentDocument = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.document : undefined;
        const debugCurrentScript = (config.script === "${file}") || !config.request;
        const generateLaunchConfig = !config.request;

        const settings = Settings.load();
        let createNewIntegratedConsole = settings.debugging.createTemporaryIntegratedConsole;

        if (config.request === "attach") {
            const platformDetails = getPlatformDetails();
            const versionDetails = this.sessionManager.getPowerShellVersionDetails();

            if (platformDetails.operatingSystem !== OperatingSystem.Windows) {
                const msg = "Attaching to a PowerShell Host Process is supported only on Windows.";
                return vscode.window.showErrorMessage(msg).then((_) => {
                    return undefined;
                });
            }
        }

        if (generateLaunchConfig) {
            // No launch.json, create the default configuration for both unsaved (Untitled) and saved documents.
            config.type = "PowerShell";
            config.name = "PowerShell Launch Current File";
            config.request = "launch";
            config.args = [];

            config.script =
                currentDocument.isUntitled
                    ? currentDocument.uri.toString()
                    : currentDocument.fileName;

            if (settings.debugging.createTemporaryIntegratedConsole) {
                // For a folder-less workspace, vscode.workspace.rootPath will be undefined.
                // PSES will convert that undefined to a reasonable working dir.
                config.cwd =
                    currentDocument.isUntitled
                        ? vscode.workspace.rootPath
                        : currentDocument.fileName;

            } else {
                // If the non-temp integrated console is being used, default to the current working dir.
                config.cwd = "";
            }
        }

        if (config.request === "launch") {

            // For debug launch of "current script" (saved or unsaved), warn before starting the debugger if either
            // A) there is not an active document
            // B) the unsaved document's language type is not PowerShell
            // C) the saved document's extension is a type that PowerShell can't debug.
            if (debugCurrentScript) {

                if (currentDocument === undefined) {
                    const msg = "To debug the \"Current File\", you must first open a " +
                                "PowerShell script file in the editor.";
                    vscode.window.showErrorMessage(msg);
                    return;
                }

                if (currentDocument.isUntitled) {
                    if (currentDocument.languageId === "powershell") {
                        if (!generateLaunchConfig) {
                            // Cover the case of existing launch.json but unsaved (Untitled) document.
                            // In this case, vscode.workspace.rootPath will not be undefined.
                            config.script = currentDocument.uri.toString();
                            config.cwd = vscode.workspace.rootPath;
                        }
                    } else {
                        const msg = "To debug '" + currentDocument.fileName + "', change the document's " +
                                    "language mode to PowerShell or save the file with a PowerShell extension.";
                        vscode.window.showErrorMessage(msg);
                        return;
                    }
                } else {
                    let isValidExtension = false;
                    const extIndex = currentDocument.fileName.lastIndexOf(".");
                    if (extIndex !== -1) {
                        const ext = currentDocument.fileName.substr(extIndex + 1).toUpperCase();
                        isValidExtension = (ext === "PS1" || ext === "PSM1");
                    }

                    if ((currentDocument.languageId !== "powershell") || !isValidExtension) {
                        let path = currentDocument.fileName;
                        const workspaceRootPath = vscode.workspace.rootPath;
                        if (currentDocument.fileName.startsWith(workspaceRootPath)) {
                            path = currentDocument.fileName.substring(vscode.workspace.rootPath.length + 1);
                        }

                        const msg = "PowerShell does not support debugging this file type: '" + path + "'.";
                        vscode.window.showErrorMessage(msg);
                        return;
                    }

                    if (config.script === "${file}") {
                        config.script = currentDocument.fileName;
                    }
                }
            }

            if ((currentDocument !== undefined) && (config.cwd === "${file}")) {
                config.cwd = currentDocument.fileName;
            }

            // If the createTemporaryIntegratedConsole field is not specified in the launch config, set the field using
            // the value from the corresponding setting.  Otherwise, the launch config value overrides the setting.
            if (config.createTemporaryIntegratedConsole === undefined) {
                config.createTemporaryIntegratedConsole = createNewIntegratedConsole;
            } else {
                createNewIntegratedConsole = config.createTemporaryIntegratedConsole;
            }
        }

        // Prevent the Debug Console from opening
        config.internalConsoleOptions = "neverOpen";

        // Create or show the interactive console
        vscode.commands.executeCommand("PowerShell.ShowSessionConsole", true);

        const sessionFilePath = utils.getDebugSessionFilePath();

        if (createNewIntegratedConsole) {
            if (this.tempDebugProcess) {
                this.tempDebugProcess.dispose();
            }

            this.tempDebugProcess =
                this.sessionManager.createDebugSessionProcess(
                    sessionFilePath,
                    settings);

            this.tempDebugProcess
                .start(`DebugSession-${this.sessionCount++}`)
                .then((sessionDetails) => {
                        utils.writeSessionFile(sessionFilePath, sessionDetails);
                });
        } else {
            utils.writeSessionFile(sessionFilePath, this.sessionManager.getSessionDetails());
        }

        return config;
    }
}

export class SpecifyScriptArgsFeature implements IFeature {

    private command: vscode.Disposable;
    private languageClient: LanguageClient;
    private context: vscode.ExtensionContext;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;

        this.command =
            vscode.commands.registerCommand("PowerShell.SpecifyScriptArgs", () => {
                return this.specifyScriptArguments();
            });
    }

    public setLanguageClient(languageclient: LanguageClient) {
        this.languageClient = languageclient;
    }

    public dispose() {
        this.command.dispose();
    }

    private specifyScriptArguments(): Thenable<string> {
        const powerShellDbgScriptArgsKey = "powerShellDebugScriptArgs";

        const options: vscode.InputBoxOptions = {
            ignoreFocusOut: true,
            placeHolder: "Enter script arguments or leave empty to pass no args",
        };

        const prevArgs = this.context.workspaceState.get(powerShellDbgScriptArgsKey, "");
        if (prevArgs.length > 0) {
            options.value = prevArgs;
        }

        return vscode.window.showInputBox(options).then((text) => {
            // When user cancel's the input box (by pressing Esc), the text value is undefined.
            // Let's not blow away the previous settting.
            if (text !== undefined) {
                this.context.workspaceState.update(powerShellDbgScriptArgsKey, text);
            }

            return text;
        });
    }
}

interface IProcessItem extends vscode.QuickPickItem {
    pid: string;	// payload for the QuickPick UI
}

interface IPSHostProcessInfo {
    processName: string;
    processId: string;
    appDomainName: string;
    mainWindowTitle: string;
}

export const GetPSHostProcessesRequestType =
    new RequestType<any, IGetPSHostProcessesResponseBody, string, void>("powerShell/getPSHostProcesses");

interface IGetPSHostProcessesResponseBody {
    hostProcesses: IPSHostProcessInfo[];
}

export class PickPSHostProcessFeature implements IFeature {

    private command: vscode.Disposable;
    private languageClient: LanguageClient;
    private waitingForClientToken: vscode.CancellationTokenSource;
    private getLanguageClientResolve: (value?: LanguageClient | Thenable<LanguageClient>) => void;

    constructor() {

        this.command =
            vscode.commands.registerCommand("PowerShell.PickPSHostProcess", () => {
                return this.getLanguageClient()
                           .then((_) => this.pickPSHostProcess(), (_) => undefined);
            });
    }

    public setLanguageClient(languageClient: LanguageClient) {
        this.languageClient = languageClient;

        if (this.waitingForClientToken) {
            this.getLanguageClientResolve(this.languageClient);
            this.clearWaitingToken();
        }
    }

    public dispose() {
        this.command.dispose();
    }

    private getLanguageClient(): Thenable<LanguageClient> {
        if (this.languageClient) {
            return Promise.resolve(this.languageClient);
        } else {
            // If PowerShell isn't finished loading yet, show a loading message
            // until the LanguageClient is passed on to us
            this.waitingForClientToken = new vscode.CancellationTokenSource();

            return new Promise<LanguageClient>(
                (resolve, reject) => {
                    this.getLanguageClientResolve = resolve;

                    vscode.window
                        .showQuickPick(
                            ["Cancel"],
                            { placeHolder: "Attach to PowerShell host process: Please wait, starting PowerShell..." },
                            this.waitingForClientToken.token)
                        .then((response) => {
                            if (response === "Cancel") {
                                this.clearWaitingToken();
                                reject();
                            }
                        });

                    // Cancel the loading prompt after 60 seconds
                    setTimeout(() => {
                        if (this.waitingForClientToken) {
                            this.clearWaitingToken();
                            reject();

                            vscode.window.showErrorMessage(
                                "Attach to PowerShell host process: PowerShell session took too long to start.");
                        }
                    }, 60000);
                },
            );
        }
    }

    private pickPSHostProcess(): Thenable<string> {
        return this.languageClient.sendRequest(GetPSHostProcessesRequestType, null).then((hostProcesses) => {
            const items: IProcessItem[] = [];

            for (const p in hostProcesses) {
                if (hostProcesses.hasOwnProperty(p)) {
                    let windowTitle = "";
                    if (hostProcesses[p].mainWindowTitle) {
                        windowTitle = `, Title: ${hostProcesses[p].mainWindowTitle}`;
                    }

                    items.push({
                        label: hostProcesses[p].processName,
                        description: `PID: ${hostProcesses[p].processId.toString()}${windowTitle}`,
                        pid: hostProcesses[p].processId,
                    });
                }
            }

            if (items.length === 0) {
                return Promise.reject("There are no PowerShell host processes to attach to.");
            }

            const options: vscode.QuickPickOptions = {
                placeHolder: "Select a PowerShell host process to attach to",
                matchOnDescription: true,
                matchOnDetail: true,
            };

            return vscode.window.showQuickPick(items, options).then((item) => {
                // Return undefined when user presses Esc.
                // This prevents VSCode from opening launch.json in this case which happens if we return "".
                return item ? `${item.pid}` : undefined;
            });
        });
    }

    private clearWaitingToken() {
        if (this.waitingForClientToken) {
            this.waitingForClientToken.dispose();
            this.waitingForClientToken = undefined;
        }
    }
}
