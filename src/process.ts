// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import fs = require("fs");
import cp = require("child_process");
import * as semver from "semver";
import path = require("path");
import vscode = require("vscode");
import { Logger } from "./logging";
import Settings = require("./settings");
import utils = require("./utils");
import { IEditorServicesSessionDetails, SessionManager } from "./session";

export class PowerShellProcess {
    public static escapeSingleQuotes(psPath: string): string {
        return psPath.replace(new RegExp("'", "g"), "''");
    }

    // This is used to warn the user that the extension is taking longer than expected to startup.
    // After the 15th try we've hit 30 seconds and should warn.
    private static warnUserThreshold = 15;

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
        private sessionFilePath: vscode.Uri,
        private sessionSettings: Settings.ISettings) {

        this.onExited = this.onExitedEmitter.event;
    }

    public async start(logFileName: string): Promise<IEditorServicesSessionDetails> {
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
            `-LogPath '${PowerShellProcess.escapeSingleQuotes(editorServicesLogPath.fsPath)}' ` +
        `-SessionDetailsPath '${PowerShellProcess.escapeSingleQuotes(this.sessionFilePath.fsPath)}' ` +
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
        await PowerShellProcess.deleteSessionFile(this.sessionFilePath);

        // Launch PowerShell in the integrated terminal
        const terminalOptions: vscode.TerminalOptions = {
            name: this.title,
            shellPath: this.exePath,
            shellArgs: powerShellArgs,
            cwd: this.sessionSettings.cwd,
            iconPath: new vscode.ThemeIcon("terminal-powershell"),
        };

        if (semver.gte(vscode.version, "1.65.0")) {
            // @ts-ignore TODO: Don't ignore after we update our engine.
            terminalOptions.isTransient = true;
        }

        this.consoleTerminal = vscode.window.createTerminal(terminalOptions);

        const pwshName = path.basename(this.exePath);
        this.log.write(`${pwshName} started.`);

        if (this.sessionSettings.integratedConsole.showOnStartup) {
            // We still need to run this to set the active terminal to the extension terminal.
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
        PowerShellProcess.deleteSessionFile(this.sessionFilePath);

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

    public sendKeyPress() {
        // NOTE: This is a regular character instead of something like \0
        // because non-printing characters can cause havoc with different
        // languages and terminal settings. We discard the character server-side
        // anyway, so it doesn't matter what we send.
        this.consoleTerminal.sendText("p", false);
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

    private static readSessionFile(sessionFilePath: vscode.Uri): IEditorServicesSessionDetails {
        // TODO: Use vscode.workspace.fs.readFile instead of fs.readFileSync.
        const fileContents = fs.readFileSync(sessionFilePath.fsPath, "utf-8");
        return JSON.parse(fileContents);
    }

    private static async deleteSessionFile(sessionFilePath: vscode.Uri) {
        try {
            await vscode.workspace.fs.delete(sessionFilePath);
        } catch (e) {
            // TODO: Be more specific about what we're catching
        }
    }

    private async waitForSessionFile(): Promise<IEditorServicesSessionDetails> {
        // Determine how many tries by dividing by 2000 thus checking every 2 seconds.
        const numOfTries = this.sessionSettings.developer.waitForSessionFileTimeoutSeconds / 2;
        const warnAt = numOfTries - PowerShellProcess.warnUserThreshold;

        // Check every 2 seconds
        for (let i = numOfTries; i > 0; i--) {
            if (utils.checkIfFileExists(this.sessionFilePath.fsPath)) {
                this.log.write("Session file found");
                const sessionDetails = PowerShellProcess.readSessionFile(this.sessionFilePath);
                PowerShellProcess.deleteSessionFile(this.sessionFilePath);
                return sessionDetails;
            }

            if (warnAt === i) {
                vscode.window.showWarningMessage(`Loading the PowerShell extension is taking longer than expected.
    If you're using privilege enforcement software, this can affect start up performance.`);
            }

            // Wait a bit and try again
            await utils.sleep(2000);
        }

        const err = "Timed out waiting for session file to appear.";
        this.log.write(err);
        throw new Error(err);
    }

    private onTerminalClose(terminal: vscode.Terminal) {
        if (terminal !== this.consoleTerminal) {
            return;
        }

        this.log.write("powershell.exe terminated or terminal UI was closed");
        this.onExitedEmitter.fire();
    }
}
