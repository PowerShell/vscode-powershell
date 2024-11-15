// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import {
    debug,
    CancellationToken,
    CancellationTokenSource,
    DebugAdapterDescriptor,
    DebugAdapterDescriptorFactory,
    DebugAdapterExecutable,
    DebugAdapterNamedPipeServer,
    DebugConfiguration,
    DebugConfigurationProvider,
    DebugSession,
    ExtensionContext,
    WorkspaceFolder,
    Disposable,
    window,
    extensions,
    workspace,
    commands,
    InputBoxOptions,
    QuickPickItem,
    QuickPickOptions,
    DebugConfigurationProviderTriggerKind,
    DebugAdapterTrackerFactory,
    DebugAdapterTracker,
    LogOutputChannel
} from "vscode";
import type { DebugProtocol } from "@vscode/debugprotocol";
import { NotificationType, RequestType } from "vscode-languageclient";
import { LanguageClient } from "vscode-languageclient/node";
import { LanguageClientConsumer } from "../languageClientConsumer";
import { ILogger } from "../logging";
import { OperatingSystem, getPlatformDetails } from "../platform";
import { PowerShellProcess } from "../process";
import { IEditorServicesSessionDetails, SessionManager } from "../session";
import { getSettings } from "../settings";
import path from "path";
import { checkIfFileExists } from "../utils";

export const StartDebuggerNotificationType =
    new NotificationType<void>("powerShell/startDebugger");

export const StopDebuggerNotificationType =
    new NotificationType<void>("powerShell/stopDebugger");

export enum DebugConfig {
    LaunchCurrentFile,
    LaunchScript,
    InteractiveSession,
    AttachHostProcess,
    RunPester,
    ModuleInteractiveSession,
    BinaryModule,
    BinaryModulePester,
}

/** Make the implicit behavior of undefined and null in the debug api more explicit  */
type PREVENT_DEBUG_START = undefined;
type PREVENT_DEBUG_START_AND_OPEN_DEBUGCONFIG = null;
type ResolveDebugConfigurationResult = DebugConfiguration | PREVENT_DEBUG_START | PREVENT_DEBUG_START_AND_OPEN_DEBUGCONFIG;

const PREVENT_DEBUG_START = undefined;
const PREVENT_DEBUG_START_AND_OPEN_DEBUGCONFIG = null;

/** Represents the various built-in debug configurations that will be advertised to the user if they choose "Add Config" from the launch debug config window */
// NOTE: These are duplicated with what is in package.json until https://github.com/microsoft/vscode/issues/150663#issuecomment-1506134754 is resolved.
export const DebugConfigurations: Record<DebugConfig, DebugConfiguration> = {
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
    },
    [DebugConfig.RunPester]: {
        name: "PowerShell: Run Pester Tests",
        type: "PowerShell",
        request: "launch",
        script: "Invoke-Pester",
        createTemporaryIntegratedConsole: true,
        attachDotnetDebugger: true,
    },
    [DebugConfig.ModuleInteractiveSession]: {
        name: "PowerShell: Module Interactive Session",
        type: "PowerShell",
        request: "launch",
        script: "Enter command to import your binary module, for example: \"Import-Module -Force ${workspaceFolder}/path/to/module.psd1|dll\"",
    },
    [DebugConfig.BinaryModule]: {
        name: "PowerShell: Binary Module Interactive",
        type: "PowerShell",
        request: "launch",
        script: "Enter command to import your binary module, for example: \"Import-Module -Force ${workspaceFolder}/path/to/module.psd1|dll\"",
        createTemporaryIntegratedConsole: true,
        attachDotnetDebugger: true,
    },
    [DebugConfig.BinaryModulePester]: {
        name: "PowerShell: Binary Module Pester Tests",
        type: "PowerShell",
        request: "launch",
        script: "Invoke-Pester",
        createTemporaryIntegratedConsole: true,
        attachDotnetDebugger: true,
    }
};

