// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { spawn } from "child_process";
import * as fs from "fs"; // TODO: Remove, but it's for a stream.
import fetch from "node-fetch";
import * as os from "os";
import * as path from "path";
import { SemVer } from "semver";
import * as stream from "stream";
import * as util from "util";
import vscode = require("vscode");

import { ILogger } from "../logging";
import { IPowerShellVersionDetails, SessionManager } from "../session";
import { changeSetting, Settings } from "../settings";
import { isWindows } from "../utils";

const streamPipeline = util.promisify(stream.pipeline);

interface IUpdateMessageItem extends vscode.MessageItem {
    id: number;
}

// This attempts to mirror PowerShell's `UpdatesNotification.cs` logic as much as
// possibly, documented at:
// https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_update_notifications
export class UpdatePowerShell {
    private static LTSBuildInfoURL = "https://aka.ms/pwsh-buildinfo-lts";
    private static StableBuildInfoURL = "https://aka.ms/pwsh-buildinfo-stable";
    private static PreviewBuildInfoURL = "https://aka.ms/pwsh-buildinfo-preview";
    private static GitHubAPIReleaseURL = "https://api.github.com/repos/PowerShell/PowerShell/releases/tags/";
    private static GitHubWebReleaseURL = "https://github.com/PowerShell/PowerShell/releases/tag/";
    private static promptOptions: IUpdateMessageItem[] = [
        {
            id: 0,
            title: "Yes",
        },
        {
            id: 1,
            title: "Not Now",
        },
        {
            id: 2,
            title: "Don't Show Again",
        },
    ];
    private localVersion: SemVer;
    private architecture: string;

    constructor(
        private sessionManager: SessionManager,
        private sessionSettings: Settings,
        private logger: ILogger,
        versionDetails: IPowerShellVersionDetails) {
        // We use the commit field as it's like
        // '7.3.0-preview.3-508-g07175ae0ff8eb7306fe0b0fc7d...' which translates
        // to SemVer. The version handler in PSES handles Windows PowerShell and
        // just returns the first three fields like '5.1.22621'.
        this.localVersion = new SemVer(versionDetails.commit);
        this.architecture = versionDetails.architecture.toLowerCase();
    }

    private shouldCheckForUpdate(): boolean {
        // Respect user setting.
        if (!this.sessionSettings.promptToUpdatePowerShell) {
            this.logger.writeDiagnostic("Setting 'promptToUpdatePowerShell' was false.");
            return false;
        }

        // Respect environment configuration.
        if (process.env.POWERSHELL_UPDATECHECK?.toLowerCase() === "off") {
            this.logger.writeDiagnostic("Environment variable 'POWERSHELL_UPDATECHECK' was 'Off'.");
            return false;
        }

        // Skip prompting when using Windows PowerShell for now.
        if (this.localVersion.compare("6.0.0") === -1) {
            // TODO: Maybe we should announce PowerShell Core?
            this.logger.writeDiagnostic("Not offering to update Windows PowerShell.");
            return false;
        }

        if (this.localVersion.prerelease.length > 1) {
            // Daily builds look like '7.3.0-daily20221206.1' which split to
            // ['daily20221206', '1'] and development builds look like
            // '7.3.0-preview.3-508-g07175...' which splits to ['preview',
            // '3-508-g0717...']. The ellipsis is hiding a 40 char hash.
            const daily = this.localVersion.prerelease[0].toString();
            const commit = this.localVersion.prerelease[1].toString();

            // Skip if PowerShell is self-built, that is, this contains a commit hash.
            if (commit.length >= 40) {
                this.logger.writeDiagnostic("Not offering to update development build.");
                return false;
            }

            // Skip if preview is a daily build.
            if (daily.toLowerCase().startsWith("daily")) {
                this.logger.writeDiagnostic("Not offering to update daily build.");
                return false;
            }
        }

        // TODO: Check if network is available?
        // TODO: Only check once a week.
        this.logger.writeDiagnostic("Should check for PowerShell update.");
        return true;
    }

