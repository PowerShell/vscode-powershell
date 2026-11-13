// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import assert from "assert";
import Sinon from "sinon";
import * as vscode from "vscode";
import { UpdatePowerShell } from "../../src/features/UpdatePowerShell";
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
        for (const [channel, tag] of [
            ["latest", "v7.8.0"],
            ["preview", "v7.9.0-preview.1"],
            ["lts", "v7.4.0"],
        ] as const) {
            it(`Would update to ${channel}`, async function () {
                await changeSetting(
                    "updateChannel",
                    channel,
                    vscode.ConfigurationTarget.Workspace,
                    undefined,
                );
                const fetchStub = Sinon.stub(globalThis, "fetch").resolves({
                    ok: true,
                    json: async () => ({
                        StableReleaseTag: "v7.8.0",
                        PreviewReleaseTag: "v7.9.0-preview.1",
                        LTSReleaseTag: "v7.4.0",
                    }),
                } as Response);
                try {
                    const version: IPowerShellVersionDetails = {
                        version: "7.3.0",
                        edition: "Core",
                        commit: "7.3.0",
                        architecture: "X64",
                    };
                    const updater = new UpdatePowerShell(testLogger, version);
                    // @ts-expect-error method is private.
                    const foundTag: string | undefined =
                        await updater.maybeGetNewRelease();
                    assert.strictEqual(foundTag, tag);
                    assert(
                        fetchStub.calledOnceWith(
                            "https://raw.githubusercontent.com/PowerShell/PowerShell/refs/heads/master/tools/metadata.json",
                        ),
                    );
                } finally {
                    fetchStub.restore();
                    await changeSetting(
                        "updateChannel",
                        undefined,
                        vscode.ConfigurationTarget.Workspace,
                        undefined,
                    );
                }
            });
        }
    });
});
