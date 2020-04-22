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
    public static escapeSingleQuotes(pspath: string): string {
        return pspath.replace(new RegExp("'", "g"), "''");
    }

    public onExited: vscode.Event<void>;
    private onExitedEmitter = new vscode.EventEmitter<void>();

    private consoleTerminal: vscode.Terminal = undefined;
    private consoleCloseSubscription: vscode.Disposable;

    constructor(
        public exePath: string,
        private bundledModulesPath: string,
        private title: string,
        private log: Logger,
        private startPsesArgs: string,
        private sessionFilePath: string,
        private sessionSettings: Settings.ISettings) {

        this.onExited = this.onExitedEmitter.event;
    }

    public async start(logFileName: string): Promise<utils.IEditorServicesSessionDetails> {
        const editorServicesLogPath = this.log.getLogFilePath(logFileName);

        const psesModulePath =
            path.resolve(
                __dirname,
                this.bundledModulesPath,
                "PowerShellEditorServices/PowerShellEditorServices.psd1");

        const featureFlags =
            this.sessionSettings.developer.featureFlags !== undefined
                ? this.sessionSettings.developer.featureFlags.map((f) => `'${f}'`).join(", ")
                : "";

        this.startPsesArgs +=
            `-LogPath '${PowerShellProcess.escapeSingleQuotes(editorServicesLogPath)}' ` +
            `-SessionDetailsPath '${PowerShellProcess.escapeSingleQuotes(this.sessionFilePath)}' ` +
            `-FeatureFlags @(${featureFlags}) `;

        if (this.sessionSettings.integratedConsole.useLegacyReadLine) {
            this.startPsesArgs += "-UseLegacyReadLine";
        }

        const powerShellArgs = [];

        const useLoginShell: boolean =
            (utils.isMacOS && this.sessionSettings.startAsLoginShell.osx)
            || (utils.isLinux && this.sessionSettings.startAsLoginShell.linux);

        if (useLoginShell && this.isLoginShell(this.exePath)) {
            // This MUST be the first argument.
            powerShellArgs.push("-Login");
        }

        powerShellArgs.push("-NoProfile");
        powerShellArgs.push("-NonInteractive");

        // Only add ExecutionPolicy param on Windows
        if (utils.isWindows) {
            powerShellArgs.push("-ExecutionPolicy", "Bypass");
        }

        const startEditorServices = "Import-Module '" +
            PowerShellProcess.escapeSingleQuotes(psesModulePath) +
            "'; Start-EditorServices " + this.startPsesArgs;

        if (utils.isWindows) {
            powerShellArgs.push(
                "-Command",
                startEditorServices);
        } else {
            // Use -EncodedCommand for better quote support on non-Windows
            powerShellArgs.push(
                "-EncodedCommand",
                Buffer.from(startEditorServices, "utf16le").toString("base64"));
        }

        this.log.write(
            "Language server starting --",
            "    PowerShell executable: " + this.exePath,
            "    PowerShell args: " + powerShellArgs.join(" "),
            "    PowerShell Editor Services args: " + startEditorServices);

        // Make sure no old session file exists
        utils.deleteSessionFile(this.sessionFilePath);

        // Launch PowerShell in the integrated terminal
        this.consoleTerminal =
            vscode.window.createTerminal({
                name: this.title,
                shellPath: this.exePath,
                shellArgs: powerShellArgs,
                hideFromUser: !this.sessionSettings.integratedConsole.showOnStartup,
            });

        const pwshName = path.basename(this.exePath);
        this.log.write(`${pwshName} started.`);

        if (this.sessionSettings.integratedConsole.showOnStartup) {
            // We still need to run this to set the active terminal to the Integrated Console.
            this.consoleTerminal.show(true);
        }

        // Start the language client
        this.log.write("Waiting for session file");
        const sessionDetails = await this.waitForSessionFile();

        // Subscribe a log event for when the terminal closes
        this.log.write("Registering terminal close callback");
        this.consoleCloseSubscription = vscode.window.onDidCloseTerminal((terminal) => this.onTerminalClose(terminal));

        // Log that the PowerShell terminal process has been started
        this.log.write("Registering terminal PID log callback");
        this.consoleTerminal.processId.then((pid) => this.logTerminalPid(pid, pwshName));

        return sessionDetails;
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

    private logTerminalPid(pid: number, exeName: string) {
        this.log.write(`${exeName} PID: ${pid}`);
    }

    private isLoginShell(pwshPath: string): boolean {
        try {
            // We can't know what version of PowerShell we have without running it
            // So we try to start PowerShell with -Login
            // If it exits successfully, we return true
            // If it exits unsuccessfully, node throws, we catch, and return false
            cp.execFileSync(pwshPath, ["-Login", "-NoProfile", "-NoLogo", "-Command", "exit 0"]);
        } catch {
            return false;
        }

        return true;
    }

    private async waitForSessionFile(): Promise<utils.IEditorServicesSessionDetails> {
        try {
            const sessionDetails: utils.IEditorServicesSessionDetails = await utils.waitForSessionFile(
                this.sessionFilePath, this.sessionSettings.developer.waitForSessionFileNumOfTries);
            this.log.write("Session file found");
            return sessionDetails;
        } catch (e) {
            this.log.write(`Error occurred retrieving session file:\n${e}`);
            throw e;
        } finally {
            utils.deleteSessionFile(this.sessionFilePath);
        }
    }

    private onTerminalClose(terminal: vscode.Terminal) {
        if (terminal !== this.consoleTerminal) {
            return;
        }

        this.log.write("powershell.exe terminated or terminal UI was closed");
        this.onExitedEmitter.fire();
    }
}
