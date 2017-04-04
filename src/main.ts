/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

'use strict';

import vscode = require('vscode');
import utils = require('./utils');
import path = require('path');
import Settings = require('./settings');
import { Logger, LogLevel } from './logging';
import { IFeature } from './feature';
import { SessionManager } from './session';
import { PowerShellLanguageId } from './utils';
import { ConsoleFeature } from './features/Console';
import { ExamplesFeature } from './features/Examples';
import { OpenInISEFeature } from './features/OpenInISE';
import { ExpandAliasFeature } from './features/ExpandAlias';
import { ShowHelpFeature } from './features/ShowOnlineHelp';
import { CodeActionsFeature } from './features/CodeActions';
import { RemoteFilesFeature } from './features/RemoteFiles';
import { DebugSessionFeature } from './features/DebugSession';
import { PickPSHostProcessFeature } from './features/DebugSession';
import { SelectPSSARulesFeature } from './features/SelectPSSARules';
import { FindModuleFeature } from './features/PowerShellFindModule';
import { NewFileOrProjectFeature } from './features/NewFileOrProject';
import { ExtensionCommandsFeature } from './features/ExtensionCommands';
import { DocumentFormatterFeature } from './features/DocumentFormatter';

// NOTE: We will need to find a better way to deal with the required
//       PS Editor Services version...
var requiredEditorServicesVersion = "0.12.0";

var logger: Logger = undefined;
var sessionManager: SessionManager = undefined;
var extensionFeatures: IFeature[] = [];

// Clean up the session file just in case one lingers from a previous session
utils.deleteSessionFile();

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
                increaseIndentPattern: /^.*\{[^}"']*$/
            },

            comments: {
                lineComment: '#',
                blockComment: ['<#', '#>']
            },

            brackets: [
                ['{', '}'],
                ['[', ']'],
                ['(', ')'],
            ],

			onEnterRules: [
				{
					// e.g. /** | */
					beforeText: /^\s*\/\*\*(?!\/)([^\*]|\*(?!\/))*$/,
					afterText: /^\s*\*\/$/,
					action: { indentAction: vscode.IndentAction.IndentOutdent, appendText: ' * ' }
				},
				{
					// e.g. /** ...|
					beforeText: /^\s*\/\*\*(?!\/)([^\*]|\*(?!\/))*$/,
					action: { indentAction: vscode.IndentAction.None, appendText: ' * ' }
				},
				{
					// e.g.  * ...|
					beforeText: /^(\t|(\ \ ))*\ \*(\ ([^\*]|\*(?!\/))*)?$/,
					action: { indentAction: vscode.IndentAction.None, appendText: '* ' }
				},
				{
					// e.g.  */|
					beforeText: /^(\t|(\ \ ))*\ \*\/\s*$/,
					action: { indentAction: vscode.IndentAction.None, removeText: 1 }
				},
				{
					// e.g.  *-----*/|
					beforeText: /^(\t|(\ \ ))*\ \*[^/]*\*\/\s*$/,
					action: { indentAction: vscode.IndentAction.None, removeText: 1 }
				}
			]
        });

    // Create the logger
    logger = new Logger();

    // Create features
    extensionFeatures = [
        new ConsoleFeature(),
        new ExamplesFeature(),
        new OpenInISEFeature(),
        new ExpandAliasFeature(),
        new ShowHelpFeature(),
        new FindModuleFeature(),
        new ExtensionCommandsFeature(),
        new SelectPSSARulesFeature(),
        new CodeActionsFeature(),
        new NewFileOrProjectFeature(),
        new DocumentFormatterFeature(),
        new RemoteFilesFeature(),
        new DebugSessionFeature(),
        new PickPSHostProcessFeature()
    ];

    sessionManager =
        new SessionManager(
            requiredEditorServicesVersion,
            logger,
            extensionFeatures);

    var extensionSettings = Settings.load(utils.PowerShellLanguageId);
    if (extensionSettings.startAutomatically) {
        sessionManager.start();
    }
}

function checkForUpdatedVersion(context: vscode.ExtensionContext) {

    const showReleaseNotes = "Show Release Notes";
    const powerShellExtensionVersionKey = 'powerShellExtensionVersion';

    var extensionVersion: string =
        vscode
            .extensions
            .getExtension("ms-vscode.PowerShell")
            .packageJSON
            .version;

    var storedVersion = context.globalState.get(powerShellExtensionVersionKey);

    if (!storedVersion) {
        // TODO: Prompt to show User Guide for first-time install
    }
    else if (extensionVersion !== storedVersion) {
        vscode
            .window
            .showInformationMessage(
                `The PowerShell extension has been updated to version ${extensionVersion}!`,
                showReleaseNotes)
            .then(choice => {
                if (choice === showReleaseNotes) {
                    vscode.commands.executeCommand(
                        'markdown.showPreview',
                        vscode.Uri.file(path.resolve(__dirname, "../CHANGELOG.md")));
                }
            });
    }

    context.globalState.update(
        powerShellExtensionVersionKey,
        extensionVersion);
}

export function deactivate(): void {
    // Clean up all extension features
    extensionFeatures.forEach(feature => {
       feature.dispose();
    });

    // Dispose of the current session
    sessionManager.dispose();

    // Dispose of the logger
    logger.dispose();
}
