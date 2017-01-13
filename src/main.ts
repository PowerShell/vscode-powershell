/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

'use strict';

import vscode = require('vscode');
import utils = require('./utils');
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
import { DebugSessionFeature } from './features/DebugSession';
import { SelectPSSARulesFeature } from './features/SelectPSSARules';
import { FindModuleFeature } from './features/PowerShellFindModule';
import { NewFileOrProjectFeature } from './features/NewFileOrProject';
import { ExtensionCommandsFeature } from './features/ExtensionCommands';

// NOTE: We will need to find a better way to deal with the required
//       PS Editor Services version...
var requiredEditorServicesVersion = "0.8.0";

var logger: Logger = undefined;
var sessionManager: SessionManager = undefined;
var extensionFeatures: IFeature[] = [];

// Clean up the session file just in case one lingers from a previous session
utils.deleteSessionFile();

export function activate(context: vscode.ExtensionContext): void {

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
        new DebugSessionFeature()
    ];

    sessionManager =
        new SessionManager(
            requiredEditorServicesVersion,
            logger,
            extensionFeatures);

    sessionManager.start();
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
