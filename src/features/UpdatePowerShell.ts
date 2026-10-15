// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { SemVer } from "semver";
import vscode = require("vscode");

import type { ILogger } from "../logging";
import type { IPowerShellVersionDetails } from "../session";
import { changeSetting } from "../settings";

/** The WinGet package identifier for PowerShell. */
const WINGET_PACKAGE = "Microsoft.PowerShell";

/** The WinGet command that upgrades PowerShell. */
const WINGET_UPGRADE = `winget update --id ${WINGET_PACKAGE} -e -s winget`;

/** The GitHub repository that hosts the WinGet package manifests. */
const WINGET_PKGS_REPO = "microsoft/winget-pkgs";

/**
 * The first PowerShell Core release. Anything older is Windows PowerShell,
 * which is neither checked nor prompted for updates.
 */
export const FIRST_CORE_RELEASE = "6.0.0";

async function fetchJSON<T>(url: string): Promise<T | undefined> {
    const response = await fetch(url);
    if (!response.ok) return undefined;
    return response.json();
}

/** Strip the 4th component from a WinGet version (e.g. "7.4.5.0" → "7.4.5"). */
export function toTriple(v: string): string {
    return v.split(".").slice(0, 3).join(".");
}

/** Parse the PowerShell version out of `winget show` output. */
export function parseWinGetShowOutput(output: string): string | undefined {
    const match = /Version:\s*([\d.]+)/.exec(output);
    return match ? toTriple(match[1]) : undefined;
}

/** One entry from the winget-pkgs manifest directory listing. */
export interface IWinGetManifestEntry {
    name: string;
    type: string;
}

/** Get the newest PowerShell version from a manifest directory listing. */
export function getLatestWinGetVersion(
    entries: IWinGetManifestEntry[],
): string | undefined {
    return entries
        .filter(({ type }) => type === "dir")
        .map(({ name }) => toTriple(name))
        .sort((a, b) => new SemVer(b).compare(a))[0];
}

/**
 * Whether the error means there is no `winget` executable to run. Every other
 * failure (a source lookup, a network problem, and so on) leaves WinGet itself
 * installed, it just did not answer.
 */
export function isWinGetMissing(error: unknown): boolean {
    return (error as { code?: unknown } | undefined)?.code === "ENOENT";
}

/** What WinGet has for PowerShell on this machine, if anything. */
export interface IWinGetStatus {
    /** Whether the `winget` CLI was found. */
    installed: boolean;
    /** The newest PowerShell version WinGet knows about, if known. */
    version?: string;
}

/** A button of the update prompt. */
export interface IUpdatePromptOption {
    id: "winget" | "winget-progress" | "github" | "not-now" | "dont-show";
    title: string;
}

/** The update prompt to show the user. */
export interface IUpdatePrompt {
    message: string;
    options: IUpdatePromptOption[];
}

/**
 * Build the update prompt's message and buttons. This is a pure function so it
 * can be tested; the WinGet status must be detected beforehand.
 */
export function buildUpdatePrompt(
    localVersion: string,
    releaseTag: string,
    isWindows: boolean,
    winget: IWinGetStatus,
): IUpdatePrompt {
    const releaseVersion = new SemVer(releaseTag);
    // WinGet can report a version while missing (it is what it would install),
    // so only use a version that comes from an installed WinGet.
    const installedVersion =
        winget.installed && winget.version
            ? new SemVer(winget.version)
            : undefined;
    const options: IUpdatePromptOption[] = [];

    // WinGet only exists on Windows, so don't offer it elsewhere.
    if (isWindows) {
        if (!winget.installed) {
            options.push({ id: "winget", title: "Install WinGet" });
        } else if (
            installedVersion === undefined ||
            installedVersion.compare(localVersion) > 0
        ) {
            // Only offer the upgrade when WinGet actually has something newer,
            // otherwise `winget update` is a guaranteed no-op.
            options.push({ id: "winget", title: "Upgrade with WinGet" });
        }
        if (
            installedVersion &&
            installedVersion.compare(releaseVersion.version) < 0
        ) {
            options.push({
                id: "winget-progress",
                title: "View WinGet Progress",
            });
        }
    }
    options.push(
        { id: "github", title: "Open GitHub Release" },
        { id: "not-now", title: "Not Now" },
        { id: "dont-show", title: "Don't Show Again" },
    );

    let message =
        `PowerShell v${localVersion} is out-of-date.\n` +
        `The latest version is v${releaseVersion.version}.`;
    // Note when WinGet is relevant but not (yet) useful.
    if (installedVersion) {
        if (installedVersion.compare(localVersion) <= 0) {
            message += `\n(WinGet hasn't caught up yet — currently v${winget.version}.)`;
        } else if (installedVersion.compare(releaseVersion.version) < 0) {
            message += `\n(WinGet currently has v${winget.version}.)`;
        }
    } else if (isWindows) {
        message += winget.version
            ? `\n(WinGet is not installed. It offers v${winget.version}.)`
            : `\n(WinGet, the Windows Package Manager, is not installed.)`;
    }
    message += `\nWould you like to upgrade?`;

    return { message, options };
}

