// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import cp = require("child_process");
import path = require("path");
import vscode = require("vscode");
import { ILogger } from "./logging";
import Settings = require("./settings");
import utils = require("./utils");
import { IEditorServicesSessionDetails } from "./session";
import { promisify } from "util";

export class PowerShellProcess {
    // This is used to warn the user that the extension is taking longer than expected to startup.
    // After the 15th try we've hit 30 seconds and should warn.
    private static warnUserThreshold = 15;

    public onExited: vscode.Event<void>;
    private onExitedEmitter = new vscode.EventEmitter<void>();

    private consoleTerminal?: vscode.Terminal;
    private consoleCloseSubscription?: vscode.Disposable;

    constructor(
        public exePath: string,
        private bundledModulesPath: string,
        private title: string,
        private logger: ILogger,
        private startPsesArgs: string,
        private sessionFilePath: vscode.Uri,
        private sessionSettings: Settings.Settings) {

        this.onExited = this.onExitedEmitter.event;
    }

    public async start(logFileName: string): Promise<IEditorServicesSessionDetails> {
        const editorServicesLogPath = this.logger.getLogFilePath(logFileName);

        const psesModulePath =
            path.resolve(
                __dirname,
                this.bundledModulesPath,
                "PowerShellEditorServices/PowerShellEditorServices.psd1");

        const featureFlags =
            this.sessionSettings.developer.featureFlags.length > 0
                ? this.sessionSettings.developer.featureFlags.map((f) => `'${f}'`).join(", ")
                : "";

        this.startPsesArgs +=
            `-LogPath '${utils.escapeSingleQuotes(editorServicesLogPath.fsPath)}' ` +
            `-SessionDetailsPath '${utils.escapeSingleQuotes(this.sessionFilePath.fsPath)}' ` +
            `-FeatureFlags @(${featureFlags}) `;

        if (this.sessionSettings.integratedConsole.useLegacyReadLine) {
            this.startPsesArgs += "-UseLegacyReadLine";
        }

        const powerShellArgs: string[] = [];

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
            utils.escapeSingleQuotes(psesModulePath) +
            "'; Start-EditorServices " + this.startPsesArgs;

        // On Windows we unfortunately can't Base64 encode the startup command
        // because it annoys some poorly implemented anti-virus scanners.
        if (utils.isWindows) {
            powerShellArgs.push(
                "-Command",
                startEditorServices);
        } else {
            // Otherwise use -EncodedCommand for better quote support.
            this.logger.writeVerbose("Using Base64 -EncodedCommand but logging as -Command equivalent.");
            powerShellArgs.push(
                "-EncodedCommand",
                Buffer.from(startEditorServices, "utf16le").toString("base64"));
        }

        this.logger.writeVerbose(`Starting process: ${this.exePath} ${powerShellArgs.slice(0, -2).join(" ")} -Command ${startEditorServices}`);

        // Make sure no old session file exists
        await PowerShellProcess.deleteSessionFile(this.sessionFilePath);

        // Launch PowerShell in the integrated terminal
        const terminalOptions: vscode.TerminalOptions = {
            name: this.title,
            shellPath: this.exePath,
            shellArgs: powerShellArgs,
            cwd: this.sessionSettings.cwd,
            iconPath: new vscode.ThemeIcon("terminal-powershell"),
            isTransient: true,
            hideFromUser: this.sessionSettings.integratedConsole.startInBackground,
        };

        // Subscribe a log event for when the terminal closes (this fires for
        // all terminals and the event itself checks if it's our terminal). This
        // subscription should happen before we create the terminal so if it
        // fails immediately, the event fires.
        this.consoleCloseSubscription = vscode.window.onDidCloseTerminal((terminal) => this.onTerminalClose(terminal));

        this.consoleTerminal = vscode.window.createTerminal(terminalOptions);

        const pwshName = path.basename(this.exePath);
        this.logger.write(`${pwshName} started.`);

        // Log that the PowerShell terminal process has been started
        const pid = await this.getPid();
        this.logTerminalPid(pid ?? 0, pwshName);

        if (this.sessionSettings.integratedConsole.showOnStartup
            && !this.sessionSettings.integratedConsole.startInBackground) {
            // We still need to run this to set the active terminal to the extension terminal.
            this.consoleTerminal.show(true);
        }

        return await this.waitForSessionFile();
    }

