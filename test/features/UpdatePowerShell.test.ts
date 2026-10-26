// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import assert from "assert";
import { SemVer, type ReleaseType } from "semver";
import * as vscode from "vscode";
import type {
    IUpdatePrompt,
    IUpdatePromptOption,
    IWinGetStatus,
} from "../../src/features/UpdatePowerShell";
import {
    buildUpdatePrompt,
    FIRST_CORE_RELEASE,
    getLatestWinGetVersion,
    isWinGetMissing,
    parseWinGetShowOutput,
    toTriple,
    UpdatePowerShell,
} from "../../src/features/UpdatePowerShell";
import type { IPowerShellVersionDetails } from "../../src/session";
import { changeSetting } from "../../src/settings";
import { testLogger } from "../utils";

/**
 * The first PowerShell Core release, which is also the oldest release checked
 * for updates. Every version in this file derives from it, so the tests
 * describe how releases relate to one another (newer, older, stable,
 * prerelease) instead of pinning releases, which go stale.
 */
const firstCore = new SemVer(FIRST_CORE_RELEASE);

/** `version` incremented by `release`, e.g. its next patch or minor release. */
function bumped(version: SemVer, release: ReleaseType): SemVer {
    // `new SemVer(version)` would return `version` itself here, and `inc`
    // mutates, so clone from the string to leave the argument alone.
    return new SemVer(version.version).inc(release);
}

/** The major release before `version`, e.g. Windows PowerShell before Core. */
function previousMajor(version: SemVer): SemVer {
    return new SemVer(`${version.major - 1}.0.0`);
}

/** The first preview of `release`, e.g. "6.0.0-preview.1". */
function preview(release: SemVer): string {
    return `${release.version}-preview.1`;
}

/** How much of its commit hash a self-built PowerShell embeds in its version. */
const COMMIT_HASH_LENGTH = 40;

/** A self-built development release, which embeds its commit hash. */
function developmentBuild(release: SemVer): string {
    return `${preview(release)}-1-g${"0".repeat(COMMIT_HASH_LENGTH)}`;
}

/** The day a daily release is stamped with, in PowerShell's `yyyyMMdd` form. */
const DAILY_BUILD_DAY = "20221206";

/** A daily release, which is stamped with the day it was built. */
function dailyBuild(release: SemVer): string {
    return `${release.version}-daily${DAILY_BUILD_DAY}.1`;
}

/** PowerShell version details, defaulting to a stable Core x64 build. */
function versionDetails(
    version: string,
    overrides: Partial<IPowerShellVersionDetails> = {},
): IPowerShellVersionDetails {
    return {
        version,
        edition: "Core",
        commit: version,
        architecture: "X64",
        ...overrides,
    };
}

/** An `UpdatePowerShell` instance, for testing its private methods. */
function updatePowerShell(
    version: IPowerShellVersionDetails,
): UpdatePowerShell {
    return new UpdatePowerShell(testLogger, version);
}

/** Whether PowerShell would check for a new release to update to. */
function shouldCheckForUpdate(version: IPowerShellVersionDetails): boolean {
    // @ts-expect-error method is private.
    return updatePowerShell(version).shouldCheckForUpdate();
}

/** Assert PowerShell would check for a new release to update to. */
function assertChecksForUpdate(version: IPowerShellVersionDetails): void {
    assert(
        shouldCheckForUpdate(version),
        `Expected PowerShell v${version.version} to check for an update.`,
    );
}

/** Assert PowerShell would not check for a new release to update to. */
function assertSkipsUpdateCheck(version: IPowerShellVersionDetails): void {
    assert(
        !shouldCheckForUpdate(version),
        `Expected PowerShell v${version.version} not to check for an update.`,
    );
}

/** The release tag PowerShell would offer to update to, if any. */
function maybeGetNewRelease(
    version: IPowerShellVersionDetails,
): Promise<string | undefined> {
    // @ts-expect-error method is private.
    return updatePowerShell(version).maybeGetNewRelease();
}

/** Set `promptToUpdatePowerShell`, run the test, then restore the setting. */
async function withPromptToUpdatePowerShell(
    value: boolean,
    test: () => void,
): Promise<void> {
    const setPromptToUpdate = (v: boolean | undefined): Promise<void> =>
        changeSetting(
            "promptToUpdatePowerShell",
            v,
            vscode.ConfigurationTarget.Workspace,
            undefined,
        );

    await setPromptToUpdate(value);
    try {
        test();
    } finally {
        await setPromptToUpdate(undefined);
    }
}