/** Open a terminal, show it, and run the given command. */
function runInTerminal(
    name: string,
    command: string,
    shellPath?: string,
): void {
    // Pin the shell only when asked, else use the user's default terminal.
    const terminal = shellPath
        ? vscode.window.createTerminal({ name, shellPath })
        : vscode.window.createTerminal(name);
    terminal.show();
    terminal.sendText(command);
}

/** Await a value/promise, and if non-nullish, pass it to `fn`. */
async function whenSome<T>(
    value: T | undefined | null | Promise<T | undefined | null>,
    fn: (value: T) => void | Promise<void>,
): Promise<void> {
    const resolved = await value;
    if (resolved != null) await fn(resolved);
}

/** The highest-versioned WinGet package match seen so far, with its link. */
interface IBestMatch {
    version: SemVer;
    url: string;
}

/** The given match, or `best` when it already refers to a higher version. */
function keepHighestMatch(
    best: IBestMatch | undefined,
    version: string,
    url: string,
): IBestMatch {
    const candidate = new SemVer(version);
    if (best === undefined || candidate.compare(best.version) > 0) {
        return { version: candidate, url };
    }
    return best;
}

// This attempts to mirror PowerShell's `UpdatesNotification.cs` logic as much as
// possibly, documented at:
// https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_update_notifications
export class UpdatePowerShell {
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

    private skip(reason: string): false {
        this.logger.writeDebug(reason);
        return false;
    }

    private shouldCheckForUpdate(): boolean {
        // Respect user setting.
        const promptToUpdatePowerShell = vscode.workspace
            .getConfiguration("powershell")
            .get<boolean>("promptToUpdatePowerShell", true);
        if (!promptToUpdatePowerShell)
            return this.skip("Setting 'promptToUpdatePowerShell' was false.");

        // Respect environment configuration.
        if (process.env.POWERSHELL_UPDATECHECK?.toLowerCase() === "off")
            return this.skip(
                "Environment variable 'POWERSHELL_UPDATECHECK' was 'Off'.",
            );

        // Skip prompting when using Windows PowerShell for now.
        if (this.localVersion.compare(FIRST_CORE_RELEASE) === -1)
            // TODO: Maybe we should announce PowerShell Core?
            return this.skip("Not prompting to update Windows PowerShell.");

        if (this.localVersion.prerelease.length > 1) {
            // Daily builds look like '7.3.0-daily20221206.1' which split to
            // ['daily20221206', '1'] and development builds look like
            // '7.3.0-preview.3-508-g07175...' which splits to ['preview',
            // '3-508-g0717...']. The ellipsis is hiding a 40 char hash.
            // Skip if PowerShell is self-built, that is, this contains a commit hash.
            if (this.localVersion.prerelease[1].toString().length >= 40)
                return this.skip("Not prompting to update development build.");

            // Skip if preview is a daily build.
            if (
                this.localVersion.prerelease[0]
                    .toString()
                    .toLowerCase()
                    .startsWith("daily")
            )
                return this.skip("Not prompting to update daily build.");
        }

        // TODO: Check if network is available?
        // TODO: Only check once a week.
        return true;
    }

