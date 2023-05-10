// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import fetch from "node-fetch";
import { SemVer } from "semver";
import vscode = require("vscode");

import { ILogger } from "../logging";
import { IPowerShellVersionDetails } from "../session";
import { changeSetting, Settings } from "../settings";

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

    constructor(
        private sessionSettings: Settings,
        private logger: ILogger,
        versionDetails: IPowerShellVersionDetails) {
        // We use the commit field as it's like
        // '7.3.0-preview.3-508-g07175ae0ff8eb7306fe0b0fc7d...' which translates
        // to SemVer. The version handler in PSES handles Windows PowerShell and
        // just returns the first three fields like '5.1.22621'.
        this.localVersion = new SemVer(versionDetails.commit);
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

    public async checkForUpdate(): Promise<void> {
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

    private async openReleaseInBrowser(tag: string): Promise<void> {
        const url = vscode.Uri.parse(UpdatePowerShell.GitHubWebReleaseURL + tag);
        await vscode.env.openExternal(url);
    }

    private async installUpdate(tag: string): Promise<void> {
        const releaseVersion = new SemVer(tag);
        const result = await vscode.window.showInformationMessage(
            `You have an old version of PowerShell (${this.localVersion.version}).
            The current latest release is ${releaseVersion.version}.
            Would you like to open the GitHub release in your browser?`,
            ...UpdatePowerShell.promptOptions);

        // If the user cancels the notification.
        if (!result) {
            this.logger.writeDiagnostic("User canceled PowerShell update prompt.");
            return;
        }

        this.logger.writeDiagnostic(`User said '${UpdatePowerShell.promptOptions[result.id].title}'.`);

        switch (result.id) {
        // Yes
        case 0:
            await this.openReleaseInBrowser(tag);
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
