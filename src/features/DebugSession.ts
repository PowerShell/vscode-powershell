// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import vscode = require("vscode");
import { CancellationToken, DebugConfiguration, DebugConfigurationProvider,
    ExtensionContext, WorkspaceFolder } from "vscode";
import { NotificationType, RequestType } from "vscode-languageclient";
import { LanguageClient } from "vscode-languageclient/node";
import { getPlatformDetails, OperatingSystem } from "../platform";
import { PowerShellProcess} from "../process";
import { IEditorServicesSessionDetails, SessionManager, SessionStatus } from "../session";
import Settings = require("../settings");
import { Logger } from "../logging";
import { LanguageClientConsumer } from "../languageClientConsumer";

export const StartDebuggerNotificationType =
    new NotificationType<void>("powerShell/startDebugger");

export const StopDebuggerNotificationType =
    new NotificationType<void>("powerShell/stopDebugger");

export class DebugSessionFeature extends LanguageClientConsumer
    implements DebugConfigurationProvider, vscode.DebugAdapterDescriptorFactory {

    private sessionCount: number = 1;
    private tempDebugProcess: PowerShellProcess;
    private tempSessionDetails: IEditorServicesSessionDetails;

    constructor(context: ExtensionContext, private sessionManager: SessionManager, private logger: Logger) {
        super();
        // Register a debug configuration provider
        context.subscriptions.push(vscode.debug.registerDebugConfigurationProvider("PowerShell", this));
        context.subscriptions.push(vscode.debug.registerDebugAdapterDescriptorFactory("PowerShell", this))
    }

    createDebugAdapterDescriptor(
        session: vscode.DebugSession,
        _executable: vscode.DebugAdapterExecutable | undefined): vscode.ProviderResult<vscode.DebugAdapterDescriptor> {

        const sessionDetails = session.configuration.createTemporaryIntegratedConsole
            ? this.tempSessionDetails
            : this.sessionManager.getSessionDetails();

        this.logger.writeVerbose(`Connecting to pipe: ${sessionDetails.debugServicePipeName}`);
        this.logger.writeVerbose(`Debug configuration: ${JSON.stringify(session.configuration)}`);

        return new vscode.DebugAdapterNamedPipeServer(sessionDetails.debugServicePipeName);
    }

    // tslint:disable-next-line:no-empty
    public dispose() {
    }

    public setLanguageClient(languageClient: LanguageClient) {
        languageClient.onNotification(
            StartDebuggerNotificationType,
            // TODO: Use a named debug configuration.
            () => vscode.debug.startDebugging(undefined, {
                request: "launch",
                type: "PowerShell",
                name: "PowerShell: Interactive Session"
            }));

        languageClient.onNotification(
            StopDebuggerNotificationType,
            () => vscode.debug.stopDebugging(undefined));
    }

    public async provideDebugConfigurations(
        folder: WorkspaceFolder | undefined,
        token?: CancellationToken): Promise<DebugConfiguration[]> {

        enum DebugConfig {
            LaunchCurrentFile,
            LaunchScript,
            InteractiveSession,
            AttachHostProcess,
        }

        const debugConfigPickItems = [
            {
                id: DebugConfig.LaunchCurrentFile,
                label: "Launch Current File",
                description: "Launch and debug the file in the currently active editor window",
            },
            {
                id: DebugConfig.LaunchScript,
                label: "Launch Script",
                description: "Launch and debug the specified file or command",
            },
            {
                id: DebugConfig.InteractiveSession,
                label: "Interactive Session",
                description: "Debug commands executed from the PowerShell Extension Terminal",
            },
            {
                id: DebugConfig.AttachHostProcess,
                label: "Attach",
                description: "Attach the debugger to a running PowerShell Host Process",
            },
        ];

        const launchSelection =
            await vscode.window.showQuickPick(
                debugConfigPickItems,
                { placeHolder: "Select a PowerShell debug configuration" });

        // TODO: Make these available in a dictionary and share them.
        switch (launchSelection.id) {
            case DebugConfig.LaunchCurrentFile:
                return [
                    {
                        name: "PowerShell: Launch Current File",
                        type: "PowerShell",
                        request: "launch",
                        script: "${file}",
                        cwd: "${file}",
                    },
                ];
            case DebugConfig.LaunchScript:
                return [
                    {
                        name: "PowerShell: Launch Script",
                        type: "PowerShell",
                        request: "launch",
                        script: "enter path or command to execute e.g.: ${workspaceFolder}/src/foo.ps1 or Invoke-Pester",
                        cwd: "${workspaceFolder}",
                    },
                ];
            case DebugConfig.InteractiveSession:
                return [
                    {
                        name: "PowerShell: Interactive Session",
                        type: "PowerShell",
                        request: "launch",
                        cwd: "",
                    },
                ];
            case DebugConfig.AttachHostProcess:
                return [
                    {
                        name: "PowerShell: Attach to PowerShell Host Process",
                        type: "PowerShell",
                        request: "attach",
                        runspaceId: 1,
                    },
                ];
        }
    }

    // DebugConfigurationProvider method
    public async resolveDebugConfiguration(
        _folder: WorkspaceFolder | undefined,
        config: DebugConfiguration,
        _token?: CancellationToken): Promise<DebugConfiguration> {
        // Make sure there is a session running before attempting to debug/run a program
        // TODO: Perhaps this should just wait until it's running or aborted.
        if (this.sessionManager.getSessionStatus() !== SessionStatus.Running) {
            const msg = "Cannot debug or run a PowerShell script until the PowerShell session has started. " +
                "Wait for the PowerShell session to finish starting and try again.";
            vscode.window.showWarningMessage(msg);
            return undefined;
        }

        // Starting a debug session can be done when there is no document open e.g. attach to PS host process
        const currentDocument = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.document : undefined;
        const debugCurrentScript = (config.script === "${file}") || !config.request;
        const generateLaunchConfig = !config.request;

        const settings = Settings.load();

        // If the createTemporaryIntegratedConsole field is not specified in the launch config, set the field using
        // the value from the corresponding setting. Otherwise, the launch config value overrides the setting.
        config.createTemporaryIntegratedConsole =
            config.createTemporaryIntegratedConsole ??
            settings.debugging.createTemporaryIntegratedConsole;

        if (config.request === "attach") {
            const platformDetails = getPlatformDetails();
            const versionDetails = this.sessionManager.getPowerShellVersionDetails();

            // Cross-platform attach to process was added in 6.2.0-preview.4
            if (versionDetails.version < "6.2.0" && platformDetails.operatingSystem !== OperatingSystem.Windows) {
                const msg = `Attaching to a PowerShell Host Process on ${
                    OperatingSystem[platformDetails.operatingSystem] } requires PowerShell 6.2 or higher.`;
                return vscode.window.showErrorMessage(msg).then((_) => {
                    return undefined;
                });
            }

            // if nothing is set, prompt for the processId
            if (!config.customPipeName && !config.processId) {
                config.processId = await vscode.commands.executeCommand("PowerShell.PickPSHostProcess");

                // No process selected. Cancel attach.
                if (!config.processId) {
                    return null;
                }
            }

            if (!config.runspaceId && !config.runspaceName) {
                config.runspaceId = await vscode.commands.executeCommand("PowerShell.PickRunspace", config.processId);

                // No runspace selected. Cancel attach.
                if (!config.runspaceId) {
                    return null;
                }
            }
        }

        // TODO: Use a named debug configuration.
        if (generateLaunchConfig) {
            // No launch.json, create the default configuration for both unsaved (Untitled) and saved documents.
            config.type = "PowerShell";
            config.name = "PowerShell: Launch Current File";
            config.request = "launch";
            config.args = [];

            config.script =
                currentDocument.isUntitled
                    ? currentDocument.uri.toString()
                    : currentDocument.fileName;

            if (config.createTemporaryIntegratedConsole) {
                // For a folder-less workspace, vscode.workspace.rootPath will be undefined.
                // PSES will convert that undefined to a reasonable working dir.
                config.cwd =
                    currentDocument.isUntitled
                        ? vscode.workspace.rootPath
                        : currentDocument.fileName;

            } else {
                // If the non-temp Extension Terminal is being used, default to the current working dir.
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
                    if (config.createTemporaryIntegratedConsole) {
                        const msg = "Debugging Untitled files in a temporary console is currently not supported.";
                        vscode.window.showErrorMessage(msg);
                        return;
                    }

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
                        let docPath = currentDocument.fileName;
                        const workspaceRootPath = vscode.workspace.rootPath;
                        if (currentDocument.fileName.startsWith(workspaceRootPath)) {
                            docPath = currentDocument.fileName.substring(vscode.workspace.rootPath.length + 1);
                        }

                        const msg = "PowerShell does not support debugging this file type: '" + docPath + "'.";
                        vscode.window.showErrorMessage(msg);
                        return;
                    }

                    if (config.script === "${file}") {
                        config.script = currentDocument.fileName;
                    }
                }
            }

            // NOTE: There is a tight coupling to a weird setting in
            // `package.json` for the Launch Current File configuration where
            // the default cwd is set to ${file}.
            if ((currentDocument !== undefined) && (config.cwd === "${file}")) {
                config.cwd = currentDocument.fileName;
            }
        }

        // Prevent the Debug Console from opening
        config.internalConsoleOptions = "neverOpen";

        // Create or show the interactive console
        vscode.commands.executeCommand("PowerShell.ShowSessionConsole", true);

        if (config.createTemporaryIntegratedConsole) {
            this.tempDebugProcess = this.sessionManager.createDebugSessionProcess(settings);
            this.tempSessionDetails = await this.tempDebugProcess.start(`DebugSession-${this.sessionCount++}`);
        }

        return config;
    }
}

