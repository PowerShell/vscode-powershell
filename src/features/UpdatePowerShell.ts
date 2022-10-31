// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { spawn } from "child_process";
import * as fs from "fs"; // TODO: Remove, but it's for a stream.
import fetch, { RequestInit } from "node-fetch";
import * as os from "os";
import * as path from "path";
import * as semver from "semver";
import * as stream from "stream";
import * as util from "util";
import { MessageItem, ProgressLocation, window } from "vscode";

import { LanguageClient } from "vscode-languageclient/node";
import { Logger } from "../logging";
import { SessionManager } from "../session";
import * as Settings from "../settings";
import { isMacOS, isWindows } from "../utils";
import { EvaluateRequestType } from "./Console";

const streamPipeline = util.promisify(stream.pipeline);

const PowerShellGitHubReleasesUrl =
    "https://api.github.com/repos/PowerShell/PowerShell/releases/latest";
const PowerShellGitHubPreReleasesUrl =
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
            preview ? PowerShellGitHubPreReleasesUrl : PowerShellGitHubReleasesUrl,
            requestConfig);

        if (!response.ok) {
            const json = await response.json();
            throw new Error(json.message || json || "response was not ok.");
        }

        // For preview, we grab all the releases and then grab the first prerelease.
        const releaseJson = preview
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ? (await response.json()).find((release: any) => release.prerelease)
            : await response.json();

        return new GitHubReleaseInformation(
            releaseJson.tag_name, releaseJson.assets);
    }

    public version: semver.SemVer;
    public isPreview = false;
    // TODO: Establish a type for the assets.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public assets: any[];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public constructor(version: string | semver.SemVer, assets: any[] = []) {
        this.version = semver.parse(version)!;

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
    sessionManager: SessionManager,
    languageServerClient: LanguageClient,
    localVersion: semver.SemVer,
    arch: string,
    release: GitHubReleaseInformation,
    logger: Logger) {
    const options: IUpdateMessageItem[] = [
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

    // If our local version is up-to-date, we can return early.
    if (semver.compare(localVersion, release.version) >= 0) {
        logger.writeDiagnostic("PowerShell is up-to-date!");
        return;
    }

    const commonText = `You have an old version of PowerShell (${localVersion.raw
    }). The current latest release is ${release.version.raw
    }.`;

    if (process.platform === "linux") {
        void logger.writeAndShowInformation(`${commonText} We recommend updating to the latest version.`);
        return;
    }

    const result = await window.showInformationMessage(
        `${commonText} Would you like to update the version? ${isMacOS ? "(Homebrew is required on macOS)"
            : "(This will close ALL pwsh terminals running in this Visual Studio Code session)"
        }`, ...options);

    // If the user cancels the notification.
    if (!result) {
        logger.writeDiagnostic("User canceled PowerShell update prompt.");
        return;
    }

    // Yes choice.
    switch (result.id) {
    // Yes choice.
    case 0:
        if (isWindows) {
            const msiMatcher = arch === "x86" ?
                "win-x86.msi" : "win-x64.msi";

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const asset = release.assets.filter((a: any) => a.name.indexOf(msiMatcher) >= 0)[0];
            const msiDownloadPath = path.join(os.tmpdir(), asset.name);

            const res = await fetch(asset.browser_download_url);
            if (!res.ok) {
                throw new Error("unable to fetch MSI");
            }

            await window.withProgress({
                title: "Downloading PowerShell Installer...",
                location: ProgressLocation.Notification,
                cancellable: false,
            },
            async () => {
                // Streams the body of the request to a file.
                await streamPipeline(res.body, fs.createWriteStream(msiDownloadPath));
            });

            // Stop the session because Windows likes to hold on to files.
            logger.writeDiagnostic("MSI downloaded, stopping session and closing terminals!");
            await sessionManager.stop();

            // Close all terminals with the name "pwsh" in the current VS Code session.
            // This will encourage folks to not close the instance of VS Code that spawned
            // the MSI process.
            for (const terminal of window.terminals) {
                if (terminal.name === "pwsh") {
                    terminal.dispose();
                }
            }

            // Invoke the MSI via cmd.
            logger.writeDiagnostic(`Running '${msiDownloadPath}' to update PowerShell...`);
            const msi = spawn("msiexec", ["/i", msiDownloadPath]);

            msi.on("close", () => {
                // Now that the MSI is finished, restart the session.
                logger.writeDiagnostic("MSI installation finished, restarting session.");
                void sessionManager.start();
                fs.unlinkSync(msiDownloadPath);
            });

        } else if (isMacOS) {
            const script = release.isPreview
                ? "brew upgrade --cask powershell-preview"
                : "brew upgrade --cask powershell";

            logger.writeDiagnostic(`Running '${script}' to update PowerShell...`);
            await languageServerClient.sendRequest(EvaluateRequestType, {
                expression: script,
            });
        }

        break;

        // Never choice.
    case 2:
        await Settings.change("promptToUpdatePowerShell", false, true, logger);
        break;
    default:
        break;
    }
}
