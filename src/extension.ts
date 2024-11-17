// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import vscode = require("vscode");
import TelemetryReporter from "@vscode/extension-telemetry";
import { DocumentSelector } from "vscode-languageclient";
import { CodeActionsFeature } from "./features/CodeActions";
import { ConsoleFeature } from "./features/Console";
import { DebugSessionFeature } from "./features/DebugSession";
import { ExamplesFeature } from "./features/Examples";
import { ExpandAliasFeature } from "./features/ExpandAlias";
import { ExtensionCommandsFeature } from "./features/ExtensionCommands";
import { ExternalApiFeature, IPowerShellExtensionClient } from "./features/ExternalApi";
import { GenerateBugReportFeature } from "./features/GenerateBugReport";
import { GetCommandsFeature } from "./features/GetCommands";
import { HelpCompletionFeature } from "./features/HelpCompletion";
import { ISECompatibilityFeature } from "./features/ISECompatibility";
import { OpenInISEFeature } from "./features/OpenInISE";
import { PesterTestsFeature } from "./features/PesterTests";
import { RemoteFilesFeature } from "./features/RemoteFiles";
import { ShowHelpFeature } from "./features/ShowHelp";
import { SpecifyScriptArgsFeature } from "./features/DebugSession";
import { Logger } from "./logging";
import { SessionManager } from "./session";
import { getSettings } from "./settings";
import { PowerShellLanguageId } from "./utils";
import { LanguageClientConsumer } from "./languageClientConsumer";
// The 1DS telemetry key, which is just shared among all Microsoft extensions
// (and isn't sensitive).
const TELEMETRY_KEY = "0c6ae279ed8443289764825290e4f9e2-1a736e7c-1324-4338-be46-fc2a58ae4d14-7255";

let languageConfigurationDisposable: vscode.Disposable;
let logger: Logger;
let sessionManager: SessionManager;
let languageClientConsumers: LanguageClientConsumer[] = [];
let commandRegistrations: vscode.Disposable[] = [];
let telemetryReporter: TelemetryReporter;

const documentSelector: DocumentSelector = [
    { language: "powershell", scheme: "file" },
    { language: "powershell", scheme: "untitled" },
];

