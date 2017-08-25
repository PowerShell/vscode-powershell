/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import os = require('os');
import fs = require('fs');
import net = require('net');
import path = require('path');
import utils = require('./utils');
import vscode = require('vscode');
import cp = require('child_process');
import Settings = require('./settings');

import { Logger } from './logging';

export class PowerShellProcess {

    private consoleTerminal: vscode.Terminal = undefined;
    private consoleCloseSubscription: vscode.Disposable;
    private sessionDetails: utils.EditorServicesSessionDetails;

    private onExitedEmitter = new vscode.EventEmitter<void>();
    public onExited: vscode.Event<void> = this.onExitedEmitter.event;

    constructor(
        public exePath: string,
        private title: string,
        private log: Logger,
        private startArgs: string,
        private sessionFilePath: string,
        private sessionSettings: Settings.ISettings) {
    }

    public start(logFileName: string): Thenable<utils.EditorServicesSessionDetails> {

        return new Promise<utils.EditorServicesSessionDetails>(
            (resolve, reject) => {
                try
                {
                    let startScriptPath =
                        path.resolve(
                            __dirname,
                            '../../scripts/Start-EditorServices.ps1');

                    var editorServicesLogPath = this.log.getLogFilePath(logFileName);

                    var featureFlags =
                        this.sessionSettings.developer.featureFlags !== undefined
                            ? this.sessionSettings.developer.featureFlags.map(f => `'${f}'`).join(', ')
                            : "";

                    this.startArgs +=
                        `-LogPath '${editorServicesLogPath}' ` +
                        `-SessionDetailsPath '${this.sessionFilePath}' ` +
                        `-FeatureFlags @(${featureFlags})`

                    var powerShellArgs = [
                        "-NoProfile",
                        "-NonInteractive"
                    ]

                    // Only add ExecutionPolicy param on Windows
                    if (utils.isWindowsOS()) {
                        powerShellArgs.push("-ExecutionPolicy", "Bypass")
                    }

                    powerShellArgs.push(
                        "-Command",
                        "& '" + startScriptPath + "' " + this.startArgs);

                    var powerShellExePath = this.exePath;

                    if (this.sessionSettings.developer.powerShellExeIsWindowsDevBuild) {
                        // Windows PowerShell development builds need the DEVPATH environment
                        // variable set to the folder where development binaries are held

                        // NOTE: This batch file approach is needed temporarily until VS Code's
                        // createTerminal API gets an argument for setting environment variables
                        // on the launched process.
                        var batScriptPath = path.resolve(__dirname, '../../sessions/powershell.bat');
                        fs.writeFileSync(
                            batScriptPath,
                            `@set DEVPATH=${path.dirname(powerShellExePath)}\r\n@${powerShellExePath} %*`);

                        powerShellExePath = batScriptPath;
                    }

                    this.log.write(`${utils.getTimestampString()} Language server starting...`);

                    // Make sure no old session file exists
                    utils.deleteSessionFile(this.sessionFilePath);

                    // Launch PowerShell in the integrated terminal
                    this.consoleTerminal =
                        vscode.window.createTerminal(
                            this.title,
                            powerShellExePath,
                            powerShellArgs);

                    if (this.sessionSettings.integratedConsole.showOnStartup) {
                        this.consoleTerminal.show(true);
                    }

                    // Start the language client
                    utils.waitForSessionFile(
                        this.sessionFilePath,
                        (sessionDetails, error) => {
                            // Clean up the session file
                            utils.deleteSessionFile(this.sessionFilePath);

                            if (error) {
                                reject(error);
                            }
                            else {
                                this.sessionDetails = sessionDetails;
                                resolve(this.sessionDetails);
                            }
                    });

                // this.powerShellProcess.stderr.on(
                //     'data',
                //     (data) => {
                //         this.log.writeError("ERROR: " + data);

                //         if (this.sessionStatus === SessionStatus.Initializing) {
                //             this.setSessionFailure("PowerShell could not be started, click 'Show Logs' for more details.");
                //         }
                //         else if (this.sessionStatus === SessionStatus.Running) {
                //             this.promptForRestart();
                //         }
                //     });

                this.consoleCloseSubscription =
                    vscode.window.onDidCloseTerminal(
                        terminal => {
                            if (terminal === this.consoleTerminal) {
                                this.log.write(os.EOL + "powershell.exe terminated or terminal UI was closed" + os.EOL);
                                this.onExitedEmitter.fire();
                            }
                        });

                this.consoleTerminal.processId.then(
                    pid => {
                        console.log("powershell.exe started, pid: " + pid + ", exe: " + powerShellExePath);
                        this.log.write(
                            "powershell.exe started --",
                            "    pid: " + pid,
                            "    exe: " + powerShellExePath,
                            "    args: " + startScriptPath + ' ' + this.startArgs + os.EOL + os.EOL);
                    });
            }
            catch (e)
            {
                reject(e);
            }
        });
    }

    public showConsole(preserveFocus: boolean) {
        if (this.consoleTerminal) {
            this.consoleTerminal.show(preserveFocus);
        }
    }

    public dispose() {

        // Clean up the session file
        utils.deleteSessionFile(this.sessionFilePath);

        if (this.consoleCloseSubscription) {
            this.consoleCloseSubscription.dispose();
            this.consoleCloseSubscription = undefined;
        }

        if (this.consoleTerminal) {
            this.log.write(os.EOL + "Terminating PowerShell process...");
            this.consoleTerminal.dispose();
            this.consoleTerminal = undefined;
        }
    }
}
