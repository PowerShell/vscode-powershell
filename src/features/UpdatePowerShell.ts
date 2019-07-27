/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import fetch from "node-fetch";
import { compare, parse, prerelease, SemVer } from "semver";
import { MessageItem, window } from "vscode";
import Settings = require("../settings");
import { EvaluateRequestType } from "./Console";

const PowerShellGitHubReleasesUrl =
        "https://api.github.com/repos/PowerShell/PowerShell/releases/latest";
const PowerShellGitHubRPrereleasesUrl =
    "https://api.github.com/repos/PowerShell/PowerShell/releases";

export class GitHubReleaseInformation {
    public static async FetchLatestRelease(preview: boolean): Promise<GitHubReleaseInformation> {
        // Fetch the latest PowerShell releases from GitHub.
        let releaseJson: any;
        if (preview) {
            // This gets all releases and the first one is the latest prerelease if
            // there is a prerelease version.
            releaseJson = (await fetch(PowerShellGitHubRPrereleasesUrl)
                .then((res) => res.json()))[0];
        } else {
            releaseJson = await fetch(PowerShellGitHubReleasesUrl)
                .then((res) => res.json());
        }

        return new GitHubReleaseInformation(
            releaseJson.tag_name, releaseJson.assets);
    }

    public version: SemVer;
    public isPreview: boolean = false;
    public assets: any[];

    public constructor(version: string | SemVer, assets: any[] = []) {
        this.version = parse(version);

        if (prerelease(this.version)) {
            this.isPreview = true;
        }

        this.assets = assets;
    }
}

interface IUpdateMessageItem extends MessageItem {
    id: number;
}

export async function InvokePowerShellUpdateCheck(
    localVersion: SemVer, arch: string, release: GitHubReleaseInformation) {
    const options: IUpdateMessageItem[] = [
        {
            id: 0,
            title: "Yes!",
        },
        {
            id: 1,
            title: "Not now.",
        },
        {
            id: 2,
            title: "Never...",
        },
    ];

    if (compare(release.version, localVersion) > 0) {
        const result = await window.showInformationMessage(
            `You have an old version of PowerShell (${
            localVersion.raw
        }). The current latest release is ${
            release.version.raw
        }. Would you like to update the version?`, ...options);

        // Yes choice.
        if (result.id === 0) {
            let script: string;
            if (process.platform === "win32") {
                const msiMatcher = arch === "x86" ?
                    "win-x86.msi" : "win-x64.msi";

                const assetUrl = release.assets.filter((asset: any) =>
                    asset.name.indexOf(msiMatcher) >= 0)[0].url;

                // Grab MSI and run it.
                // tslint:disable-next-line: max-line-length
                script = `$tmpMsiPath = Microsoft.PowerShell.Management\\Join-Path ([System.IO.Path]::GetTempPath()) "pwsh.msi";
Microsoft.PowerShell.Utility\\Invoke-RestMethod -Uri ${assetUrl} -OutFile $tmpMsiPath;
Microsoft.PowerShell.Management\\Invoke-Item $tmpMsiPath;`;

            } else if (process.platform === "darwin") {
                script = "brew cask upgrade powershell";
                if (release.isPreview) {
                    script = "brew cask upgrade powershell-preview";
                }
            } else if (process.platform === "linux") {
                window.showWarningMessage(
                    "Update through VS Code not supported on Linux.");
                return;
            }
            await this.languageServerClient.sendRequest(EvaluateRequestType, {
                expression: script,
            });
        // Never choice.
        } else if (result.id === 2) {
            await Settings.change("promptToUpdatePowerShell", false, true);
        }
    }
}
