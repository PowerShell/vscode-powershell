// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import cp = require("child_process");
import path = require("path");
import vscode = require("vscode");
import { ILogger } from "./logging";
import { Settings, validateCwdSetting } from "./settings";
import utils = require("./utils");
import { IEditorServicesSessionDetails } from "./session";
import { promisify } from "util";

export class PowerShellProcess {
    // This is used to warn the user that the extension is taking longer than expected to startup.
    private static warnUserThreshold = 30;

    private static title = "PowerShell Extension";

    public onExited: vscode.Event<void>;
    private onExitedEmitter?: vscode.EventEmitter<void>;

    private consoleTerminal?: vscode.Terminal;
    private consoleCloseSubscription?: vscode.Disposable;

    private pid?: number;
    private pidUpdateEmitter?: vscode.EventEmitter<number | undefined>;

    constructor(
        public exePath: string,
        private bundledModulesPath: string,
        private isTemp: boolean,
        private shellIntegrationEnabled: boolean,
        private logger: ILogger,
        private logDirectoryPath: vscode.Uri,
        private startPsesArgs: string,
        private sessionFilePath: vscode.Uri,
        private sessionSettings: Settings,
        private devMode = false
    ) {

        this.onExitedEmitter = new vscode.EventEmitter<void>();
        this.onExited = this.onExitedEmitter.event;
        this.pidUpdateEmitter = new vscode.EventEmitter<number | undefined>();
    }

    public async start(cancellationToken: vscode.CancellationToken): Promise<IEditorServicesSessionDetails | undefined> {
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
            `-LogPath '${utils.escapeSingleQuotes(this.logDirectoryPath.fsPath)}' ` +
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
        if (utils.isWindows && this.sessionSettings.developer.setExecutionPolicy) {
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
            this.logger.writeDebug("Using Base64 -EncodedCommand but logging as -Command equivalent.");
            powerShellArgs.push(
                "-EncodedCommand",
                Buffer.from(startEditorServices, "utf16le").toString("base64"));
        }

        this.logger.writeDebug(`Starting process: ${this.exePath} ${powerShellArgs.slice(0, -2).join(" ")} -Command ${startEditorServices}`);

        // Make sure no old session file exists
        await this.deleteSessionFile(this.sessionFilePath);

        // When VS Code shell integration is enabled, the script expects certain
        // variables to be added to the environment.
        let envMixin = {};
        if (this.shellIntegrationEnabled) {
            envMixin = {
                "VSCODE_INJECTION": "1",
                // There is no great way to check if we are running stable VS
                // Code. Since this is used to disable experimental features, we
                // default to stable unless we're definitely running Insiders.
                "VSCODE_STABLE": vscode.env.appName.includes("Insiders") ? "0" : "1",
                // Maybe one day we can set VSCODE_NONCE...
            };
        }

        // Enables Hot Reload in .NET for the attached process
        // https://devblogs.microsoft.com/devops/net-enc-support-for-lambdas-and-other-improvements-in-visual-studio-2015/
        if (this.devMode) {
            (envMixin as Record<string,string>).COMPLUS_FORCEENC = "1";
        }

        // Launch PowerShell in the integrated terminal
        const terminalOptions: vscode.TerminalOptions = {
            name: this.isTemp ? `${PowerShellProcess.title} (TEMP)` : PowerShellProcess.title,
            shellPath: this.exePath,
            shellArgs: powerShellArgs,
            cwd: await validateCwdSetting(this.logger),
            env: envMixin,
            iconPath: new vscode.ThemeIcon("terminal-powershell"),
            isTransient: true,
            hideFromUser: this.sessionSettings.integratedConsole.startInBackground,
            location: vscode.TerminalLocation[this.sessionSettings.integratedConsole.startLocation],
        };

        // Subscribe a log event for when the terminal closes (this fires for
        // all terminals and the event itself checks if it's our terminal). This
        // subscription should happen before we create the terminal so if it
        // fails immediately, the event fires.
        this.consoleCloseSubscription = vscode.window.onDidCloseTerminal((terminal) => { this.onTerminalClose(terminal); });
        this.consoleTerminal = vscode.window.createTerminal(terminalOptions);
        this.pid = await this.getPid();
        this.logger.write(`PowerShell process started with PID: ${this.pid}`);
        this.pidUpdateEmitter?.fire(this.pid);

        if (this.sessionSettings.integratedConsole.showOnStartup
            && !this.sessionSettings.integratedConsole.startInBackground) {
            // We still need to run this to set the active terminal to the extension terminal.
            this.consoleTerminal.show(true);
        }

        return await this.waitForSessionFile(cancellationToken);
    }