export class SpecifyScriptArgsFeature implements vscode.Disposable {

    private command: vscode.Disposable;
    private context: vscode.ExtensionContext;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;

        this.command =
            vscode.commands.registerCommand("PowerShell.SpecifyScriptArgs", () => {
                return this.specifyScriptArguments();
            });
    }

    public dispose() {
        this.command.dispose();
    }

    private async specifyScriptArguments(): Promise<string> {
        const powerShellDbgScriptArgsKey = "powerShellDebugScriptArgs";

        const options: vscode.InputBoxOptions = {
            ignoreFocusOut: true,
            placeHolder: "Enter script arguments or leave empty to pass no args",
        };

        const prevArgs = this.context.workspaceState.get(powerShellDbgScriptArgsKey, "");
        if (prevArgs.length > 0) {
            options.value = prevArgs;
        }

        const text = await vscode.window.showInputBox(options);
        // When user cancel's the input box (by pressing Esc), the text value is undefined.
        // Let's not blow away the previous setting.
        if (text !== undefined) {
            this.context.workspaceState.update(powerShellDbgScriptArgsKey, text);
        }
        return text;
    }
}

interface IProcessItem extends vscode.QuickPickItem {
    pid: string;    // payload for the QuickPick UI
}

interface IPSHostProcessInfo {
    processName: string;
    processId: string;
    appDomainName: string;
    mainWindowTitle: string;
}

