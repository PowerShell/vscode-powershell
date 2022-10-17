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
import path = require("path");

export const StartDebuggerNotificationType =
    new NotificationType<void>("powerShell/startDebugger");

export const StopDebuggerNotificationType =
    new NotificationType<void>("powerShell/stopDebugger");

enum DebugConfig {
    LaunchCurrentFile,
    LaunchScript,
    InteractiveSession,
    AttachHostProcess,
};

export class DebugSessionFeature extends LanguageClientConsumer
    implements DebugConfigurationProvider, vscode.DebugAdapterDescriptorFactory {

    private sessionCount: number = 1;
    private tempDebugProcess: PowerShellProcess | undefined;
    private tempSessionDetails: IEditorServicesSessionDetails | undefined;
    private handlers: vscode.Disposable[] = [];
    private configs: Record<DebugConfig, DebugConfiguration> = {
        [DebugConfig.LaunchCurrentFile]: {
            name: "PowerShell: Launch Current File",
            type: "PowerShell",
            request: "launch",
            script: "${file}",
            args: [],
        },
        [DebugConfig.LaunchScript]: {
            name: "PowerShell: Launch Script",
            type: "PowerShell",
            request: "launch",
            script: "Enter path or command to execute, for example: \"${workspaceFolder}/src/foo.ps1\" or \"Invoke-Pester\"",
            args: [],
        },
        [DebugConfig.InteractiveSession]: {
            name: "PowerShell: Interactive Session",
            type: "PowerShell",
            request: "launch",
        },
        [DebugConfig.AttachHostProcess]: {
            name: "PowerShell: Attach to PowerShell Host Process",
            type: "PowerShell",
            request: "attach",
            runspaceId: 1,
        },
    };

    constructor(context: ExtensionContext, private sessionManager: SessionManager, private logger: Logger) {
        super();
        // Register a debug configuration provider
        context.subscriptions.push(vscode.debug.registerDebugConfigurationProvider("PowerShell", this));
        context.subscriptions.push(vscode.debug.registerDebugAdapterDescriptorFactory("PowerShell", this));
    }

    createDebugAdapterDescriptor(
        session: vscode.DebugSession,
        _executable: vscode.DebugAdapterExecutable | undefined): vscode.ProviderResult<vscode.DebugAdapterDescriptor> {

        const sessionDetails = session.configuration.createTemporaryIntegratedConsole
            ? this.tempSessionDetails
            : this.sessionManager.getSessionDetails();

        if (sessionDetails === undefined) {
            this.logger.writeAndShowError(`No session details available for ${session.name}`);
            return;
        }

        this.logger.writeVerbose(`Connecting to pipe: ${sessionDetails.debugServicePipeName}`);
        this.logger.writeVerbose(`Debug configuration: ${JSON.stringify(session.configuration)}`);

        return new vscode.DebugAdapterNamedPipeServer(sessionDetails.debugServicePipeName);
    }

    public dispose() {
        for (const handler of this.handlers) {
            handler.dispose();
        }
    }

    public override setLanguageClient(languageClient: LanguageClient) {
        this.handlers = [
            languageClient.onNotification(
                StartDebuggerNotificationType,
                // TODO: Use a named debug configuration.
                async () => await vscode.debug.startDebugging(undefined, {
                    request: "launch",
                    type: "PowerShell",
                    name: "PowerShell: Interactive Session"
                })),

            languageClient.onNotification(
                StopDebuggerNotificationType,
                async () => await vscode.debug.stopDebugging(undefined))
        ];
    }

    public async provideDebugConfigurations(
        _folder: WorkspaceFolder | undefined,
        _token?: CancellationToken): Promise<DebugConfiguration[]> {

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

        if (launchSelection) {
            return [this.configs[launchSelection.id]];
        }

        return [this.configs[DebugConfig.LaunchCurrentFile]];
    }

    // DebugConfigurationProvider methods
    public async resolveDebugConfiguration(
        _folder: WorkspaceFolder | undefined,
        config: DebugConfiguration,
        _token?: CancellationToken): Promise<DebugConfiguration | undefined> {

        // Prevent the Debug Console from opening
        config.internalConsoleOptions = "neverOpen";

        // NOTE: We intentionally do not touch the `cwd` setting of the config.

        // If the createTemporaryIntegratedConsole field is not specified in the
        // launch config, set the field using the value from the corresponding
        // setting. Otherwise, the launch config value overrides the setting.
        //
        // Also start the temporary process and console for this configuration.
        const settings = Settings.load();
        config.createTemporaryIntegratedConsole =
            config.createTemporaryIntegratedConsole ??
            settings.debugging.createTemporaryIntegratedConsole;

        if (config.createTemporaryIntegratedConsole) {
            this.tempDebugProcess = await this.sessionManager.createDebugSessionProcess(settings);
            this.tempSessionDetails = await this.tempDebugProcess.start(`DebugSession-${this.sessionCount++}`);
        }

        if (!config.request) {
            // No launch.json, create the default configuration for both unsaved
            // (Untitled) and saved documents.
            const LaunchCurrentFileConfig = this.configs[DebugConfig.LaunchCurrentFile];
            config = { ...config, ...LaunchCurrentFileConfig };
            config.current_document = true;
        }

        if (config.script === "${file}" || config.script === "${relativeFile}") {
            if (vscode.window.activeTextEditor === undefined) {
                vscode.window.showErrorMessage("To debug the 'Current File', you must first open a PowerShell script file in the editor.");
                return undefined;
            }
            config.current_document = true;
            // Special case using the URI for untitled documents.
            const currentDocument = vscode.window.activeTextEditor.document;
            if (currentDocument.isUntitled) {
                config.untitled_document = true;
                config.script = currentDocument.uri.toString();
            }
        }

        return config;
    }

    public async resolveDebugConfigurationWithSubstitutedVariables(
        _folder: WorkspaceFolder | undefined,
        config: DebugConfiguration,
        _token?: CancellationToken): Promise<DebugConfiguration | undefined | null> {

        let resolvedConfig: DebugConfiguration | undefined | null;
        if (config.request === "attach") {
            resolvedConfig = await this.resolveAttachDebugConfiguration(config);
        } else if (config.request === "launch") {
            resolvedConfig = await this.resolveLaunchDebugConfiguration(config);
        } else {
            vscode.window.showErrorMessage(`The request type was invalid: '${config.request}'`);
            return null;
        }

        if (resolvedConfig) {
            // Start the PowerShell session if needed.
            if (this.sessionManager.getSessionStatus() !== SessionStatus.Running) {
                await this.sessionManager.start();
            }
            // Create or show the debug terminal (either temporary or session).
            this.sessionManager.showDebugTerminal(true);
        }

        return resolvedConfig;
    }

    private async resolveLaunchDebugConfiguration(config: DebugConfiguration): Promise<DebugConfiguration | undefined> {
        // Check the languageId only for current documents (which includes untitled documents).
        if (config.current_document) {
            const currentDocument = vscode.window.activeTextEditor?.document;
            if (currentDocument?.languageId !== "powershell") {
                vscode.window.showErrorMessage("Please change the current document's language mode to PowerShell.");
                return undefined;
            }
        }

        // Check the temporary console setting for untitled documents only, and
        // check the document extension for everything else.
        if (config.untitled_document) {
            if (config.createTemporaryIntegratedConsole) {
                vscode.window.showErrorMessage("Debugging untitled files in a temporary console is not supported.");
                return undefined;
            }
        } else if (config.script) {
            const ext = path.extname(config.script).toLowerCase();
            if (!(ext === ".ps1" || ext === ".psm1")) {
                vscode.window.showErrorMessage(`PowerShell does not support debugging this file type: '${path.basename(config.script)}'`);
                return undefined;
            }
        }

        return config;
    }

    private async resolveAttachDebugConfiguration(config: DebugConfiguration): Promise<DebugConfiguration | undefined | null> {
        const platformDetails = getPlatformDetails();
        const versionDetails = this.sessionManager.getPowerShellVersionDetails();
        if (versionDetails === undefined) {
            vscode.window.showErrorMessage(`Session version details were not found for ${config.name}`)
            return null;
        }

        // Cross-platform attach to process was added in 6.2.0-preview.4.
        if (versionDetails.version < "7.0.0" && platformDetails.operatingSystem !== OperatingSystem.Windows) {
            vscode.window.showErrorMessage(`Attaching to a PowerShell Host Process on ${OperatingSystem[platformDetails.operatingSystem]} requires PowerShell 7.0 or higher.`);
            return undefined;
        }

        // If nothing is set, prompt for the processId.
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

    private async specifyScriptArguments(): Promise<string | undefined> {
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
    private waitingForClientToken?: vscode.CancellationTokenSource;
    private getLanguageClientResolve?: (value: LanguageClient) => void;

    constructor() {
        super();

        this.command =
            vscode.commands.registerCommand("PowerShell.PickPSHostProcess", () => {
                return this.getLanguageClient()
                           .then((_) => this.pickPSHostProcess(), (_) => undefined);
            });
    }

    public override setLanguageClient(languageClient: LanguageClient) {
        this.languageClient = languageClient;

        if (this.waitingForClientToken && this.getLanguageClientResolve) {
            this.getLanguageClientResolve(this.languageClient);
            this.clearWaitingToken();
        }
    }

    public dispose() {
        this.command.dispose();
    }

    private getLanguageClient(): Promise<LanguageClient> {
        if (this.languageClient !== undefined) {
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
                            this.waitingForClientToken?.token)
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

    private async pickPSHostProcess(): Promise<string | undefined> {
        // Start with the current PowerShell process in the list.
        const items: IProcessItem[] = [{
            label: "Current",
            description: "The current PowerShell Extension process.",
            pid: "current",
        }];

        const response = await this.languageClient?.sendRequest(GetPSHostProcessesRequestType, {});
        for (const process of response?.hostProcesses ?? []) {
                let windowTitle = "";
                if (process.mainWindowTitle) {
                    windowTitle = `, Title: ${process.mainWindowTitle}`;
                }

                items.push({
                    label: process.processName,
                    description: `PID: ${process.processId.toString()}${windowTitle}`,
                    pid: process.processId,
                });
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
        this.waitingForClientToken?.dispose();
        this.waitingForClientToken = undefined;
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
    private waitingForClientToken?: vscode.CancellationTokenSource;
    private getLanguageClientResolve?: (value: LanguageClient) => void;

    constructor() {
        super();
        this.command =
            vscode.commands.registerCommand("PowerShell.PickRunspace", (processId) => {
                return this.getLanguageClient()
                           .then((_) => this.pickRunspace(processId), (_) => undefined);
            }, this);
    }

    public override setLanguageClient(languageClient: LanguageClient) {
        this.languageClient = languageClient;

        if (this.waitingForClientToken && this.getLanguageClientResolve) {
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
                            this.waitingForClientToken?.token)
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

    private async pickRunspace(processId: string): Promise<string | undefined> {
        const response = await this.languageClient?.sendRequest(GetRunspaceRequestType, { processId });
        const items: IRunspaceItem[] = [];
        for (const runspace of response ?? []) {
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
        this.waitingForClientToken?.dispose();
        this.waitingForClientToken = undefined;
    }
}
