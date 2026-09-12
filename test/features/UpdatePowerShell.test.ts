// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import assert from "assert";
import * as vscode from "vscode";
import {
    buildUpdatePrompt,
    getLatestWinGetVersion,
    parseWinGetShowOutput,
    toTriple,
    UpdatePowerShell,
} from "../../src/features/UpdatePowerShell";
import type { IPowerShellVersionDetails } from "../../src/session";
import { changeSetting } from "../../src/settings";
import { testLogger } from "../utils";

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
        it("Won't check if 'promptToUpdatePowerShell' is false", async function () {
            await changeSetting(
                "promptToUpdatePowerShell",
                false,
                vscode.ConfigurationTarget.Workspace,
                undefined,
            );
            try {
                const version: IPowerShellVersionDetails = {
                    version: "7.3.0",
                    edition: "Core",
                    commit: "7.3.0",
                    architecture: "X64",
                };
                const updater = new UpdatePowerShell(testLogger, version);
                // @ts-expect-error method is private.
                assert(!updater.shouldCheckForUpdate());
            } finally {
                await changeSetting(
                    "promptToUpdatePowerShell",
                    undefined,
                    vscode.ConfigurationTarget.Workspace,
                    undefined,
                );
            }
        });

        it("Won't check for Windows PowerShell", function () {
            const version: IPowerShellVersionDetails = {
                version: "5.1.22621",
                edition: "Desktop",
                commit: "5.1.22621",
                architecture: "X64",
            };
            const updater = new UpdatePowerShell(testLogger, version);
            // @ts-expect-error method is private.
            assert(!updater.shouldCheckForUpdate());
        });

        it("Won't check for a development build of PowerShell", function () {
            const version: IPowerShellVersionDetails = {
                version: "7.3.0-preview.3",
                edition: "Core",
                commit: "7.3.0-preview.3-508-g07175ae0ff8eb7306fe0b0fc7d19bdef4fbf2d67",
                architecture: "Arm64",
            };
            const updater = new UpdatePowerShell(testLogger, version);
            // @ts-expect-error method is private.
            assert(!updater.shouldCheckForUpdate());
        });

        it("Won't check for a daily build of PowerShell", function () {
            const version: IPowerShellVersionDetails = {
                version: "7.3.0-daily20221206.1",
                edition: "Core",
                commit: "7.3.0-daily20221206.1",
                architecture: "Arm64",
            };
            const updater = new UpdatePowerShell(testLogger, version);
            // @ts-expect-error method is private.
            assert(!updater.shouldCheckForUpdate());
        });

        it("Won't check if POWERSHELL_UPDATECHECK is 'Off'", function () {
            process.env.POWERSHELL_UPDATECHECK = "Off";
            const version: IPowerShellVersionDetails = {
                version: "7.3.0",
                edition: "Core",
                commit: "7.3.0",
                architecture: "X64",
            };
            const updater = new UpdatePowerShell(testLogger, version);
            // @ts-expect-error method is private.
            assert(!updater.shouldCheckForUpdate());
        });

        it("Should otherwise check to update PowerShell", function () {
            const version: IPowerShellVersionDetails = {
                version: "7.3.0",
                edition: "Core",
                commit: "7.3.0",
                architecture: "X64",
            };
            const updater = new UpdatePowerShell(testLogger, version);
            // @ts-expect-error method is private.
            assert(updater.shouldCheckForUpdate());
        });
    });

    describe("Which version it gets", function () {
        it("Would update to LTS", async function () {
            process.env.POWERSHELL_UPDATECHECK = "LTS";
            const version: IPowerShellVersionDetails = {
                version: "7.2.0",
                edition: "Core",
                commit: "7.2.0",
                architecture: "X64",
            };
            const updater = new UpdatePowerShell(testLogger, version);
            // @ts-expect-error method is private.
            const tag: string = (await updater.maybeGetNewRelease()) ?? "";
            // NOTE: This will need to be updated each time an LTS is released.
            // Also sometimes the prior LTS is more recently updated than the latest LTS.
            assert(tag.startsWith("v7.4"));
        });

        it("Would update to stable", async function () {
            const version: IPowerShellVersionDetails = {
                version: "7.3.0",
                edition: "Core",
                commit: "7.3.0",
                architecture: "X64",
            };
            const updater = new UpdatePowerShell(testLogger, version);
            // @ts-expect-error method is private.
            const tag: string | undefined = await updater.maybeGetNewRelease();
            // NOTE: This will need to be updated each new major stable.
            // TODO: Upstream bug causes LTS releases to update the stable info.
            // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
            assert(tag?.startsWith("v7.6") || tag?.startsWith("v7.4"));
        });
    });

    describe("WinGet version detection", function () {
        it("Strips the revision component of a WinGet version", function () {
            assert.strictEqual(toTriple("7.5.3.0"), "7.5.3");
            assert.strictEqual(toTriple("7.5.3"), "7.5.3");
        });

        it("Parses the version from 'winget show' output", function () {
            assert.strictEqual(
                parseWinGetShowOutput(
                    [
                        "Found Microsoft PowerShell [Microsoft.PowerShell]",
                        "Version: 7.5.3.0",
                        "Publisher: Microsoft Corporation",
                        "Moniker: powershell",
                    ].join("\n"),
                ),
                "7.5.3",
            );
        });

        it("Returns undefined when 'winget show' has no version", function () {
            assert.strictEqual(
                parseWinGetShowOutput(
                    "No package found matching input criteria.",
                ),
                undefined,
            );
        });

        it("Gets the newest version from a winget-pkgs listing", function () {
            assert.strictEqual(
                getLatestWinGetVersion([
                    { name: "7.4.5.0", type: "dir" },
                    { name: "7.5.3.0", type: "dir" },
                    { name: "7.6.0", type: "dir" },
                    { name: "README.md", type: "file" },
                ]),
                "7.6.0",
            );
        });

        it("Returns undefined for a listing without versions", function () {
            assert.strictEqual(
                getLatestWinGetVersion([
                    { name: ".gitattributes", type: "file" },
                ]),
                undefined,
            );
        });
    });

    describe("The update prompt", function () {
        const titlesOf = (prompt: { options: { title: string }[] }): string[] =>
            prompt.options.map(({ title }) => title);

        it("Does not offer WinGet where it does not exist", function () {
            const prompt = buildUpdatePrompt("7.5.2", "v7.5.3", false, {
                installed: false,
            });
            assert.deepStrictEqual(prompt.options, [
                { id: "github", title: "Open GitHub Release" },
                { id: "not-now", title: "Not Now" },
                { id: "dont-show", title: "Don't Show Again" },
            ]);
            assert(!prompt.message.includes("WinGet"));
        });

        it("Names both versions and asks whether to upgrade", function () {
            const prompt = buildUpdatePrompt("7.5.2", "v7.5.3", false, {
                installed: false,
            });
            assert(prompt.message.includes("PowerShell v7.5.2 is out-of-date"));
            assert(prompt.message.includes("The latest version is v7.5.3"));
            assert(prompt.message.includes("Would you like to upgrade?"));
        });

        it("Offers to install WinGet on Windows without it", function () {
            const prompt = buildUpdatePrompt("7.5.2", "v7.5.3", true, {
                installed: false,
            });
            assert(titlesOf(prompt).includes("Install WinGet"));
            assert(prompt.message.includes("is not installed"));
        });

        it("Mentions the version WinGet would offer when missing", function () {
            const prompt = buildUpdatePrompt("7.5.2", "v7.5.3", true, {
                installed: false,
                version: "7.5.3",
            });
            assert(
                prompt.message.includes(
                    "WinGet is not installed. It offers v7.5.3",
                ),
            );
        });

        it("Offers to upgrade with WinGet when it has the new version", function () {
            const prompt = buildUpdatePrompt("7.5.2", "v7.5.3", true, {
                installed: true,
                version: "7.5.3",
            });
            assert(titlesOf(prompt).includes("Upgrade with WinGet"));
            assert(!titlesOf(prompt).includes("View WinGet Progress"));
            assert(!prompt.message.includes("caught up"));
        });

        it("Offers WinGet progress and notes its older version", function () {
            const prompt = buildUpdatePrompt("7.5.0", "v7.5.3", true, {
                installed: true,
                version: "7.5.1",
            });
            assert(titlesOf(prompt).includes("View WinGet Progress"));
            assert(prompt.message.includes("WinGet currently has v7.5.1"));
        });

        it("Says when WinGet has not caught up yet", function () {
            assert(
                buildUpdatePrompt("7.5.2", "v7.5.3", true, {
                    installed: true,
                    version: "7.4.0",
                }).message.includes("hasn't caught up yet"),
            );
        });
    });
});
