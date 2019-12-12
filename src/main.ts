/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

"use strict";

import path = require("path");
import vscode = require("vscode");
import TelemetryReporter from "vscode-extension-telemetry";
import { DocumentSelector } from "vscode-languageclient";
import { IFeature } from "./feature";
import { CodeActionsFeature } from "./features/CodeActions";
import { ConsoleFeature } from "./features/Console";
import { CustomViewsFeature } from "./features/CustomViews";
import { DebugSessionFeature } from "./features/DebugSession";
import { PickPSHostProcessFeature } from "./features/DebugSession";
import { PickRunspaceFeature } from "./features/DebugSession";
import { SpecifyScriptArgsFeature } from "./features/DebugSession";
import { ExamplesFeature } from "./features/Examples";
import { ExpandAliasFeature } from "./features/ExpandAlias";
import { ExtensionCommandsFeature } from "./features/ExtensionCommands";
import { FindModuleFeature } from "./features/FindModule";
import { GenerateBugReportFeature } from "./features/GenerateBugReport";
import { GetCommandsFeature } from "./features/GetCommands";
import { HelpCompletionFeature } from "./features/HelpCompletion";
import { ISECompatibilityFeature } from "./features/ISECompatibility";
import { NewFileOrProjectFeature } from "./features/NewFileOrProject";
import { OpenInISEFeature } from "./features/OpenInISE";
import { PesterTestsFeature } from "./features/PesterTests";
import { RemoteFilesFeature } from "./features/RemoteFiles";
import { RunCodeFeature } from "./features/RunCode";
import { SelectPSSARulesFeature } from "./features/SelectPSSARules";
import { ShowHelpFeature } from "./features/ShowHelp";
import { Logger, LogLevel } from "./logging";
import { SessionManager } from "./session";
import Settings = require("./settings");
import { PowerShellLanguageId } from "./utils";
import utils = require("./utils");

// The most reliable way to get the name and version of the current extension.
// tslint:disable-next-line: no-var-requires
const PackageJSON: any = require("../../package.json");

// NOTE: We will need to find a better way to deal with the required
//       PS Editor Services version...
const requiredEditorServicesVersion = "2.0.0";

// the application insights key (also known as instrumentation key) used for telemetry.
const AI_KEY: string = "AIF-d9b70cd4-b9f9-4d70-929b-a071c400b217";

let logger: Logger;
let sessionManager: SessionManager;
let extensionFeatures: IFeature[] = [];
let telemetryReporter: TelemetryReporter;

const documentSelector: DocumentSelector = [
    { language: "powershell", scheme: "file" },
    { language: "powershell", scheme: "untitled" },
];

export function activate(context: vscode.ExtensionContext): void {
    // create telemetry reporter on extension activation
    telemetryReporter = new TelemetryReporter(PackageJSON.name, PackageJSON.version, AI_KEY);

    // If both extensions are enabled, this will cause unexpected behavior since both register the same commands
    if (PackageJSON.name.toLowerCase() === "powershell-preview"
        && vscode.extensions.getExtension("ms-vscode.powershell")) {
        vscode.window.showWarningMessage(
            "'PowerShell' and 'PowerShell Preview' are both enabled. Please disable one for best performance.");
    }

    checkForUpdatedVersion(context, PackageJSON.version);

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

    // Create the logger
    logger = new Logger();

    // Set the log level
    const extensionSettings = Settings.load();
    logger.MinimumLogLevel = LogLevel[extensionSettings.developer.editorServicesLogLevel];

    sessionManager =
        new SessionManager(
            requiredEditorServicesVersion,
            logger,
            documentSelector,
            PackageJSON.version,
            telemetryReporter);

    // Create features
    extensionFeatures = [
        new ConsoleFeature(logger),
        new ExamplesFeature(),
        new OpenInISEFeature(),
        new GenerateBugReportFeature(sessionManager),
        new ExpandAliasFeature(logger),
        new GetCommandsFeature(logger),
        new ISECompatibilityFeature(),
        new ShowHelpFeature(logger),
        new FindModuleFeature(),
        new PesterTestsFeature(sessionManager),
        new RunCodeFeature(sessionManager),
        new ExtensionCommandsFeature(logger),
        new SelectPSSARulesFeature(logger),
        new CodeActionsFeature(logger),
        new NewFileOrProjectFeature(),
        new RemoteFilesFeature(),
        new DebugSessionFeature(context, sessionManager),
        new PickPSHostProcessFeature(),
        new SpecifyScriptArgsFeature(context),
        new HelpCompletionFeature(logger),
        new CustomViewsFeature(),
        new PickRunspaceFeature(),
    ];

    sessionManager.setExtensionFeatures(extensionFeatures);

    if (extensionSettings.startAutomatically) {
        sessionManager.start();
    }
}

function checkForUpdatedVersion(context: vscode.ExtensionContext, version: string) {

    const showReleaseNotes = "Show Release Notes";
    const powerShellExtensionVersionKey = "powerShellExtensionVersion";

    const storedVersion = context.globalState.get(powerShellExtensionVersionKey);

    if (!storedVersion) {
        // TODO: Prompt to show User Guide for first-time install
    } else if (version !== storedVersion) {
        vscode
            .window
            .showInformationMessage(
                `The PowerShell extension has been updated to version ${version}!`,
                showReleaseNotes)
            .then((choice) => {
                if (choice === showReleaseNotes) {
                    vscode.commands.executeCommand(
                        "markdown.showPreview",
                        vscode.Uri.file(path.resolve(__dirname, "../../CHANGELOG.md")));
                }
            });
    }

    context.globalState.update(
        powerShellExtensionVersionKey,
        version);
}

export function deactivate(): void {
    // Clean up all extension features
    extensionFeatures.forEach((feature) => {
       feature.dispose();
    });

    // Dispose of the current session
    sessionManager.dispose();

    // Dispose of the logger
    logger.dispose();

    // Dispose of telemetry reporter
    telemetryReporter.dispose();
}