describe("UpdatePowerShell feature", function () {
    let currentUpdateSetting: string | undefined;

    before(function () {
        currentUpdateSetting = process.env.POWERSHELL_UPDATECHECK;
    });

    beforeEach(function () {
        process.env.POWERSHELL_UPDATECHECK = "Default";
    });

    after(function () {
        process.env.POWERSHELL_UPDATECHECK = currentUpdateSetting;
    });

    describe("When it should check for an update", function () {
        /** A stable Core release, which is checked by default. */
        const stable = versionDetails(firstCore.version);

        it("Won't check if 'promptToUpdatePowerShell' is false", async function () {
            await withPromptToUpdatePowerShell(false, () => {
                assertSkipsUpdateCheck(stable);
            });
        });

        for (const { name, version } of [
            {
                name: "Windows PowerShell",
                version: versionDetails(previousMajor(firstCore).version, {
                    edition: "Desktop",
                }),
            },
            {
                name: "a development build of PowerShell",
                version: versionDetails(preview(firstCore), {
                    commit: developmentBuild(firstCore),
                    architecture: "Arm64",
                }),
            },
            {
                name: "a daily build of PowerShell",
                version: versionDetails(dailyBuild(firstCore), {
                    architecture: "Arm64",
                }),
            },
        ]) {
            it(`Won't check for ${name}`, function () {
                assertSkipsUpdateCheck(version);
            });
        }

        it("Won't check if POWERSHELL_UPDATECHECK is 'Off'", function () {
            process.env.POWERSHELL_UPDATECHECK = "Off";
            assertSkipsUpdateCheck(stable);
        });

        it("Should otherwise check to update PowerShell", function () {
            assertChecksForUpdate(stable);
        });
    });

    describe("Which version it gets", function () {
        /**
         * Ask the currently selected channel for the update it offers from
         * `localVersion`, asserting it is a stable release newer than that
         * version and returning it. No release number is pinned, so this holds
         * for every release the channel reports from now on.
         */
        const getOfferedUpdate = async (
            localVersion: string,
        ): Promise<SemVer> => {
            const tag = await maybeGetNewRelease(versionDetails(localVersion));
            assert(
                tag !== undefined,
                `Expected an update from v${localVersion}.`,
            );
            const release = new SemVer(tag);
            assert.strictEqual(
                release.prerelease.length,
                0,
                `Expected '${tag}' to be a stable release.`,
            );
            assert.strictEqual(
                release.compare(localVersion),
                1,
                `Expected '${tag}' to be newer than v${localVersion}.`,
            );
            return release;
        };

        it("Would update to LTS", async function () {
            process.env.POWERSHELL_UPDATECHECK = "LTS";
            // Only has to be older than whatever the channel offers.
            const lts = await getOfferedUpdate(firstCore.version);

            // The LTS channel answers with LTS, so its own release leaves
            // nothing newer to offer, unlike the (at least as new) stable one.
            assert.strictEqual(
                await maybeGetNewRelease(versionDetails(lts.version)),
                undefined,
            );

            process.env.POWERSHELL_UPDATECHECK = "Default";
            const stable = await getOfferedUpdate(firstCore.version);
            assert(
                lts.compare(stable) <= 0,
                `Expected LTS v${lts.version} not to be newer than stable v${stable.version}.`,
            );
        });

        it("Would update to stable", async function () {
            // Only has to be older than whatever the channel offers.
            await getOfferedUpdate(firstCore.version);
        });
    });

    describe("WinGet version detection", function () {
        /** The release whose WinGet package versions these tests parse. */
        const packaged = bumped(firstCore, "minor");

        /** The WinGet package version for `release`, which adds a revision. */
        const packageVersion = (release: SemVer): string =>
            `${release.version}.0`;

        /**
         * Assert that `detect` derives exactly `expected` from `input`, where
         * `undefined` means no version could be derived at all.
         */
        const assertDetects = <T>(
            detect: (input: T) => string | undefined,
            input: T,
            expected: string | undefined,
        ): void => {
            assert.strictEqual(detect(input), expected);
        };

        it("Strips the revision component of a WinGet version", function () {
            // The revision is optional, so it strips either form.
            for (const version of [
                packageVersion(packaged),
                packaged.version,
            ]) {
                assertDetects(toTriple, version, packaged.version);
            }
        });

        it("Parses the version from 'winget show' output", function () {
            assertDetects(
                parseWinGetShowOutput,
                [
                    "Found Microsoft PowerShell [Microsoft.PowerShell]",
                    `Version: ${packageVersion(packaged)}`,
                    "Publisher: Microsoft Corporation",
                    "Moniker: powershell",
                ].join("\n"),
                packaged.version,
            );
        });

        it("Returns undefined when 'winget show' has no version", function () {
            assertDetects(
                parseWinGetShowOutput,
                "No package found matching input criteria.",
                undefined,
            );
        });

        it("Gets the newest version from a winget-pkgs listing", function () {
            assertDetects(
                getLatestWinGetVersion,
                [
                    {
                        name: packageVersion(previousMajor(packaged)),
                        type: "dir",
                    },
                    { name: packageVersion(firstCore), type: "dir" },
                    { name: packaged.version, type: "dir" },
                    { name: "README.md", type: "file" },
                ],
                packaged.version,
            );
        });

        it("Returns undefined for a listing without versions", function () {
            assertDetects(
                getLatestWinGetVersion,
                [{ name: ".gitattributes", type: "file" }],
                undefined,
            );
        });
    });

    describe("The update prompt", function () {
        /** The button the prompt offers with the given ID and title. */
        const option = (
            id: IUpdatePromptOption["id"],
            title: string,
        ): IUpdatePromptOption => ({ id, title });

        /** The WinGet button the prompt offers, if any, for each state. */
        const installWinGet = option("winget", "Install WinGet");
        const upgradeWithWinGet = option("winget", "Upgrade with WinGet");
        const viewWinGetProgress = option(
            "winget-progress",
            "View WinGet Progress",
        );

        /**
         * The prompt offers exactly the given WinGet buttons, if any, followed
         * by the buttons every prompt offers.
         */
        const assertOptions = (
            prompt: IUpdatePrompt,
            ...winget: IUpdatePromptOption[]
        ): void => {
            assert.deepStrictEqual(prompt.options, [
                ...winget,
                option("github", "Open GitHub Release"),
                option("not-now", "Not Now"),
                option("dont-show", "Don't Show Again"),
            ]);
        };

        /** The prompt's message mentions every one of the given strings. */
        const assertMentions = (
            prompt: IUpdatePrompt,
            ...texts: string[]
        ): void => {
            for (const text of texts) {
                assert(
                    prompt.message.includes(text),
                    `Expected the prompt to mention "${text}":\n${prompt.message}`,
                );
            }
        };

        /** The prompt's message mentions none of the given strings. */
        const assertOmits = (
            prompt: IUpdatePrompt,
            ...texts: string[]
        ): void => {
            assert.deepStrictEqual(
                texts.filter((text) => prompt.message.includes(text)),
                [],
            );
        };

        /** WinGet is missing on Windows, or not considered off Windows. */
        const noWinGet: IWinGetStatus = { installed: false };

        /** The release the user has, and the one the prompt offers from it. */
        const localRelease = firstCore;
        const offeredRelease = bumped(localRelease, "minor");

        /** A WinGet release newer than the local one, but not the offer. */
        const wingetAheadOfLocal = bumped(localRelease, "patch");

        /** A WinGet release older than the local one. */
        const wingetBehindLocal = previousMajor(localRelease);

        /** Build the prompt for the local release above and the offer from it. */
        const updatePrompt = (
            isWindows: boolean,
            winget: IWinGetStatus,
        ): IUpdatePrompt =>
            buildUpdatePrompt(
                localRelease.version,
                `v${offeredRelease.version}`,
                isWindows,
                winget,
            );

        it("Does not offer WinGet where it does not exist", function () {
            const prompt = updatePrompt(false, noWinGet);
            assertOptions(prompt);
            assertOmits(prompt, "WinGet");
        });

        it("Names both versions and asks whether to upgrade", function () {
            assertMentions(
                updatePrompt(false, noWinGet),
                `PowerShell v${localRelease.version} is out-of-date`,
                `The latest version is v${offeredRelease.version}`,
                "Would you like to upgrade?",
            );
        });

        for (const state of [
            {
                name: "Offers to install WinGet on Windows without it",
                winget: noWinGet,
                buttons: [installWinGet],
                mentions: "is not installed",
            },
            {
                name: "Mentions the version WinGet would offer when missing",
                winget: { installed: false, version: offeredRelease.version },
                buttons: [installWinGet],
                mentions: `WinGet is not installed. It offers v${offeredRelease.version}`,
            },
            {
                name: "Offers to upgrade with WinGet when it has the new version",
                winget: { installed: true, version: offeredRelease.version },
                buttons: [upgradeWithWinGet],
                omits: "caught up",
            },
            {
                name: "Offers WinGet progress and notes its older version",
                // WinGet has a newer version than the local one, but not the latest.
                winget: {
                    installed: true,
                    version: wingetAheadOfLocal.version,
                },
                buttons: [upgradeWithWinGet, viewWinGetProgress],
                mentions: `WinGet currently has v${wingetAheadOfLocal.version}`,
            },
            {
                name: "Says when WinGet has not caught up yet, and offers no WinGet upgrade",
                winget: { installed: true, version: wingetBehindLocal.version },
                buttons: [viewWinGetProgress],
                mentions: "hasn't caught up yet",
            },
            {
                name: "Offers to upgrade when WinGet's version is unknown",
                winget: { installed: true },
                buttons: [upgradeWithWinGet],
            },
        ]) {
            it(state.name, function () {
                const prompt = updatePrompt(true, state.winget);
                assertOptions(prompt, ...state.buttons);
                if (state.mentions) assertMentions(prompt, state.mentions);
                if (state.omits) assertOmits(prompt, state.omits);
            });
        }
    });

    describe("WinGet detection errors", function () {
        const errorWithCode = (message: string, code: unknown): Error =>
            Object.assign(new Error(message), { code });

        it("Recognizes a missing WinGet executable", function () {
            assert(
                isWinGetMissing(errorWithCode("spawn winget ENOENT", "ENOENT")),
            );
        });

        it("Does not treat other failures as a missing WinGet", function () {
            for (const error of [
                errorWithCode("failed to open source", 1),
                new Error("unknown"),
                undefined,
            ]) {
                assert(!isWinGetMissing(error));
            }
        });
    });
});
