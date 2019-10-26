/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import fetch, { RequestInit } from "node-fetch";
import * as semver from "semver";
import { MessageItem, window } from "vscode";
import { LanguageClient } from "vscode-languageclient";
import * as Settings from "../settings";
import { EvaluateRequestType } from "./Console";

const PowerShellGitHubReleasesUrl =
        "https://api.github.com/repos/PowerShell/PowerShell/releases/latest";
const PowerShellGitHubPrereleasesUrl =
    "https://api.github.com/repos/PowerShell/PowerShell/releases";

export class GitHubReleaseInformation {
    public static async FetchLatestRelease(preview: boolean): Promise<GitHubReleaseInformation> {
        const requestConfig: RequestInit = {};

        // For CI. This prevents GitHub from rate limiting us.
        if (process.env.PS_TEST_GITHUB_API_USERNAME && process.env.PS_TEST_GITHUB_API_PAT) {
            const authHeaderValue = Buffer
                .from(`${process.env.PS_TEST_GITHUB_API_USERNAME}:${process.env.PS_TEST_GITHUB_API_PAT}`)
                .toString("base64");
            requestConfig.headers = {
                Authorization: `Basic ${authHeaderValue}`,
            };
        }

        // Fetch the latest PowerShell releases from GitHub.
        const response = await fetch(
            preview ? PowerShellGitHubPrereleasesUrl : PowerShellGitHubReleasesUrl,
            requestConfig);

        if (!response.ok) {
            const json = await response.json();
            throw json.message || json || "response was not ok.";
        }

        // For preview, we grab all the releases and then grab the first prerelease.
        const releaseJson = preview
            ? (await response.json()).find((release: any) => release.prerelease)
            : await response.json();

        return new GitHubReleaseInformation(
            releaseJson.tag_name, releaseJson.assets);
    }

    public version: semver.SemVer;
    public isPreview: boolean = false;
    public assets: any[];

    public constructor(version: string | semver.SemVer, assets: any[] = []) {
        this.version = semver.parse(version);

        if (semver.prerelease(this.version)) {
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
    localVersion: semver.SemVer,
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
    if (semver.compare(localVersion, release.version) >= 0) {
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
                    asset.name.indexOf(msiMatcher) >= 0)[0].browser_download_url;

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
