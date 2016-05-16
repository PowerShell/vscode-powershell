/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

'use strict';

import os = require('os');
import fs = require('fs');
import cp = require('child_process');
import path = require('path');
import vscode = require('vscode');
import logging = require('./logging');
import settingsManager = require('./settings');
import { StringDecoder } from 'string_decoder';
import { LanguageClient, LanguageClientOptions, Executable, RequestType, NotificationType, StreamInfo } from 'vscode-languageclient';

import { registerExpandAliasCommand } from './features/ExpandAlias';
import { registerShowHelpCommand } from './features/ShowOnlineHelp';
import { registerOpenInISECommand } from './features/OpenInISE';
import { registerPowerShellFindModuleCommand } from './features/PowerShellFindModule';
import { registerConsoleCommands } from './features/Console';
import { registerExtensionCommands } from './features/ExtensionCommands';

import net = require('net');

// NOTE: We will need to find a better way to deal with the required
//       PS Editor Services version...
var requiredEditorServicesVersion = "0.7.0";

var powerShellProcess: cp.ChildProcess = undefined;
var languageServerClient: LanguageClient = undefined;
var PowerShellLanguageId = 'powershell';

export function activate(context: vscode.ExtensionContext): void {

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

        var bundledModulesPath = settings.developer.bundledModulesPath;
        if (!path.isAbsolute(bundledModulesPath)) {
            bundledModulesPath = path.resolve(__dirname, bundledModulesPath);
        }

        var startArgs =
            '-EditorServicesVersion "' + requiredEditorServicesVersion + '"' +
            '-HostName "Visual Studio Code Host" ' +
            '-HostProfileId "Microsoft.VSCode" ' +
            '-HostVersion "' + hostVersion + '" ' +
            '-BundledModulesPath "' + bundledModulesPath + '" ' +
            '-WaitForCompletion ';

        if (settings.developer.editorServicesWaitForDebugger) {
            startArgs += '-WaitForDebugger ';
        }
        if (settings.developer.editorServicesLogLevel) {
            startArgs += '-LogLevel "' + settings.developer.editorServicesLogLevel + '" '
        }

        // Find the path to powershell.exe based on the current platform
        // and the user's desire to run the x86 version of PowerShell
        var powerShellExePath =
            settings.useX86Host || !process.env.hasOwnProperty('PROCESSOR_ARCHITEW6432')
            ? process.env.windir + '\\System32\\WindowsPowerShell\\v1.0\\powershell.exe'
            : process.env.windir + '\\Sysnative\\WindowsPowerShell\\v1.0\\powershell.exe';

        // Is there a setting override for the PowerShell path?
        if (settings.developer.powerShellExePath) {
            powerShellExePath = settings.developer.powerShellExePath;

            // If the path does not exist, show an error
            fs.access(
                powerShellExePath, fs.X_OK,
                (err) => {
                    if (err) {
                        vscode.window.showErrorMessage(
                            "powershell.exe cannot be found or is not accessible at path " + powerShellExePath);
                    }
                    else {
                        startPowerShell(
                            powerShellExePath,
                            bundledModulesPath,
                            startArgs);
                    }
                });
        }
        else {
            startPowerShell(
                powerShellExePath,
                bundledModulesPath,
                startArgs);
        }
    }
}

function startPowerShell(powerShellExePath: string, bundledModulesPath: string, startArgs: string) {
    try
    {
        let languageServicePipeName = "PSES-VSCode-LanguageService-" + process.env.VSCODE_PID;
        let debugServicePipeName = "PSES-VSCode-DebugService-" + process.env.VSCODE_PID;

        let startScriptPath =
            path.resolve(
                __dirname,
                '../scripts/Start-EditorServices.ps1');

        var logBasePath = path.resolve(__dirname, "../logs");
        logging.ensurePathExists(logBasePath);

        var editorServicesLogName = logging.getLogName("EditorServices");
        var powerShellLogName = logging.getLogName("PowerShell");

        startArgs +=
            '-LogPath "' + path.resolve(logBasePath, editorServicesLogName) + '" ' +
            '-LanguageServicePipeName "' + languageServicePipeName + '" ' +
            '-DebugServicePipeName "' + debugServicePipeName + '" ';

        let args = [
            '-NoProfile',
            '-NonInteractive',
            '-ExecutionPolicy', 'Unrestricted',
            '-Command', startScriptPath + ' ' + startArgs
        ]

        // Launch PowerShell as child process
        powerShellProcess = cp.spawn(powerShellExePath, args);

        // Open a log file to be used for PowerShell.exe output
        var powerShellLogWriter =
            fs.createWriteStream(
                path.resolve(logBasePath, powerShellLogName))

        var decoder = new StringDecoder('utf8');
        powerShellProcess.stdout.on(
            'data',
            (data: Buffer) => {
                powerShellLogWriter.write("OUTPUT: " + data);
                if (decoder.write(data).trim() == "PowerShell Editor Services host has started.") {
                    startLanguageClient(languageServicePipeName);
                }
            });

        powerShellProcess.stderr.on(
            'data',
            (data) => {
                console.log("powershell.exe - ERROR: " + data);
                powerShellLogWriter.write("ERROR: " + data);
            });

        powerShellProcess.on(
            'close',
            (exitCode) => {
                languageServerClient.stop();
                console.log("powershell.exe terminated with exit code: " + exitCode);
                powerShellLogWriter.write("\r\npowershell.exe terminated with exit code: " + exitCode + "\r\n");
            });

        console.log("powershell.exe started, pid: " + powerShellProcess.pid + ", exe: " + powerShellExePath);
        powerShellLogWriter.write(
            "powershell.exe started --" +
            "\r\n    pid: " + powerShellProcess.pid +
            "\r\n    exe: " + powerShellExePath +
            "\r\n    bundledModulesPath: " + bundledModulesPath + "\r\n\r\n");

        // TODO: Set timeout for response from powershell.exe
    }
    catch (e)
    {
        vscode.window.showErrorMessage(
            "The language service could not be started: " + e);
    }
}

function startLanguageClient(pipeName: string) {
    try
    {
        let connectFunc = () => {
            return new Promise<StreamInfo>(
                (resolve, reject) => {
                    var socket = net.connect("\\\\.\\pipe\\" + pipeName);
                    socket.on(
                        'connect',
                        function() {
                            console.log("Pipe connected!");
                            resolve({writer: socket, reader: socket})
                        });
                });
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
                connectFunc,
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

    // Kill the child process after some time just in case
    setTimeout(() => {}, 3000);
}

