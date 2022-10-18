// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import vscode = require("vscode");
import TelemetryReporter from "@vscode/extension-telemetry";
import { DocumentSelector } from "vscode-languageclient";
import { CodeActionsFeature } from "./features/CodeActions";
import { ConsoleFeature } from "./features/Console";
import { CustomViewsFeature } from "./features/CustomViews";
import { DebugSessionFeature } from "./features/DebugSession";
import { ExamplesFeature } from "./features/Examples";
import { ExpandAliasFeature } from "./features/ExpandAlias";
import { ExtensionCommandsFeature } from "./features/ExtensionCommands";
import { ExternalApiFeature, IPowerShellExtensionClient } from "./features/ExternalApi";
import { FindModuleFeature } from "./features/FindModule";
import { GenerateBugReportFeature } from "./features/GenerateBugReport";
import { GetCommandsFeature } from "./features/GetCommands";
import { HelpCompletionFeature } from "./features/HelpCompletion";
import { ISECompatibilityFeature } from "./features/ISECompatibility";
import { NewFileOrProjectFeature } from "./features/NewFileOrProject";
import { OpenInISEFeature } from "./features/OpenInISE";
import { PesterTestsFeature } from "./features/PesterTests";
import { PickPSHostProcessFeature, PickRunspaceFeature } from "./features/DebugSession";
import { RemoteFilesFeature } from "./features/RemoteFiles";
import { RunCodeFeature } from "./features/RunCode";
import { ShowHelpFeature } from "./features/ShowHelp";
import { SpecifyScriptArgsFeature } from "./features/DebugSession";
import { Logger } from "./logging";
import { SessionManager } from "./session";
import Settings = require("./settings");
import { PowerShellLanguageId } from "./utils";
import { LanguageClientConsumer } from "./languageClientConsumer";

// The most reliable way to get the name and version of the current extension.
// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-var-requires
const PackageJSON: any = require("../package.json");

// the application insights key (also known as instrumentation key) used for telemetry.
const AI_KEY = "AIF-d9b70cd4-b9f9-4d70-929b-a071c400b217";

let logger: Logger;
let sessionManager: SessionManager;
let languageClientConsumers: LanguageClientConsumer[] = [];
let commandRegistrations: vscode.Disposable[] = [];
let telemetryReporter: TelemetryReporter;

const documentSelector: DocumentSelector = [
    { language: "powershell", scheme: "file" },
    { language: "powershell", scheme: "untitled" },
];

// NOTE: Now that this is async, we can probably improve a lot!
export async function activate(context: vscode.ExtensionContext): Promise<IPowerShellExtensionClient> {
    telemetryReporter = new TelemetryReporter(PackageJSON.name, PackageJSON.version, AI_KEY);

    // If both extensions are enabled, this will cause unexpected behavior since both register the same commands.
    // TODO: Merge extensions and use preview channel in marketplace instead.
    if (PackageJSON.name.toLowerCase() === "powershell-preview"
        && vscode.extensions.getExtension("ms-vscode.powershell")) {
        vscode.window.showWarningMessage(
            "'PowerShell' and 'PowerShell Preview' are both enabled. Please disable one for best performance.");
    }

    // Load and validate settings (will prompt for 'cwd' if necessary).
    await Settings.validateCwdSetting();
    const settings = Settings.load();

    vscode.languages.setLanguageConfiguration(
        PowerShellLanguageId,
        {
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
                    beforeText: /^\s*\/\*\*(?!\/)([^\*]|\*(?!\/))*$/,
                    afterText: /^\s*\*\/$/,
                    action: { indentAction: vscode.IndentAction.IndentOutdent, appendText: " * " },
                },
                {
                    // e.g. /** ...|
                    beforeText: /^\s*\/\*\*(?!\/)([^\*]|\*(?!\/))*$/,
                    action: { indentAction: vscode.IndentAction.None, appendText: " * " },
                },
                {
                    // e.g.  * ...|
                    beforeText: /^(\t|(\ \ ))*\ \*(\ ([^\*]|\*(?!\/))*)?$/,
                    action: { indentAction: vscode.IndentAction.None, appendText: "* " },
                },
                {
                    // e.g.  */|
                    beforeText: /^(\t|(\ \ ))*\ \*\/\s*$/,
                    action: { indentAction: vscode.IndentAction.None, removeText: 1 },
                },
                {
                    // e.g.  *-----*/|
                    beforeText: /^(\t|(\ \ ))*\ \*[^/]*\*\/\s*$/,
                    action: { indentAction: vscode.IndentAction.None, removeText: 1 },
                },
            ],
        });

    // Setup the logger.
    logger = new Logger(context.globalStorageUri);
    logger.MinimumLogLevel = Logger.logLevelNameToValue(settings.developer.editorServicesLogLevel);

    sessionManager = new SessionManager(
        context,
        settings,
        logger,
        documentSelector,
        PackageJSON.displayName,
        PackageJSON.version,
        telemetryReporter);

    // Register commands that do not require Language client
    commandRegistrations = [
        new ExamplesFeature(),
        new GenerateBugReportFeature(sessionManager),
        new ISECompatibilityFeature(),
        new OpenInISEFeature(),
        new PesterTestsFeature(sessionManager),
        new RunCodeFeature(sessionManager),
        new CodeActionsFeature(logger),
        new SpecifyScriptArgsFeature(context),
    ];

    const externalApi = new ExternalApiFeature(context, sessionManager, logger);

    // Features and command registrations that require language client
    languageClientConsumers = [
        new ConsoleFeature(logger),
        new ExpandAliasFeature(),
        new GetCommandsFeature(logger),
        new ShowHelpFeature(),
        new FindModuleFeature(),
        new ExtensionCommandsFeature(logger),
        new NewFileOrProjectFeature(),
        new RemoteFilesFeature(),
        new DebugSessionFeature(context, sessionManager, logger),
        new PickPSHostProcessFeature(),
        new HelpCompletionFeature(logger),
        new CustomViewsFeature(),
        new PickRunspaceFeature(),
        externalApi
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
    };
}

export async function deactivate(): Promise<void> {
    // Clean up all extension features
    for (const languageClientConsumer of languageClientConsumers) {
        languageClientConsumer.dispose();
    }

    for (const commandRegistration of commandRegistrations) {
        commandRegistration.dispose();
    }

    // Dispose of the current session
    await sessionManager.dispose();

    // Dispose of the logger
    logger.dispose();

    // Dispose of telemetry reporter
    await telemetryReporter.dispose();
}