    // This function should only be used after a failure has occurred because it is slow!
    public async getVersionCli(): Promise<string> {
        const exec = promisify(cp.execFile);
        const { stdout } = await exec(this.exePath, ["-NoProfile", "-NoLogo", "-Command", "$PSVersionTable.PSVersion.ToString()"]);
        return stdout.trim();
    }

    // Returns the process Id of the consoleTerminal
    public async getPid(): Promise<number | undefined> {
        if (!this.consoleTerminal) { return undefined; }
        return await this.consoleTerminal.processId;
    }

    public showTerminal(preserveFocus?: boolean): void {
        this.consoleTerminal?.show(preserveFocus);
    }

    public async dispose(): Promise<void> {
        // Clean up the session file
        this.logger.write("Disposing PowerShell Extension Terminal...");

        this.consoleTerminal?.dispose();
        this.consoleTerminal = undefined;

        this.consoleCloseSubscription?.dispose();
        this.consoleCloseSubscription = undefined;

        await PowerShellProcess.deleteSessionFile(this.sessionFilePath);
    }

    public sendKeyPress(): void {
        // NOTE: This is a regular character instead of something like \0
        // because non-printing characters can cause havoc with different
        // languages and terminal settings. We discard the character server-side
        // anyway, so it doesn't matter what we send.
        this.consoleTerminal?.sendText("p", false);
    }

    private logTerminalPid(pid: number, exeName: string): void {
        this.logger.write(`${exeName} PID: ${pid}`);
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

    private static async readSessionFile(sessionFilePath: vscode.Uri): Promise<IEditorServicesSessionDetails> {
        const fileContents = await vscode.workspace.fs.readFile(sessionFilePath);
        return JSON.parse(fileContents.toString());
    }

    private static async deleteSessionFile(sessionFilePath: vscode.Uri): Promise<void> {
        try {
            await vscode.workspace.fs.delete(sessionFilePath);
        } catch {
            // We don't care about any reasons for it to fail.
        }
    }

    private async waitForSessionFile(): Promise<IEditorServicesSessionDetails> {
        // Determine how many tries by dividing by 2000 thus checking every 2 seconds.
        const numOfTries = this.sessionSettings.developer.waitForSessionFileTimeoutSeconds / 2;
        const warnAt = numOfTries - PowerShellProcess.warnUserThreshold;

        // Check every 2 seconds
        this.logger.write("Waiting for session file...");
        for (let i = numOfTries; i > 0; i--) {
            if (this.consoleTerminal === undefined) {
                const err = "PowerShell Extension Terminal didn't start!";
                this.logger.write(err);
                throw new Error(err);
            }

            if (await utils.checkIfFileExists(this.sessionFilePath)) {
                this.logger.write("Session file found!");
                const sessionDetails = await PowerShellProcess.readSessionFile(this.sessionFilePath);
                await PowerShellProcess.deleteSessionFile(this.sessionFilePath);
                return sessionDetails;
            }

            if (warnAt === i) {
                void this.logger.writeAndShowWarning("Loading the PowerShell extension is taking longer than expected. If you're using privilege enforcement software, this can affect start up performance.");
            }

            // Wait a bit and try again
            await utils.sleep(2000);
        }

        const err = "Timed out waiting for session file to appear!";
        this.logger.write(err);
        throw new Error(err);
    }

    private onTerminalClose(terminal: vscode.Terminal): void {
        if (terminal !== this.consoleTerminal) {
            return;
        }

        this.logger.write("PowerShell process terminated or Extension Terminal was closed!");
        this.onExitedEmitter.fire();
        void this.dispose();
    }
}
