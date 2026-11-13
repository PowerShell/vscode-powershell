// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { SemVer } from "semver";
import vscode = require("vscode");

import type { ILogger } from "../logging";
import type { IPowerShellVersionDetails } from "../session";
import { changeSetting } from "../settings";

interface IUpdateMessageItem extends vscode.MessageItem {
    id: number;
}

type UpdateChannel = "latest" | "preview" | "lts";

interface IPowerShellReleaseMetadata {
    StableReleaseTag?: string;
    PreviewReleaseTag?: string;
    LTSReleaseTag?: string;
}

// This attempts to mirror PowerShell's `UpdatesNotification.cs` logic as much as
// possibly, documented at:
// https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_update_notifications
export class UpdatePowerShell {
    private static ReleaseMetadataURL =
        "https://raw.githubusercontent.com/PowerShell/PowerShell/refs/heads/master/tools/metadata.json";
    private static GitHubWebReleaseURL =
        "https://github.com/PowerShell/PowerShell/releases/tag/";
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
        private logger: ILogger,
        versionDetails: IPowerShellVersionDetails,
    ) {
        // We use the commit field as it's like
        // '7.3.0-preview.3-508-g07175ae0ff8eb7306fe0b0fc7d...' which translates
        // to SemVer. The version handler in PSES handles Windows PowerShell and
        // just returns the first three fields like '5.1.22621'.
        this.localVersion = new SemVer(versionDetails.commit);
    }

    private shouldCheckForUpdate(): boolean {
        // Respect user setting.
        const promptToUpdatePowerShell = vscode.workspace
            .getConfiguration("powershell")
            .get<boolean>("promptToUpdatePowerShell", true);
        if (!promptToUpdatePowerShell) {
            this.logger.writeDebug(
                "Setting 'promptToUpdatePowerShell' was false.",
            );
            return false;
        }

        // Respect environment configuration.
        if (process.env.POWERSHELL_UPDATECHECK?.toLowerCase() === "off") {
            this.logger.writeDebug(
                "Environment variable 'POWERSHELL_UPDATECHECK' was 'Off'.",
            );
            return false;
        }

        // Skip prompting when using Windows PowerShell for now.
        if (this.localVersion.compare("6.0.0") === -1) {
            // TODO: Maybe we should announce PowerShell Core?
            this.logger.writeDebug(
                "Not prompting to update Windows PowerShell.",
            );
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
                this.logger.writeDebug(
                    "Not prompting to update development build.",
                );
                return false;
            }

            // Skip if preview is a daily build.
            if (daily.toLowerCase().startsWith("daily")) {
                this.logger.writeDebug("Not prompting to update daily build.");
                return false;
            }
        }

        // TODO: Check if network is available?
        // TODO: Only check once a week.
        return true;
    }

    private async getRemoteVersion(
        channel: UpdateChannel,
    ): Promise<string | undefined> {
        const response = await fetch(UpdatePowerShell.ReleaseMetadataURL);
        if (!response.ok) {
            return undefined;
        }
        const data = (await response.json()) as IPowerShellReleaseMetadata;
        this.logger.writeDebug(
            `Received from '${UpdatePowerShell.ReleaseMetadataURL}':\n${JSON.stringify(data, undefined, 2)}`,
        );
        return {
            latest: data.StableReleaseTag,
            preview: data.PreviewReleaseTag,
            lts: data.LTSReleaseTag,
        }[channel];
    }

    private async maybeGetNewRelease(): Promise<string | undefined> {
        if (!this.shouldCheckForUpdate()) {
            return undefined;
        }

        this.logger.writeDebug("Checking for PowerShell update...");
        const updateChannel =
            process.env.POWERSHELL_UPDATECHECK?.toLowerCase() === "lts"
                ? "lts"
                : vscode.workspace
                      .getConfiguration("powershell")
                      .get<UpdateChannel>("updateChannel", "latest");
        this.logger.writeDebug(
            `Checking for ${updateChannel} PowerShell update...`,
        );
        const tag = await this.getRemoteVersion(updateChannel);
        if (tag && this.localVersion.compare(tag) === -1) {
            return tag;
        }

        this.logger.write("PowerShell is up-to-date.");
        return undefined;
    }

    public async checkForUpdate(): Promise<void> {
        try {
            const tag = await this.maybeGetNewRelease();
            if (tag) {
                await this.promptToUpdate(tag);
                return;
            }
        } catch (err) {
            // Best effort. This probably failed to fetch the data from GitHub.
            this.logger.writeWarning(
                err instanceof Error ? err.message : "unknown",
            );
        }
    }

    private async openReleaseInBrowser(tag: string): Promise<void> {
        const url = vscode.Uri.parse(
            UpdatePowerShell.GitHubWebReleaseURL + tag,
        );
        await vscode.env.openExternal(url);
    }

    private async promptToUpdate(tag: string): Promise<void> {
        const releaseVersion = new SemVer(tag);
        this.logger.write(
            `Prompting to update PowerShell v${this.localVersion.version} to v${releaseVersion.version}.`,
        );
        const result = await vscode.window.showInformationMessage(
            `PowerShell v${this.localVersion.version} is out-of-date.
             The latest version is v${releaseVersion.version}.
             Would you like to open the GitHub release in your browser?`,
            ...UpdatePowerShell.promptOptions,
        );

        // If the user cancels the notification.
        if (!result) {
            this.logger.writeDebug("User canceled PowerShell update prompt.");
            return;
        }

        this.logger.writeDebug(
            `User said '${UpdatePowerShell.promptOptions[result.id].title}'.`,
        );

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
                await changeSetting(
                    "promptToUpdatePowerShell",
                    false,
                    true,
                    this.logger,
                );
                break;
            default:
                break;
        }
    }
}
