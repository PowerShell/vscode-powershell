/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import fetch from "node-fetch";
import { compare, parse, prerelease, SemVer } from "semver";
import { MessageItem, window } from "vscode";
import { LanguageClient } from "vscode-languageclient";
import Settings = require("../settings");
import { EvaluateRequestType } from "./Console";

const PowerShellGitHubReleasesUrl =
        "https://api.github.com/repos/PowerShell/PowerShell/releases/latest";
const PowerShellGitHubPrereleasesUrl =
    "https://api.github.com/repos/PowerShell/PowerShell/releases";

export class GitHubReleaseInformation {
    public static async FetchLatestRelease(preview: boolean): Promise<GitHubReleaseInformation> {
        // Fetch the latest PowerShell releases from GitHub.
        let releaseJson: any;
        if (preview) {
            // This gets all releases and the first one is the latest prerelease if
            // there is a prerelease version.
            releaseJson = (await fetch(PowerShellGitHubPrereleasesUrl)
                .then((res) => res.json())).find((release: any) => release.prerelease);
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
    languageServerClient: LanguageClient,
    localVersion: SemVer,
    arch: string,
    release: GitHubReleaseInformation) {
    const options: IUpdateMessageItem[] = [
        {
            id: 0,
            title: "Yes",
        },
        {
            id: 1,
            title: "Not now",
        },
        {
            id: 2,
            title: "Do not show this notification again",
        },
    ];

    // If our local version is up-to-date, we can return early.
    if (compare(localVersion, release.version) >= 0) {
        return;
    }

    const commonText: string = `You have an old version of PowerShell (${
        localVersion.raw
    }). The current latest release is ${
        release.version.raw
    }.`;

    if (process.platform === "linux") {
        await window.showInformationMessage(
            `${commonText} We recommend updating to the latest version.`);
        return;
    }

    const isMacOS: boolean = process.platform === "darwin";
    const result = await window.showInformationMessage(
        `${commonText} Would you like to update the version? ${
            isMacOS ? "(Homebrew is required on macOS)" : ""
        }`, ...options);

    // If the user cancels the notification.
    if (!result) { return; }

    // Yes choice.
    switch (result.id) {
        // Yes choice.
        case 0:
            let script: string;
            if (process.platform === "win32") {
                const msiMatcher = arch === "x86" ?
                    "win-x86.msi" : "win-x64.msi";

                const assetUrl = release.assets.filter((asset: any) =>
                    asset.name.indexOf(msiMatcher) >= 0)[0].url;

                // Grab MSI and run it.
                // tslint:disable-next-line: max-line-length
                script = `
$randomFileName = [System.IO.Path]::GetRandomFileName()
$tmpMsiPath = Microsoft.PowerShell.Management\\Join-Path ([System.IO.Path]::GetTempPath()) "$randomFileName.msi"
Microsoft.PowerShell.Utility\\Invoke-RestMethod -Uri ${assetUrl} -OutFile $tmpMsiPath
try
{
    Microsoft.PowerShell.Management\\Start-Process -Wait -Path $tmpMsiPath
}
finally
{
    Microsoft.PowerShell.Management\\Remove-Item $tmpMsiPath
}`;

            } else if (isMacOS) {
                script = "brew cask upgrade powershell";
                if (release.isPreview) {
                    script = "brew cask upgrade powershell-preview";
                }
            }

            await languageServerClient.sendRequest(EvaluateRequestType, {
                expression: script,
            });
            break;

        // Never choice.
        case 2:
            await Settings.change("promptToUpdatePowerShell", false, true);
            break;
        default:
            break;
    }
}
