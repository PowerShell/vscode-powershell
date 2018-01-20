/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import cp = require("child_process");
import fs = require("fs");
import net = require("net");
import os = require("os");
import path = require("path");
import vscode = require("vscode");
import { Logger } from "./logging";
import Settings = require("./settings");
import utils = require("./utils");

export class PowerShellProcess {

    public onExited: vscode.Event<void>;
    private onExitedEmitter = new vscode.EventEmitter<void>();

    private consoleTerminal: vscode.Terminal = undefined;
    private consoleCloseSubscription: vscode.Disposable;
    private sessionDetails: utils.IEditorServicesSessionDetails;

    constructor(
        public exePath: string,
        private title: string,
        private log: Logger,
        private startArgs: string,
        private sessionFilePath: string,
        private sessionSettings: Settings.ISettings) {

        this.onExited = this.onExitedEmitter.event;
    }

    public start(logFileName: string): Thenable<utils.IEditorServicesSessionDetails> {

        return new Promise<utils.IEditorServicesSessionDetails>(
            (resolve, reject) => {
                try {
                    const startScriptPath =
                        path.resolve(
                            __dirname,
                            "../../scripts/Start-EditorServices.ps1");

                    const editorServicesLogPath = this.log.getLogFilePath(logFileName);

                    const featureFlags =
                        this.sessionSettings.developer.featureFlags !== undefined
                            ? this.sessionSettings.developer.featureFlags.map((f) => `'${f}'`).join(", ")
                            : "";

                    this.startArgs +=
                        `-LogPath '${editorServicesLogPath}' ` +
                        `-SessionDetailsPath '${this.sessionFilePath}' ` +
                        `-FeatureFlags @(${featureFlags})`;

                    const powerShellArgs = [
                        "-NoProfile",
                        "-NonInteractive",
                    ];

                    // Only add ExecutionPolicy param on Windows
                    if (utils.isWindowsOS()) {
                        powerShellArgs.push("-ExecutionPolicy", "Bypass");
                    }

                    powerShellArgs.push(
                        "-Command",
                        "& '" + startScriptPath + "' " + this.startArgs);

                    let powerShellExePath = this.exePath;

                    if (this.sessionSettings.developer.powerShellExeIsWindowsDevBuild) {
                        // Windows PowerShell development builds need the DEVPATH environment
                        // variable set to the folder where development binaries are held

                        // NOTE: This batch file approach is needed temporarily until VS Code's
                        // createTerminal API gets an argument for setting environment variables
                        // on the launched process.
                        const batScriptPath = path.resolve(__dirname, "../../sessions/powershell.bat");
                        fs.writeFileSync(
                            batScriptPath,
                            `@set DEVPATH=${path.dirname(powerShellExePath)}\r\n@${powerShellExePath} %*`);

                        powerShellExePath = batScriptPath;
                    }

                    this.log.write(
                        "Language server starting --",
                        "    exe: " + powerShellExePath,
                        "    args: " + startScriptPath + " " + this.startArgs);

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
                            } else {
                                this.sessionDetails = sessionDetails;
                                resolve(this.sessionDetails);
                            }
                    });

                    this.consoleCloseSubscription =
                        vscode.window.onDidCloseTerminal(
                            (terminal) => {
                                if (terminal === this.consoleTerminal) {
                                    this.log.write("powershell.exe terminated or terminal UI was closed");
                                    this.onExitedEmitter.fire();
                                }
                            });

                    this.consoleTerminal.processId.then(
                        (pid) => { this.log.write(`powershell.exe started, pid: ${pid}`); });
                } catch (e) {
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
            this.log.write("Terminating PowerShell process...");
            this.consoleTerminal.dispose();
            this.consoleTerminal = undefined;
        }
    }
}