    private async getRemoteVersion(url: string): Promise<string | undefined> {
        const data = await fetchJSON<{
            ReleaseTag: string;
        }>(url);
        if (!data) return undefined;
        this.logger.writeDebug(
            `Received from '${url}':\n${JSON.stringify(data, undefined, 2)}`,
        );
        return data.ReleaseTag;
    }

    private async maybeGetNewRelease(): Promise<string | undefined> {
        if (!this.shouldCheckForUpdate()) {
            return undefined;
        }

        this.logger.writeDebug("Checking for PowerShell update...");
        const suffixes =
            process.env.POWERSHELL_UPDATECHECK?.toLowerCase() === "lts"
                ? ["lts"]
                : this.localVersion.prerelease.length > 0
                  ? ["stable", "preview"]
                  : ["stable"];
        this.logger.writeDebug(
            `Checking for ${suffixes.join(" and ")} update...`,
        );
        for (const tag of await Promise.all(
            suffixes.map((s) =>
                this.getRemoteVersion(`https://aka.ms/pwsh-buildinfo-${s}`),
            ),
        )) {
            if (tag != undefined && this.localVersion.compare(tag) === -1) {
                return tag;
            }
        }

        this.logger.write("PowerShell is up-to-date.");
        return undefined;
    }

    public async checkForUpdate(): Promise<void> {
        try {
            await whenSome(this.maybeGetNewRelease(), (tag) =>
                this.promptToUpdate(tag),
            );
        } catch (err) {
            // Best effort. This probably failed to fetch the data from GitHub.
            this.logger.writeWarning(
                err instanceof Error ? err.message : "unknown",
            );
        }
    }

    private async openReleaseInBrowser(tag: string): Promise<void> {
        await vscode.env.openExternal(
            vscode.Uri.parse(
                `https://github.com/PowerShell/PowerShell/releases/tag/${tag}`,
            ),
        );
    }