export async function activate(context: vscode.ExtensionContext): Promise<IPowerShellExtensionClient> {
    logger = new Logger();
    if (context.extensionMode === vscode.ExtensionMode.Development) {
        restartOnExtensionFileChanges(context);
    }

    telemetryReporter = new TelemetryReporter(TELEMETRY_KEY);

    const settings = getSettings();
    logger.writeDebug(`Loaded settings:\n${JSON.stringify(settings, undefined, 2)}`);

    languageConfigurationDisposable = vscode.languages.setLanguageConfiguration(
        PowerShellLanguageId,
        {
            // TODO: Remove the useless escapes
            // eslint-disable-next-line no-useless-escape
            wordPattern: /(-?\d*\.\d\w*)|([^\`\~\!\@\#\%\^\&\*\(\)\=\+\[\{\]\}\\\|\;\'\"\,\.\<\>\/\?\s]+)/g,

            indentationRules: {
                // ^(.*\*/)?\s*\}.*$
                decreaseIndentPattern: /^(.*\*\/)?\s*\}.*$/,
                // ^.*\{[^}"']*$
                increaseIndentPattern: /^.*\{[^}"']*$/,
            },

            comments: {
                lineComment: "#",
                blockComment: ["<#", "#>"],
            },

            brackets: [
                ["{", "}"],
                ["[", "]"],
                ["(", ")"],
            ],

            onEnterRules: [
                {
                    // e.g. /** | */
                    // eslint-disable-next-line no-useless-escape
                    beforeText: /^\s*\/\*\*(?!\/)([^\*]|\*(?!\/))*$/,
                    // eslint-disable-next-line no-useless-escape
                    afterText: /^\s*\*\/$/,
                    action: { indentAction: vscode.IndentAction.IndentOutdent, appendText: " * " },
                },
                {
                    // e.g. /** ...|
                    // eslint-disable-next-line no-useless-escape
                    beforeText: /^\s*\/\*\*(?!\/)([^\*]|\*(?!\/))*$/,
                    action: { indentAction: vscode.IndentAction.None, appendText: " * " },
                },
                {
                    // e.g.  * ...|
                    // eslint-disable-next-line no-useless-escape
                    beforeText: /^(\t|(\ \ ))*\ \*(\ ([^\*]|\*(?!\/))*)?$/,
                    action: { indentAction: vscode.IndentAction.None, appendText: "* " },
                },
                {
                    // e.g.  */|
                    // eslint-disable-next-line no-useless-escape
                    beforeText: /^(\t|(\ \ ))*\ \*\/\s*$/,
                    action: { indentAction: vscode.IndentAction.None, removeText: 1 },
                },
                {
                    // e.g.  *-----*/|
                    // eslint-disable-next-line no-useless-escape
                    beforeText: /^(\t|(\ \ ))*\ \*[^/]*\*\/\s*$/,
                    action: { indentAction: vscode.IndentAction.None, removeText: 1 },
                },
            ],
        });

    interface IPackageInfo {
        name: string;
        displayName: string;
        version: string;
        publisher: string;
    }
    const packageInfo:IPackageInfo = context.extension.packageJSON;

    sessionManager = new SessionManager(
        context,
        settings,
        logger,
        documentSelector,
        packageInfo.name,
        packageInfo.displayName,
        packageInfo.version,
        packageInfo.publisher,
        telemetryReporter);

    // Register commands that do not require Language client
    commandRegistrations = [
        new ExamplesFeature(),
        new GenerateBugReportFeature(sessionManager),
        new ISECompatibilityFeature(),
        new OpenInISEFeature(),
        new PesterTestsFeature(sessionManager, logger),
        new CodeActionsFeature(logger),
        new SpecifyScriptArgsFeature(context),

        vscode.commands.registerCommand(
            "PowerShell.OpenLogFolder",
            async () => {await vscode.commands.executeCommand(
                "vscode.openFolder",
                context.logUri,
                { forceNewWindow: true }
            );}
        ),
        vscode.commands.registerCommand(
            "PowerShell.ShowLogs",
            () => {logger.showLogPanel();}
        ),
        vscode.commands.registerCommand(
            "GetVsCodeSessionId",
            () => vscode.env.sessionId
        ),
        // Register a command that waits for the Extension Terminal to be active. Can be used by .NET Attach Tasks.
        registerWaitForPsesActivationCommand(context)
    ];

    const externalApi = new ExternalApiFeature(context, sessionManager, logger);

    // Features and command registrations that require language client
    languageClientConsumers = [
        new ConsoleFeature(logger),
        new ExpandAliasFeature(),
        new GetCommandsFeature(),
        new ShowHelpFeature(),
        new ExtensionCommandsFeature(logger),
        new RemoteFilesFeature(),
        new DebugSessionFeature(context, sessionManager, logger),
        new HelpCompletionFeature(),
    ];

    sessionManager.setLanguageClientConsumers(languageClientConsumers);

    if (settings.startAutomatically) {
        await sessionManager.start();
    }

    return {
        registerExternalExtension: (id: string, apiVersion = "v1") => externalApi.registerExternalExtension(id, apiVersion),
        unregisterExternalExtension: uuid => externalApi.unregisterExternalExtension(uuid),
        getPowerShellVersionDetails: uuid => externalApi.getPowerShellVersionDetails(uuid),
        waitUntilStarted: uuid => externalApi.waitUntilStarted(uuid),
        getStorageUri: () => externalApi.getStorageUri(),
        getLogUri: () => externalApi.getLogUri(),
    };
}

/** Registers a command that waits for PSES Activation and returns the PID, used to auto-attach the PSES debugger */
function registerWaitForPsesActivationCommand(context: vscode.ExtensionContext): vscode.Disposable {
    return vscode.commands.registerCommand(
        "PowerShell.WaitForPsesActivationAndReturnProcessId",
        async () => {
            const pidFileName = `PSES-${vscode.env.sessionId}.pid`;
            const pidFile = vscode.Uri.joinPath(context.globalStorageUri, "sessions", pidFileName);
            const fs = vscode.workspace.fs;
            // Wait for the file to be created
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition, no-constant-condition
            while (true) {
                try {
                    const pidContent = await fs.readFile(pidFile);
                    const pid = parseInt(pidContent.toString(), 10);
                    try {
                        // Check if the process is still alive, delete the PID file if not and continue waiting.
                        // https://nodejs.org/api/process.html#process_process_kill_pid_signal
                        // "As a special case, a signal of 0 can be used to test for the existence of a process. "
                        const NODE_TEST_PROCESS_EXISTENCE = 0;
                        process.kill(pid, NODE_TEST_PROCESS_EXISTENCE);
                    } catch {
                        await fs.delete(pidFile);
                        continue;
                    }
                    // VSCode command returns for launch configurations *must* be string type explicitly, will error on number or otherwise.
                    return pidContent.toString();
                } catch {
                    // File doesn't exist yet, wait and try again
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
        }
    );
}

/** Restarts the extension host when extension file changes are detected. Useful for development. */
function restartOnExtensionFileChanges(context: vscode.ExtensionContext): void {
    const watcher = vscode.workspace.createFileSystemWatcher(
        new vscode.RelativePattern(context.extensionPath, "dist/*.js")
    );

    context.subscriptions.push(watcher);
    watcher.onDidChange(({ fsPath }) => {
        vscode.window.showInformationMessage(`${fsPath.split(context.extensionPath, 2)[1]} changed. Reloading Extension Host...`);
        vscode.commands.executeCommand("workbench.action.restartExtensionHost");
    });
}

export async function deactivate(): Promise<void> {
    // Clean up all extension features
    for (const commandRegistration of commandRegistrations) {
        commandRegistration.dispose();
    }

    // Dispose of the current session
    await sessionManager.dispose();

    // Dispose of the logger
    logger.dispose();

    // Dispose of telemetry reporter
    await telemetryReporter.dispose();

    languageConfigurationDisposable.dispose();
}