export const GetPSHostProcessesRequestType =
    new RequestType<any, IGetPSHostProcessesResponseBody, string>("powerShell/getPSHostProcesses");

interface IGetPSHostProcessesResponseBody {
    hostProcesses: IPSHostProcessInfo[];
}

export class PickPSHostProcessFeature extends LanguageClientConsumer {

    private command: vscode.Disposable;
    private waitingForClientToken: vscode.CancellationTokenSource;
    private getLanguageClientResolve: (value?: LanguageClient | Promise<LanguageClient>) => void;

    constructor() {
        super();

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

    private getLanguageClient(): Promise<LanguageClient> {
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

    private async pickPSHostProcess(): Promise<string> {
        const hostProcesses = await this.languageClient.sendRequest(GetPSHostProcessesRequestType, {});
        // Start with the current PowerShell process in the list.
        const items: IProcessItem[] = [{
            label: "Current",
            description: "The current PowerShell Extension process.",
            pid: "current",
        }];
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
        const item = await vscode.window.showQuickPick(items, options);
        return item ? `${item.pid}` : undefined;
    }

    private clearWaitingToken() {
        if (this.waitingForClientToken) {
            this.waitingForClientToken.dispose();
            this.waitingForClientToken = undefined;
        }
    }
}

interface IRunspaceItem extends vscode.QuickPickItem {
    id: string;    // payload for the QuickPick UI
}

interface IRunspace {
    id: number;
    name: string;
    availability: string;
}

export const GetRunspaceRequestType =
    new RequestType<any, IRunspace[], string>("powerShell/getRunspace");

export class PickRunspaceFeature extends LanguageClientConsumer {

    private command: vscode.Disposable;
    private waitingForClientToken: vscode.CancellationTokenSource;
    private getLanguageClientResolve: (value?: LanguageClient | Promise<LanguageClient>) => void;

    constructor() {
        super();
        this.command =
            vscode.commands.registerCommand("PowerShell.PickRunspace", (processId) => {
                return this.getLanguageClient()
                           .then((_) => this.pickRunspace(processId), (_) => undefined);
            }, this);
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

    private getLanguageClient(): Promise<LanguageClient> {
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

    private async pickRunspace(processId: string): Promise<string> {
        const response = await this.languageClient.sendRequest(GetRunspaceRequestType, { processId });
        const items: IRunspaceItem[] = [];
        for (const runspace of response) {
            // Skip default runspace
            if ((runspace.id === 1 || runspace.name === "PSAttachRunspace")
                && processId === "current") {
                continue;
            }

            items.push({
                label: runspace.name,
                description: `ID: ${runspace.id} - ${runspace.availability}`,
                id: runspace.id.toString(),
            });
        }
        const options: vscode.QuickPickOptions = {
            placeHolder: "Select PowerShell runspace to debug",
            matchOnDescription: true,
            matchOnDetail: true,
        };
        const item = await vscode.window.showQuickPick(items, options);
        return item ? `${item.id}` : undefined;
    }

    private clearWaitingToken() {
        if (this.waitingForClientToken) {
            this.waitingForClientToken.dispose();
            this.waitingForClientToken = undefined;
        }
    }
}