    // This function is used to clean-up stale PowerShell Extension terminals,
    // which can happen with `restartExtensionHost` is called because we are
    // unable to finish diposing before we're gone.
    public static cleanUpTerminals(): void {
        for (const terminal of vscode.window.terminals) {
            if (terminal.name.startsWith(PowerShellProcess.title)) {
                terminal.dispose();
            }
        }
    }

    // This function should only be used after a failure has occurred because it is slow!
    public async getVersionCli(): Promise<string> {
        const exec = promisify(cp.execFile);
        const { stdout } = await exec(this.exePath, ["-NoProfile", "-NoLogo", "-Command", "$PSVersionTable.PSVersion.ToString()"]);
        return stdout.trim();
    }

    // Returns the process Id of the consoleTerminal
    public async getPid(): Promise<number | undefined> {
        return await this.consoleTerminal?.processId;
    }

    public showTerminal(preserveFocus?: boolean): void {
        this.consoleTerminal?.show(preserveFocus);
    }

    public dispose(): void {
        this.logger.writeDebug(`Disposing PowerShell process with PID: ${this.pid}`);

        void this.deleteSessionFile(this.sessionFilePath);

        this.onExitedEmitter?.fire();
        this.onExitedEmitter = undefined;

        this.consoleTerminal?.dispose();
        this.consoleTerminal = undefined;

        this.consoleCloseSubscription?.dispose();
        this.consoleCloseSubscription = undefined;

        this.pidUpdateEmitter?.dispose();
        this.pidUpdateEmitter = undefined;
    }

    public sendKeyPress(): void {
        // NOTE: This is a regular character instead of something like \0
        // because non-printing characters can cause havoc with different
        // languages and terminal settings. We discard the character server-side
        // anyway, so it doesn't matter what we send.
        this.consoleTerminal?.sendText("p", false);
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

    private async readSessionFile(sessionFilePath: vscode.Uri): Promise<IEditorServicesSessionDetails> {
        const fileContents = await vscode.workspace.fs.readFile(sessionFilePath);
        return JSON.parse(fileContents.toString());
    }

    private async deleteSessionFile(sessionFilePath: vscode.Uri): Promise<void> {
        try {
            await vscode.workspace.fs.delete(sessionFilePath);
        } catch {
            // We don't care about any reasons for it to fail.
        }
    }

    private async waitForSessionFile(cancellationToken: vscode.CancellationToken): Promise<IEditorServicesSessionDetails | undefined> {
        const numOfTries = this.sessionSettings.developer.waitForSessionFileTimeoutSeconds;
        const warnAt = numOfTries - PowerShellProcess.warnUserThreshold;

        // Check every second.
        this.logger.writeDebug(`Waiting for session file: ${this.sessionFilePath}`);
        for (let i = numOfTries; i > 0; i--) {
            if (cancellationToken.isCancellationRequested) {
                this.logger.writeWarning("Canceled while waiting for session file.");
                return undefined;
            }

            if (this.consoleTerminal === undefined) {
                this.logger.writeError("Extension Terminal is undefined.");
                return undefined;
            }

            if (await utils.checkIfFileExists(this.sessionFilePath)) {
                this.logger.writeDebug("Session file found.");
                return await this.readSessionFile(this.sessionFilePath);
            }

            if (warnAt === i) {
                void this.logger.writeAndShowWarning("Loading the PowerShell extension is taking longer than expected. If you're using privilege enforcement software, this can affect start up performance.");
            }

            // Wait a bit and try again.
            await utils.sleep(1000);
        }

        this.logger.writeError("Timed out waiting for session file!");
        return undefined;
    }

    private onTerminalClose(terminal: vscode.Terminal): void {
        if (terminal !== this.consoleTerminal) {
            return;
        }

        this.logger.writeWarning(`PowerShell process terminated or Extension Terminal was closed, PID: ${this.pid}`);
        this.dispose();
    }
}