    private async getRemoteVersion(url: string): Promise<string> {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error("Failed to get remote version!");
        }
        // Looks like:
        // {
        //     "ReleaseDate": "2022-10-20T22:01:38Z",
        //     "BlobName": "v7-2-7",
        //     "ReleaseTag": "v7.2.7"
        // }
        const data = await response.json();
        this.logger.writeDiagnostic(`From '${url}' received:\n${data}`);
        return data.ReleaseTag;
    }

    private async maybeGetNewRelease(): Promise<string | undefined> {
        if (!this.shouldCheckForUpdate()) {
            return undefined;
        }

        const tags: string[] = [];
        if (process.env.POWERSHELL_UPDATECHECK?.toLowerCase() === "lts") {
            // Only check for update to LTS.
            this.logger.writeDiagnostic("Checking for LTS update.");
            tags.push(await this.getRemoteVersion(UpdatePowerShell.LTSBuildInfoURL));
        } else {
            // Check for update to stable.
            this.logger.writeDiagnostic("Checking for stable update.");
            tags.push(await this.getRemoteVersion(UpdatePowerShell.StableBuildInfoURL));

            // Also check for a preview update.
            if (this.localVersion.prerelease.length > 0) {
                this.logger.writeDiagnostic("Checking for preview update.");
                tags.push(await this.getRemoteVersion(UpdatePowerShell.PreviewBuildInfoURL));
            }
        }

        for (const tag of tags) {
            if (this.localVersion.compare(tag) === -1) {
                this.logger.writeDiagnostic(`Offering to update PowerShell to ${tag}.`);
                return tag;
            }
        }

        return undefined;
    }

    public async checkForUpdate() {
        try {
            const tag = await this.maybeGetNewRelease();
            if (tag) {
                return await this.installUpdate(tag);
            }
        } catch (err) {
            // Best effort. This probably failed to fetch the data from GitHub.
            this.logger.writeWarning(err instanceof Error ? err.message : "unknown");
        }
    }

    private async openReleaseInBrowser(tag: string) {
        const url = vscode.Uri.parse(UpdatePowerShell.GitHubWebReleaseURL + tag);
        await vscode.env.openExternal(url);
    }

    private async updateWindows(tag: string) {
        let msiMatcher: string;
        if (this.architecture === "x64") {
            msiMatcher = "win-x64.msi";
        } else if (this.architecture === "x86") {
            msiMatcher = "win-x86.msi";
        } else {
            // We shouldn't get here, but do something sane anyway.
            return this.openReleaseInBrowser(tag);
        }

        let response = await fetch(UpdatePowerShell.GitHubAPIReleaseURL + tag);
        if (!response.ok) {
            throw new Error("Failed to fetch GitHub release info!");
        }
        const release = await response.json();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const asset = release.assets.filter((a: any) => a.name.indexOf(msiMatcher) >= 0)[0];
        const msiDownloadPath = path.join(os.tmpdir(), asset.name);

        response = await fetch(asset.browser_download_url);
        if (!response.ok) {
            throw new Error("Failed to fetch MSI!");
        }

        const progressOptions = {
            title: "Downloading PowerShell Installer...",
            location: vscode.ProgressLocation.Notification,
            cancellable: false,
        };
        // Streams the body of the request to a file.
        await vscode.window.withProgress(progressOptions,
            async () => { await streamPipeline(response.body, fs.createWriteStream(msiDownloadPath)); });

        // Stop the session because Windows likes to hold on to files.
        this.logger.writeDiagnostic("MSI downloaded, stopping session and closing terminals!");
        await this.sessionManager.stop();

        // Close all terminals with the name "pwsh" in the current VS Code session.
        // This will encourage folks to not close the instance of VS Code that spawned
        // the MSI process.
        for (const terminal of vscode.window.terminals) {
            if (terminal.name === "pwsh") {
                terminal.dispose();
            }
        }

        // Invoke the MSI via cmd.
        this.logger.writeDiagnostic(`Running '${msiDownloadPath}' to update PowerShell...`);
        const msi = spawn("msiexec", ["/i", msiDownloadPath]);

        msi.on("close", () => {
            // Now that the MSI is finished, restart the session.
            this.logger.writeDiagnostic("MSI installation finished, restarting session.");
            void this.sessionManager.start();
            fs.unlinkSync(msiDownloadPath);
        });
    }

    private async installUpdate(tag: string) {
        const releaseVersion = new SemVer(tag);
        const result = await vscode.window.showInformationMessage(
            `You have an old version of PowerShell (${this.localVersion.version}). The current latest release is ${releaseVersion.version}.
            Would you like to update the version? ${isWindows
        ? "This will close ALL pwsh terminals running in this VS Code session!"
        : "We can't update you automatically, but we can open the latest release in your browser!"
}`, ...UpdatePowerShell.promptOptions);

        // If the user cancels the notification.
        if (!result) {
            this.logger.writeDiagnostic("User canceled PowerShell update prompt.");
            return;
        }

        this.logger.writeDiagnostic(`User said '${UpdatePowerShell.promptOptions[result.id].title}'.`);

        switch (result.id) {
        // Yes
        case 0:
            if (isWindows && (this.architecture === "x64" || this.architecture === "x86")) {
                await this.updateWindows(tag);
            } else {
                await this.openReleaseInBrowser(tag);
            }
            break;
            // Not Now
        case 1:
            break;
            // Don't Show Again
        case 2:
            await changeSetting("promptToUpdatePowerShell", false, true, this.logger);
            break;
        default:
            break;
        }
    }
}