export class DebugSessionFeature extends LanguageClientConsumer
    implements DebugConfigurationProvider, DebugAdapterDescriptorFactory {
    private tempDebugProcess: PowerShellProcess | undefined;
    private tempSessionDetails: IEditorServicesSessionDetails | undefined;
    private commands: Disposable[] = [];
    private handlers: Disposable[] = [];
    private adapterName = "PowerShell";

    constructor(context: ExtensionContext, private sessionManager: SessionManager, private logger: ILogger) {
        super();

        this.activateDebugAdaptor(context);

        // NOTE: While process and runspace IDs are numbers, command
        // substitutions in VS Code debug configurations are required to return
        // strings. Hence to the `toString()` on these.
        this.commands = [
            commands.registerCommand("PowerShell.PickPSHostProcess", async () => {
                const processId = await this.pickPSHostProcess();
                return processId?.toString();
            }),

            commands.registerCommand("PowerShell.PickRunspace", async (processId) => {
                const runspace = await this.pickRunspace(processId);
                return runspace?.toString();
            }, this),
        ];
    }

    public dispose(): void {
        for (const command of this.commands) {
            command.dispose();
        }

        for (const handler of this.handlers) {
            handler.dispose();
        }
    }

    // This "activates" the debug adapter. You can only do this once.
    public activateDebugAdaptor(context: ExtensionContext): void {
        const triggers = [
            DebugConfigurationProviderTriggerKind.Initial,
            DebugConfigurationProviderTriggerKind.Dynamic
        ];


        for (const triggerKind of triggers) {
            context.subscriptions.push(
                debug.registerDebugConfigurationProvider(this.adapterName, this, triggerKind)
            );
        }

        context.subscriptions.push(
            debug.registerDebugAdapterTrackerFactory(this.adapterName, new PowerShellDebugAdapterTrackerFactory(this.adapterName)),
            debug.registerDebugAdapterDescriptorFactory(this.adapterName, this)
        );
    }

    public override onLanguageClientSet(languageClient: LanguageClient): void {
        this.handlers = [
            languageClient.onNotification(
                StartDebuggerNotificationType,
                () => void debug.startDebugging(undefined, DebugConfigurations[DebugConfig.InteractiveSession])),

            languageClient.onNotification(
                StopDebuggerNotificationType,
                () => void debug.stopDebugging(undefined))
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
            {
                id: DebugConfig.RunPester,
                label: "Run Pester Tests",
                description: "Debug Pester Tests detected in your current directory (runs Invoke-Pester)",
            },
            {
                id: DebugConfig.ModuleInteractiveSession,
                label: "Interactive Session (Module)",
                description: "Debug commands executed from the PowerShell Extension Terminal after auto-loading your module",
            },
            {
                id: DebugConfig.BinaryModule,
                label: "Interactive Session (Binary Module)",
                description: "Debug a .NET binary or hybrid module loaded into a PowerShell session. Breakpoints you set in your .NET (C#/F#/VB/etc.) code will be hit upon command execution. You may want to add a compile or watch action as a pre-launch task to this configuration.",
            },
            {
                id: DebugConfig.RunPester,
                label: "Run Pester Tests (Binary Module)",
                description: "Debug a .NET binary or hybrid module by running Pester tests. Breakpoints you set in your .NET (C#/F#/VB/etc.) code will be hit upon command execution. You may want to add a compile or watch action as a pre-launch task to this configuration.",
            },
        ];

        const launchSelection =
            await window.showQuickPick(
                debugConfigPickItems,
                { placeHolder: "Select a PowerShell debug configuration" });

        if (launchSelection) {
            return [DebugConfigurations[launchSelection.id]];
        }

        return [DebugConfigurations[DebugConfig.LaunchCurrentFile]];
    }

    // We don't use await here but we are returning a promise and the return syntax is easier in an async function
    // eslint-disable-next-line @typescript-eslint/require-await
    public async resolveDebugConfiguration(
        _folder: WorkspaceFolder | undefined,
        config: DebugConfiguration,
        _token?: CancellationToken): Promise<ResolveDebugConfigurationResult> {

        // NOTE: We intentionally do not touch the `cwd` setting of the config.

        if (!config.request) {
            // No launch.json, create the default configuration for both unsaved
            // (Untitled) and saved documents.
            const LaunchCurrentFileConfig = DebugConfigurations[DebugConfig.LaunchCurrentFile];
            config = { ...config, ...LaunchCurrentFileConfig };
            config.current_document = true;
        }

        if (config.script === "${file}" || config.script === "${relativeFile}") {
            if (window.activeTextEditor === undefined) {
                void this.logger.writeAndShowError("To debug the 'Current File', you must first open a PowerShell script file in the editor.");
                return PREVENT_DEBUG_START;
            }
            config.current_document = true;
            // Special case using the URI for untitled documents.
            const currentDocument = window.activeTextEditor.document;
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
        _token?: CancellationToken): Promise<ResolveDebugConfigurationResult> {

        let resolvedConfig: ResolveDebugConfigurationResult;

        // Prevent the Debug Console from opening
        config.internalConsoleOptions = "neverOpen";

        const settings = getSettings();
        config.createTemporaryIntegratedConsole ??= settings.debugging.createTemporaryIntegratedConsole;
        config.executeMode ??= settings.debugging.executeMode;
        if (config.request === "attach") {
            resolvedConfig = await this.resolveAttachDebugConfiguration(config);
        } else if (config.request === "launch") {
            resolvedConfig = await this.resolveLaunchDebugConfiguration(config);
        } else {
            void this.logger.writeAndShowError(`PowerShell debug configuration's request type was invalid: '${config.request}'.`);
            return PREVENT_DEBUG_START_AND_OPEN_DEBUGCONFIG;
        }

        return resolvedConfig;
    }

    // This is our factory entrypoint hook to when a debug session starts, and
    // where we will lazy initialize everything needed to do the debugging such
    // as a temporary console if required.
    //
    // NOTE: A Promise meets the shape of a ProviderResult, which allows us to
    // make this method async.
    public async createDebugAdapterDescriptor(
        session: DebugSession,
        _executable: DebugAdapterExecutable | undefined): Promise<DebugAdapterDescriptor | undefined> {

        await this.sessionManager.start();

        const sessionDetails = session.configuration.createTemporaryIntegratedConsole
            ? await this.createTemporaryIntegratedConsole(session)
            : this.sessionManager.getSessionDetails();

        if (sessionDetails === undefined) {
            return undefined;
        }

        // Create or show the debug terminal (either temporary or session).
        this.sessionManager.showDebugTerminal(true);

        this.logger.writeDebug(`Connecting to pipe: ${sessionDetails.debugServicePipeName}`);
        this.logger.writeDebug(`Debug configuration: ${JSON.stringify(session.configuration, undefined, 2)}`);

        return new DebugAdapterNamedPipeServer(sessionDetails.debugServicePipeName);
    }

    private async resolveLaunchDebugConfiguration(config: DebugConfiguration): Promise<ResolveDebugConfigurationResult> {
        // Check the languageId and file extension only for current documents
        // (which includes untitled documents). This prevents accidentally
        // running the debugger for an open non-PowerShell file.
        if (config.current_document) {
            const currentDocument = window.activeTextEditor?.document;
            if (currentDocument?.languageId !== "powershell") {
                void this.logger.writeAndShowError(`PowerShell does not support debugging this language mode: '${currentDocument?.languageId}'.`);
                return PREVENT_DEBUG_START_AND_OPEN_DEBUGCONFIG;
            }

            if (await checkIfFileExists(config.script)) {
                const ext = path.extname(config.script).toLowerCase();
                if (!(ext === ".ps1" || ext === ".psm1")) {
                    void this.logger.writeAndShowError(`PowerShell does not support debugging this file type: '${path.basename(config.script)}'.`);
                    return PREVENT_DEBUG_START_AND_OPEN_DEBUGCONFIG;
                }
            }
        }

        if (config.untitled_document && config.createTemporaryIntegratedConsole) {
            void this.logger.writeAndShowError("PowerShell does not support debugging untitled files in a temporary console.");
            return PREVENT_DEBUG_START;
        }

        if (!config.createTemporaryIntegratedConsole && config.attachDotnetDebugger) {
            void this.logger.writeAndShowError("dotnet debugging without using a temporary console is currently not supported. Please updated your launch config to include createTemporaryIntegratedConsole: true.");
            return PREVENT_DEBUG_START_AND_OPEN_DEBUGCONFIG;
        }

        if (config.attachDotnetDebugger) {
            return this.resolveAttachDotnetDebugConfiguration(config);
        }

        return config;
    }

    private resolveAttachDotnetDebugConfiguration(config: DebugConfiguration): ResolveDebugConfigurationResult {
        if (!extensions.getExtension("ms-dotnettools.csharp")) {
            void this.logger.writeAndShowError("You specified attachDotnetDebugger in your PowerShell Launch configuration but the C# extension is not installed. Please install the C# extension and try again.");
            return PREVENT_DEBUG_START;
        }

        const dotnetDebuggerConfig = this.getDotnetNamedConfigOrDefault(config.dotnetDebuggerConfigName);

        if (dotnetDebuggerConfig === undefined) {
            void this.logger.writeAndShowError(`You specified dotnetDebuggerConfigName in your PowerShell Launch configuration but a matching launch config was not found. Please ensure you have a coreclr attach config with the name ${config.dotnetDebuggerConfigName} in your launch.json file or remove dotnetDebuggerConfigName from your PowerShell Launch configuration to use the defaults`);
            return PREVENT_DEBUG_START_AND_OPEN_DEBUGCONFIG;
        }

        config.dotnetAttachConfig = dotnetDebuggerConfig;
        return config;
    }

    private async createTemporaryIntegratedConsole(session: DebugSession): Promise<IEditorServicesSessionDetails | undefined> {
        const settings = getSettings();
        this.tempDebugProcess = await this.sessionManager.createDebugSessionProcess(settings);
        // TODO: Maybe set a timeout on the cancellation token?
        const cancellationTokenSource = new CancellationTokenSource();
        this.tempSessionDetails = await this.tempDebugProcess.start(cancellationTokenSource.token);

        // NOTE: Dotnet attach debugging is only currently supported if a temporary debug terminal is used, otherwise we get lots of lock conflicts from loading the assemblies.
        if (session.configuration.attachDotnetDebugger) {
            const dotnetAttachConfig = session.configuration.dotnetAttachConfig;

            // Will wait until the process is started and available before attaching
            const pid = await this.tempDebugProcess.getPid();
            if (pid === undefined) {
                void this.logger.writeAndShowError("Attach Dotnet Debugger was specified but the PowerShell temporary debug session failed to start. This is probably a bug.");
                return PREVENT_DEBUG_START;
            }
            dotnetAttachConfig.processId = pid;

            // Ensure the .NET session stops before the PowerShell session so that the .NET debug session doesn't emit an error about the process unexpectedly terminating.
            let tempConsoleDotnetAttachSession: DebugSession;
            const startDebugEvent = debug.onDidStartDebugSession(dotnetAttachSession => {
                if (dotnetAttachSession.configuration.name != dotnetAttachConfig.name) { return; }

                // Makes the event one-time
                // HACK: This seems like you would be calling a method on a variable not assigned yet, but it does work in the flow.
                // The dispose shorthand demonry for making an event one-time courtesy of: https://github.com/OmniSharp/omnisharp-vscode/blob/b8b07bb12557b4400198895f82a94895cb90c461/test/integrationTests/launchConfiguration.integration.test.ts#L41-L45
                startDebugEvent.dispose();

                this.logger.writeDebug(`Debugger session detected: ${dotnetAttachSession.name} (${dotnetAttachSession.id})`);

                tempConsoleDotnetAttachSession = dotnetAttachSession;

                const stopDebugEvent = debug.onDidTerminateDebugSession(async tempConsoleSession => {
                    if (tempConsoleDotnetAttachSession.parentSession?.id !== tempConsoleSession.id) { return; }

                    // Makes the event one-time
                    stopDebugEvent.dispose();

                    this.logger.writeDebug(`Debugger session terminated: ${tempConsoleSession.name} (${tempConsoleSession.id})`);

                    // HACK: As of 2023-08-17, there is no vscode debug API to request the C# debugger to detach, so we send it a custom DAP request instead.
                    const disconnectRequest: DebugProtocol.DisconnectRequest = {
                        command: "disconnect",
                        seq: 0,
                        type: "request",
                        arguments: {
                            restart: false,
                            terminateDebuggee: false,
                            suspendDebuggee: false
                        }
                    };

                    try {
                        await dotnetAttachSession.customRequest(
                            disconnectRequest.command,
                            disconnectRequest.arguments
                        );
                    } catch (err) {
                        this.logger.writeWarning(`Disconnect request to dotnet debugger failed: ${err}`);
                    }
                });
            });

            // Start a child debug session to attach the dotnet debugger
            // TODO: Accommodate multi-folder workspaces if the C# code is in a different workspace folder
            await debug.startDebugging(undefined, dotnetAttachConfig, session);
            this.logger.writeDebug(`Dotnet attach debug configuration: ${JSON.stringify(dotnetAttachConfig, undefined, 2)}`);
            this.logger.writeDebug(`Attached dotnet debugger to process: ${pid}`);
        }

        return this.tempSessionDetails;
    }

    private getDotnetNamedConfigOrDefault(configName?: string): ResolveDebugConfigurationResult {
        if (configName) {
            const debugConfigs = this.getLaunchConfigurations();
            return debugConfigs.find(({ type, request, name }) =>
                type === "coreclr" &&
                request === "attach" &&
                name === configName
            );
        }

        // Default debugger config if none provided
        // TODO: Type this appropriately from the C# extension?
        return {
            name: "Dotnet Debugger: Temporary Extension Terminal",
            type: "coreclr",
            request: "attach",
            processId: undefined,
            logging: {
                moduleLoad: false
            }
        };
    }

    /** Fetches all available vscode launch configurations. This is abstracted out for easier testing. */
    private getLaunchConfigurations(): DebugConfiguration[] {
        return workspace.getConfiguration("launch").get<DebugConfiguration[]>("configurations") ?? [];
    }

    private async resolveAttachDebugConfiguration(config: DebugConfiguration): Promise<ResolveDebugConfigurationResult> {
        const platformDetails = getPlatformDetails();
        const versionDetails = this.sessionManager.getPowerShellVersionDetails();
        if (versionDetails === undefined) {
            void this.logger.writeAndShowError(`PowerShell session version details were not found for '${config.name}'.`);
            return PREVENT_DEBUG_START;
        }

        // Cross-platform attach to process was added in 6.2.0-preview.4.
        if (versionDetails.version < "7.0.0" && platformDetails.operatingSystem !== OperatingSystem.Windows) {
            void this.logger.writeAndShowError(`Attaching to a PowerShell Host Process on ${OperatingSystem[platformDetails.operatingSystem]} requires PowerShell 7.0 or higher (Current Version: ${versionDetails.version}).`);
            return PREVENT_DEBUG_START;
        }

        // If nothing is set, prompt for the processId.
        if (!config.customPipeName && !config.processId) {
            config.processId = await this.pickPSHostProcess();
            // No process selected. Cancel attach.
            if (!config.processId) {
                return PREVENT_DEBUG_START;
            }
        }

        // If we were given a stringified int from the user, or from the picker
        // command, we need to parse it here.
        if (typeof config.processId === "string" && config.processId != "current") {
            config.processId = parseInt(config.processId);
        }

        // NOTE: We don't support attaching to the Extension Terminal, even
        // though in the past it looked like we did. The implementation was
        // half-baked and left things unusable.
        if (config.processId === "current" || config.processId === await this.sessionManager.getLanguageServerPid()) {
            // TODO: When (if ever) it's supported, we need to convert 0 and the
            // old notion of "current" to the actual process ID, like this:
            // config.processId = await this.sessionManager.getLanguageServerPid();
            void this.logger.writeAndShowError("Attaching to the PowerShell Extension terminal is not supported. Please use the 'PowerShell: Interactive Session' debug configuration instead.");
            return PREVENT_DEBUG_START_AND_OPEN_DEBUGCONFIG;
        }

        if (!config.runspaceId && !config.runspaceName) {
            config.runspaceId = await this.pickRunspace(config.processId);
            // No runspace selected. Cancel attach.
            if (!config.runspaceId) {
                return PREVENT_DEBUG_START;
            }
        }

        return config;
    }

    private async pickPSHostProcess(): Promise<number | undefined> {
        const client = await LanguageClientConsumer.getLanguageClient();
        const response = await client.sendRequest(GetPSHostProcessesRequestType, {});
        const items: IProcessItem[] = [];
        for (const process of response) {
            let windowTitle = "";
            if (process.mainWindowTitle) {
                windowTitle = `, ${process.mainWindowTitle}`;
            }

            items.push({
                label: process.processName,
                description: `PID: ${process.processId.toString()}${windowTitle}`,
                processId: process.processId,
            });
        }

        if (items.length === 0) {
            return Promise.reject(new Error("There are no PowerShell host processes to attach."));
        }

        const options: QuickPickOptions = {
            placeHolder: "Select a PowerShell host process to attach.",
            matchOnDescription: true,
            matchOnDetail: true,
        };

        const item = await window.showQuickPick(items, options);

        return item?.processId ?? undefined;
    }

    private async pickRunspace(processId: number): Promise<number | undefined> {
        const client = await LanguageClientConsumer.getLanguageClient();
        const response = await client.sendRequest(GetRunspaceRequestType, { processId });
        const items: IRunspaceItem[] = [];
        for (const runspace of response) {
            items.push({
                label: runspace.name,
                description: `ID: ${runspace.id} - ${runspace.availability}`,
                id: runspace.id,
            });
        }

        const options: QuickPickOptions = {
            placeHolder: "Select PowerShell runspace to debug",
            matchOnDescription: true,
            matchOnDetail: true,
        };

        const item = await window.showQuickPick(items, options);

        return item?.id ?? undefined;
    }
}

class PowerShellDebugAdapterTrackerFactory implements DebugAdapterTrackerFactory, Disposable {
    disposables: Disposable[] = [];
    constructor(private adapterName = "PowerShell") {}


    _log: LogOutputChannel | undefined;
    /** Lazily creates a {@link LogOutputChannel} for debug tracing, and presents it only when DAP logging is enabled.
    *
    * We want to use a shared output log for separate debug sessions as usually only one is running at a time and we
    * dont need an output window for every debug session. We also want to leave it active so user can copy and paste
    * even on run end. When user changes the setting and disables it getter will return undefined, which will result
    * in a noop for the logging activities, effectively pausing logging but not disposing the output channel. If the
    * user re-enables, then logging resumes.
    */
    get log(): LogOutputChannel | undefined {
        if (workspace.getConfiguration("powershell.developer").get<boolean>("traceDap") && this._log === undefined) {
            this._log = window.createOutputChannel(`${this.adapterName}: Trace DAP`, { log: true });
            this.disposables.push(this._log);
        }
        return this._log;
    }

    // This tracker effectively implements the logging for the debug adapter to a LogOutputChannel
    createDebugAdapterTracker(session: DebugSession): DebugAdapterTracker {
        const sessionInfo = `${this.adapterName} Debug Session: ${session.name} [${session.id}]`;
        return {
            onWillStartSession: () => this.log?.info(`Starting ${sessionInfo}. Set log level to trace to see DAP messages beyond errors`),
            onWillStopSession: () => this.log?.info(`Stopping ${sessionInfo}`),
            onExit: code => this.log?.info(`${sessionInfo} exited with code ${code}`),
            onWillReceiveMessage: (m): void => {
                this.log?.debug(`➡️${m.seq} ${m.type}: ${m.command}`);
                if (m.arguments && (Array.isArray(m.arguments) ? m.arguments.length > 0 : Object.keys(m.arguments).length > 0)) {
                    this.log?.trace(`${m.seq}: ` + JSON.stringify(m.arguments, undefined, 2));
                }
            },
            onDidSendMessage: (m):void => {
                const responseSummary = m.request_seq !== undefined
                    ? `${m.success ? "✅" : "❌"}${m.request_seq} ${m.type}(${m.seq}): ${m.command}`
                    : `⬅️${m.seq} ${m.type}: ${m.event ?? m.command}`;
                this.log?.debug(
                    responseSummary
                );
                if (m.body && (Array.isArray(m.body) ? m.body.length > 0 : Object.keys(m.body).length > 0)) {
                    this.log?.trace(`${m.seq}: ` + JSON.stringify(m.body, undefined, 2));
                }
            },
            onError: e => this.log?.error(e),
        };
    }

    dispose(): void {
        this.disposables.forEach(d => d.dispose());
    }
}

export class SpecifyScriptArgsFeature implements Disposable {
    private command: Disposable;
    private context: ExtensionContext;

    constructor(context: ExtensionContext) {
        this.context = context;

        this.command = commands.registerCommand("PowerShell.SpecifyScriptArgs", () => {
            return this.specifyScriptArguments();
        });
    }

    public dispose(): void {
        this.command.dispose();
    }

    private async specifyScriptArguments(): Promise<string | undefined> {
        const powerShellDbgScriptArgsKey = "powerShellDebugScriptArgs";

        const options: InputBoxOptions = {
            ignoreFocusOut: true,
            placeHolder: "Enter script arguments or leave empty to pass no args",
        };

        const prevArgs = this.context.workspaceState.get(powerShellDbgScriptArgsKey, "");
        if (prevArgs.length > 0) {
            options.value = prevArgs;
        }

        const text = await window.showInputBox(options);
        // When user cancel's the input box (by pressing Esc), the text value is undefined.
        // Let's not blow away the previous setting.
        if (text !== undefined) {
            await this.context.workspaceState.update(powerShellDbgScriptArgsKey, text);
        }

        return text;
    }
}

interface IProcessItem extends QuickPickItem {
    processId: number; // payload for the QuickPick UI
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface IGetPSHostProcessesArguments {
}

interface IPSHostProcessInfo {
    processName: string;
    processId: number;
    appDomainName: string;
    mainWindowTitle: string;
}

export const GetPSHostProcessesRequestType =
    new RequestType<IGetPSHostProcessesArguments, IPSHostProcessInfo[], string>("powerShell/getPSHostProcesses");


interface IRunspaceItem extends QuickPickItem {
    id: number; // payload for the QuickPick UI
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface IGetRunspaceRequestArguments {
}

interface IRunspace {
    id: number;
    name: string;
    availability: string;
}

export const GetRunspaceRequestType =
    new RequestType<IGetRunspaceRequestArguments, IRunspace[], string>("powerShell/getRunspace");
