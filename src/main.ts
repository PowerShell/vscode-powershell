/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

'use strict';

import path = require('path');
import vscode = require('vscode');
import settingsManager = require('./settings');
import { LanguageClient, LanguageClientOptions, Executable, RequestType, NotificationType } from 'vscode-languageclient';

import { registerExpandAliasCommand } from './features/ExpandAlias';
import { registerShowHelpCommand } from './features/ShowOnlineHelp';
import { registerOpenInISECommand } from './features/OpenInISE';
import { registerConsoleCommands } from './features/Console';

var languageServerClient: LanguageClient = undefined;

export function activate(context: vscode.ExtensionContext): void {

    var PowerShellLanguageId = 'powershell';
    var settings = settingsManager.load('powershell');

    vscode.languages.setLanguageConfiguration(PowerShellLanguageId,
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

            __electricCharacterSupport: {
                brackets: [
                    { tokenType: 'delimiter.curly.ts', open: '{', close: '}', isElectric: true },
                    { tokenType: 'delimiter.square.ts', open: '[', close: ']', isElectric: true },
                    { tokenType: 'delimiter.paren.ts', open: '(', close: ')', isElectric: true }
                ],
                docComment: { scope: 'comment.documentation', open: '/**', lineStart: ' * ', close: ' */' }
            },

            __characterPairSupport: {
                autoClosingPairs: [
                    { open: '{', close: '}' },
                    { open: '[', close: ']' },
                    { open: '(', close: ')' },
                    { open: '"', close: '"', notIn: ['string'] },
                    { open: '\'', close: '\'', notIn: ['string', 'comment'] }
                ]
            }
        });

    let args = [];
    if (settings.developer.editorServicesWaitForDebugger) {
        args.push('/waitForDebugger');
    }

    let serverPath = resolveLanguageServerPath(settings);
    let serverOptions = {
        run: {
            command: serverPath,
            args: args
        },
        debug: {
            command: serverPath,
            args: ['/waitForDebugger']
        }
    };

    let clientOptions: LanguageClientOptions = {
        documentSelector: [PowerShellLanguageId],
        synchronize: {
            configurationSection: PowerShellLanguageId,
            //fileEvents: vscode.workspace.createFileSystemWatcher('**/.eslintrc')
        }
    }

    languageServerClient =
        new LanguageClient(
            'PowerShell Editor Services',
            serverOptions,
            clientOptions);

    languageServerClient.start();

    // Register other features
    registerExpandAliasCommand(languageServerClient);
    registerShowHelpCommand(languageServerClient);
    registerConsoleCommands(languageServerClient);
    registerOpenInISECommand();
}

export function deactivate(): void {
    if (languageServerClient) {
        // Close the language server client
        languageServerClient.stop();
        languageServerClient = undefined;
    }
}

function resolveLanguageServerPath(settings: settingsManager.ISettings): string {
    var editorServicesHostPath = settings.developer.editorServicesHostPath;

    if (editorServicesHostPath) {
        console.log("Found Editor Services path from config: " + editorServicesHostPath);

        // Make the path absolute if it's not
        editorServicesHostPath =
            path.resolve(
                __dirname,
                editorServicesHostPath);

        console.log("    Resolved path to: " + editorServicesHostPath);
    }
    else {
        // Use the default path in the plugin's 'bin' folder
        editorServicesHostPath =
            path.join(
                __dirname,
                '..',
                'bin',
                'Microsoft.PowerShell.EditorServices.Host.exe');

        console.log("Using default Editor Services path: " + editorServicesHostPath);
    }

    return editorServicesHostPath;
}
