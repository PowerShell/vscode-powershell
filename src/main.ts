/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

'use strict';

import os = require('os');
import path = require('path');
import vscode = require('vscode');
import settingsManager = require('./settings');
import { LanguageClient, LanguageClientOptions, Executable, RequestType, NotificationType } from 'vscode-languageclient';

import { registerExpandAliasCommand } from './features/ExpandAlias';
import { registerShowHelpCommand } from './features/ShowOnlineHelp';
import { registerOpenInISECommand } from './features/OpenInISE';
import { registerPowerShellFindModuleCommand } from './features/PowerShellFindModule';
import { registerConsoleCommands } from './features/Console';
import { registerExtensionCommands } from './features/ExtensionCommands';

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

    // The language server is only available on Windows
    if (os.platform() == "win32")
    {
        // Get the current version of this extension
        var hostVersion =
            vscode
                .extensions
                .getExtension("ms-vscode.PowerShell")
                .packageJSON
                .version;

        let args = [
            "/hostName:\"Visual Studio Code Host\"",
            "/hostProfileId:\"Microsoft.VSCode\"",
            "/hostVersion:" + hostVersion
        ];

        if (settings.developer.editorServicesWaitForDebugger) {
            args.push('/waitForDebugger');
        }
        if (settings.developer.editorServicesLogLevel) {
            args.push('/logLevel:' + settings.developer.editorServicesLogLevel)
        }

        try
        {
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

            languageServerClient.onReady().then(
                () => registerFeatures(),
                (reason) => vscode.window.showErrorMessage("Could not start language service: " + reason));

            languageServerClient.start();
        }
        catch (e)
        {
            vscode.window.showErrorMessage(
                "The language service could not be started: " + e);
        }
    }
}

function registerFeatures() {
    // Register other features
    registerExpandAliasCommand(languageServerClient);
    registerShowHelpCommand(languageServerClient);
    registerConsoleCommands(languageServerClient);
    registerOpenInISECommand();
    registerPowerShellFindModuleCommand(languageServerClient);
    registerExtensionCommands(languageServerClient);
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

        // Does the path end in a .exe?  Alert the user if so.
        if (path.extname(editorServicesHostPath) != '') {
            throw "The editorServicesHostPath setting must point to a directory, not a file.";
        }

        // Make the path absolute if it's not
        editorServicesHostPath =
            path.resolve(
                __dirname,
                editorServicesHostPath,
                getHostExeName(settings.useX86Host));

        console.log("    Resolved path to: " + editorServicesHostPath);
    }
    else {
        // Use the default path in the extension's 'bin' folder
        editorServicesHostPath =
            path.join(
                __dirname,
                '..',
                'bin',
                getHostExeName(settings.useX86Host));

        console.log("Using default Editor Services path: " + editorServicesHostPath);
    }

    return editorServicesHostPath;
}

function getHostExeName(useX86Host: boolean): string {
    // The useX86Host setting is only relevant on 64-bit OS
    var is64BitOS = process.env.hasOwnProperty('PROCESSOR_ARCHITEW6432');
    var archText = useX86Host && is64BitOS ? ".x86" : "";
    return "Microsoft.PowerShell.EditorServices.Host" + archText + ".exe";
}