    private async promptToUpdate(tag: string): Promise<void> {
        const releaseVersion = new SemVer(tag);
        this.logger.write(
            `Prompting to update PowerShell v${this.localVersion.version} to v${releaseVersion.version}.`,
        );

        const isWindows = process.platform === "win32";
        // Get the PowerShell version WinGet has, if WinGet exists here.
        let winget: IWinGetStatus = { installed: false };
        if (isWindows) {
            try {
                const { execFile } = await import("node:child_process");
                const { promisify } = await import("node:util");
                const { stdout } = await promisify(execFile)("winget", [
                    "show",
                    "--id",
                    WINGET_PACKAGE,
                    "-s",
                    "winget",
                    "--accept-source-agreements",
                ]);
                const version = parseWinGetShowOutput(stdout);
                if (version !== undefined) {
                    winget = { installed: true, version };
                }
            } catch (error) {
                if (isWinGetMissing(error)) {
                    // WinGet is not installed — ask the winget-pkgs listing
                    // which version it would offer.
                    try {
                        const entries = await fetchJSON<IWinGetManifestEntry[]>(
                            `https://api.github.com/repos/${WINGET_PKGS_REPO}/contents/manifests/m/Microsoft/PowerShell?per_page=100`,
                        );
                        const version = entries
                            ? getLatestWinGetVersion(entries)
                            : undefined;
                        this.logger.writeDebug(
                            `WinGet repo latest: ${version ?? "not found"}`,
                        );
                        if (version !== undefined) {
                            winget = { installed: false, version };
                        }
                    } catch {
                        // Best effort.
                    }
                } else {
                    // WinGet is installed, it just did not answer (a source or
                    // network problem), so keep it and leave the version unknown.
                    this.logger.writeDebug(
                        `Could not get the WinGet version: ${error instanceof Error ? error.message : "unknown"}`,
                    );
                    winget = { installed: true };
                }
            }
        }

        const { message, options } = buildUpdatePrompt(
            this.localVersion.version,
            tag,
            isWindows,
            winget,
        );

        const result = await vscode.window.showInformationMessage(
            message,
            ...options,
        );

        // If the user cancels the notification.
        if (!result) {
            this.logger.writeDebug("User canceled PowerShell update prompt.");
            return;
        }

        this.logger.writeDebug(`User said '${result.title}'.`);

        switch (result.id) {
            case "winget":
                if (winget.installed) {
                    this.logger.write("Upgrading PowerShell via WinGet...");
                    runInTerminal(
                        "PowerShell Upgrade (WinGet)",
                        WINGET_UPGRADE,
                    );
                } else {
                    // From: https://aka.ms/winget-docs
                    this.logger.write(
                        "Installing WinGet and upgrading PowerShell...",
                    );
                    // The command is PowerShell (Add-AppxPackage is a cmdlet),
                    // so don't run it in whatever profile happens to be the
                    // user's default terminal.
                    runInTerminal(
                        "Install WinGet & Upgrade PowerShell",
                        "$result = Add-AppxPackage -RegisterByFamilyName -MainPackage Microsoft.DesktopAppInstaller_8wekyb3d8bbwe -ErrorAction SilentlyContinue; " +
                            `if ($?) { ${WINGET_UPGRADE} } else { Write-Warning 'Failed to install WinGet. See https://aka.ms/winget-docs' }`,
                        "powershell.exe",
                    );
                }
                break;
            case "winget-progress": {
                // Open the winget-pkgs issue or PR for the version WinGet is
                // missing; find the open issue/PR mentioning the highest
                // PowerShell version.
                let statusUrl =
                    `https://github.com/${WINGET_PKGS_REPO}` +
                    `/pulls?q=${WINGET_PACKAGE}+is:open`;
                try {
                    let bestPR: IBestMatch | undefined;
                    let bestIssue: IBestMatch | undefined;
                    for (const {
                        ver,
                        html_url,
                        pull_request,
                    } of await Promise.all(
                        (
                            (
                                await fetchJSON<{
                                    items?: {
                                        title: string;
                                        html_url: string;
                                        pull_request?: unknown;
                                    }[];
                                }>(
                                    `https://api.github.com/search/issues?q=${WINGET_PACKAGE}+repo:${WINGET_PKGS_REPO}+is:open&sort=created&order=desc&per_page=30`,
                                )
                            )?.items ?? []
                        ).map(
                            async (
                                item,
                            ): Promise<typeof item & { ver?: string }> => {
                                const tm =
                                    /(?:New version|Update|\[Update Request\]).*?(\d+\.\d+\.\d+)/i.exec(
                                        item.title,
                                    );
                                if (tm) return { ...item, ver: tm[1] };
                                // Try to extract version from the issue body.
                                try {
                                    const bm = (
                                        await fetchJSON<{
                                            body?: string;
                                        }>(
                                            item.html_url.replace(
                                                "https://github.com/",
                                                "https://api.github.com/repos/",
                                            ),
                                        )
                                    )?.body?.match(
                                        /Package Version.*?(\d+\.\d+\.\d+)/i,
                                    );
                                    if (bm) {
                                        return { ...item, ver: bm[1] };
                                    }
                                } catch {
                                    // Best effort.
                                }
                                return item;
                            },
                        ),
                    )) {
                        if (!ver) continue;
                        if (pull_request) {
                            bestPR = keepHighestMatch(bestPR, ver, html_url);
                        } else {
                            bestIssue = keepHighestMatch(
                                bestIssue,
                                ver,
                                html_url,
                            );
                        }
                    }
                    // Prefer issue when linked to the PR for the same version.
                    if (
                        bestPR &&
                        bestIssue &&
                        bestPR.version.compare(bestIssue.version) === 0
                    ) {
                        statusUrl = bestIssue.url;
                    } else if (
                        bestPR &&
                        (!bestIssue ||
                            bestPR.version.compare(bestIssue.version) > 0)
                    ) {
                        statusUrl = bestPR.url;
                    } else if (bestIssue) {
                        statusUrl = bestIssue.url;
                    }
                } catch {
                    // Fall back to generic search.
                }
                await vscode.env.openExternal(vscode.Uri.parse(statusUrl));
                break;
            }
            case "github":
                await this.openReleaseInBrowser(tag);
                break;
            case "not-now":
                // Do nothing.
                break;
            case "dont-show":
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
