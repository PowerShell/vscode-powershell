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
import { NewFileOrProjectFeature } from "./features/NewFileOrProject";
import { OpenInISEFeature } from "./features/OpenInISE";
import { PesterTestsFeature } from "./features/PesterTests";
import { PickPSHostProcessFeature, PickRunspaceFeature } from "./features/DebugSession";
import { RemoteFilesFeature } from "./features/RemoteFiles";
import { ShowHelpFeature } from "./features/ShowHelp";
import { SpecifyScriptArgsFeature } from "./features/DebugSession";
import { Logger } from "./logging";
import { SessionManager } from "./session";
import { LogLevel, getSettings } from "./settings";
import { PowerShellLanguageId } from "./utils";
import { LanguageClientConsumer } from "./languageClientConsumer";

// The most reliable way to get the name and version of the current extension.
// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-var-requires
const PackageJSON: any = require("../package.json");

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
    const logLevel = vscode.workspace.getConfiguration(`${PowerShellLanguageId}.developer`)
        .get<string>("editorServicesLogLevel", LogLevel.Normal);
    logger = new Logger(logLevel, context.globalStorageUri);

    telemetryReporter = new TelemetryReporter(TELEMETRY_KEY);

    const settings = getSettings();
    logger.writeVerbose(`Loaded settings:\n${JSON.stringify(settings, undefined, 2)}`);

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

    sessionManager = new SessionManager(
        context,
        settings,
        logger,
        documentSelector,
        PackageJSON.name,
        PackageJSON.displayName,
        PackageJSON.version,
        PackageJSON.publisher,
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
    ];

    const externalApi = new ExternalApiFeature(context, sessionManager, logger);

    // Features and command registrations that require language client
    languageClientConsumers = [
        new ConsoleFeature(logger),
        new ExpandAliasFeature(),
        new GetCommandsFeature(logger),
        new ShowHelpFeature(),
        new ExtensionCommandsFeature(logger),
        new NewFileOrProjectFeature(logger),
        new RemoteFilesFeature(),
        new DebugSessionFeature(context, sessionManager, logger),
        new PickPSHostProcessFeature(logger),
        new HelpCompletionFeature(),
        new PickRunspaceFeature(logger),
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

    languageConfigurationDisposable.dispose();
}
