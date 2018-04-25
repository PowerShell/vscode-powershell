/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

"use strict";

import path = require("path");
import vscode = require("vscode");
import { DocumentSelector } from "vscode-languageclient";
import { IFeature } from "./feature";
import { CodeActionsFeature } from "./features/CodeActions";
import { ConsoleFeature } from "./features/Console";
import { CustomViewsFeature } from "./features/CustomViews";
import { DebugSessionFeature } from "./features/DebugSession";
import { PickPSHostProcessFeature } from "./features/DebugSession";
import { SpecifyScriptArgsFeature } from "./features/DebugSession";
import { DocumentFormatterFeature } from "./features/DocumentFormatter";
import { ExamplesFeature } from "./features/Examples";
import { ExpandAliasFeature } from "./features/ExpandAlias";
import { ExtensionCommandsFeature } from "./features/ExtensionCommands";
import { GenerateBugReportFeature } from "./features/GenerateBugReport";
import { HelpCompletionFeature } from "./features/HelpCompletion";
import { NewFileOrProjectFeature } from "./features/NewFileOrProject";
import { OpenInISEFeature } from "./features/OpenInISE";
import { PesterTestsFeature } from "./features/PesterTests";
import { FindModuleFeature } from "./features/PowerShellFindModule";
import { RemoteFilesFeature } from "./features/RemoteFiles";
import { SelectPSSARulesFeature } from "./features/SelectPSSARules";
import { ShowHelpFeature } from "./features/ShowOnlineHelp";
import { Logger, LogLevel } from "./logging";
import { SessionManager } from "./session";
import Settings = require("./settings");
import { PowerShellLanguageId } from "./utils";
import utils = require("./utils");

// NOTE: We will need to find a better way to deal with the required
//       PS Editor Services version...
const requiredEditorServicesVersion = "1.7.0";

let logger: Logger;
let sessionManager: SessionManager;
let extensionFeatures: IFeature[] = [];

const documentSelector: DocumentSelector = [
    { language: "powershell", scheme: "file" },
    { language: "powershell", scheme: "untitled" },
];

export function activate(context: vscode.ExtensionContext): void {

    checkForUpdatedVersion(context);

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

    sessionManager =
        new SessionManager(
            requiredEditorServicesVersion,
            logger, documentSelector);

    // Create features
    extensionFeatures = [
        new ConsoleFeature(),
        new ExamplesFeature(),
        new OpenInISEFeature(),
        new GenerateBugReportFeature(sessionManager),
        new ExpandAliasFeature(),
        new ShowHelpFeature(),
        new FindModuleFeature(),
        new PesterTestsFeature(sessionManager),
        new ExtensionCommandsFeature(),
        new SelectPSSARulesFeature(),
        new CodeActionsFeature(),
        new NewFileOrProjectFeature(),
        new DocumentFormatterFeature(logger, documentSelector),
        new RemoteFilesFeature(),
        new DebugSessionFeature(context, sessionManager),
        new PickPSHostProcessFeature(),
        new SpecifyScriptArgsFeature(context),
        new HelpCompletionFeature(logger),
        new CustomViewsFeature(),
    ];

    sessionManager.setExtensionFeatures(extensionFeatures);

    const extensionSettings = Settings.load();
    if (extensionSettings.startAutomatically) {
        sessionManager.start();
    }
}

function checkForUpdatedVersion(context: vscode.ExtensionContext) {

    const showReleaseNotes = "Show Release Notes";
    const powerShellExtensionVersionKey = "powerShellExtensionVersion";

    const extensionVersion: string =
        vscode
            .extensions
            .getExtension("ms-vscode.PowerShell")
            .packageJSON
            .version;

    const storedVersion = context.globalState.get(powerShellExtensionVersionKey);

    if (!storedVersion) {
        // TODO: Prompt to show User Guide for first-time install
    } else if (extensionVersion !== storedVersion) {
        vscode
            .window
            .showInformationMessage(
                `The PowerShell extension has been updated to version ${extensionVersion}!`,
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
        extensionVersion);
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
}
