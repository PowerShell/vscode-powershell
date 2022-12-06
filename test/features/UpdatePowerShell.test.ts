// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import * as assert from "assert";
import { UpdatePowerShell } from "../../src/features/UpdatePowerShell";
import { Settings } from "../../src/settings";
import { IPowerShellVersionDetails } from "../../src/session";
import { testLogger } from "../utils";

describe("UpdatePowerShell feature", function () {
    let currentUpdateSetting: string | undefined;
    const settings = new Settings();

    before(function () {
        currentUpdateSetting = process.env.POWERSHELL_UPDATECHECK;
    });

    beforeEach(function () {
        settings.promptToUpdatePowerShell = true;
        process.env.POWERSHELL_UPDATECHECK = "Default";
    });

    after(function () {
        process.env.POWERSHELL_UPDATECHECK = currentUpdateSetting;
    });

    describe("When it should check for an update", function () {
        it("Won't check if 'promptToUpdatePowerShell' is false", function () {
            settings.promptToUpdatePowerShell = false;
            const version: IPowerShellVersionDetails = {
                "version": "7.3.0",
                "edition": "Core",
                "commit": "7.3.0",
                "architecture": "X64"
            };
            // @ts-expect-error testing doesn't require all arguments.
            const updater = new UpdatePowerShell(undefined, settings, testLogger, version);
            // @ts-expect-error method is private.
            assert(!updater.shouldCheckForUpdate());
        });

        it("Won't check for Windows PowerShell", function () {
            const version: IPowerShellVersionDetails = {
                "version": "5.1.22621",
                "edition": "Desktop",
                "commit": "5.1.22621",
                "architecture": "X64"
            };
            // @ts-expect-error testing doesn't require all arguments.
            const updater = new UpdatePowerShell(undefined, settings, testLogger, version);
            // @ts-expect-error method is private.
            assert(!updater.shouldCheckForUpdate());
        });

        it("Won't check for a development build of PowerShell", function () {
            const version: IPowerShellVersionDetails = {
                "version": "7.3.0-preview.3",
                "edition": "Core",
                "commit": "7.3.0-preview.3-508-g07175ae0ff8eb7306fe0b0fc7d19bdef4fbf2d67",
                "architecture": "Arm64"
            };
            // @ts-expect-error testing doesn't require all arguments.
            const updater = new UpdatePowerShell(undefined, settings, testLogger, version);
            // @ts-expect-error method is private.
            assert(!updater.shouldCheckForUpdate());
        });

        it("Won't check for a daily build of PowerShell", function () {
            const version: IPowerShellVersionDetails = {
                "version": "7.3.0-daily20221206.1",
                "edition": "Core",
                "commit": "7.3.0-daily20221206.1",
                "architecture": "Arm64"
            };
            // @ts-expect-error testing doesn't require all arguments.
            const updater = new UpdatePowerShell(undefined, settings, testLogger, version);
            // @ts-expect-error method is private.
            assert(!updater.shouldCheckForUpdate());
        });

        it("Won't check if POWERSHELL_UPDATECHECK is 'Off'", function () {
            process.env.POWERSHELL_UPDATECHECK = "Off";
            const version: IPowerShellVersionDetails = {
                "version": "7.3.0",
                "edition": "Core",
                "commit": "7.3.0",
                "architecture": "X64"
            };
            // @ts-expect-error testing doesn't require all arguments.
            const updater = new UpdatePowerShell(undefined, settings, testLogger, version);
            // @ts-expect-error method is private.
            assert(!updater.shouldCheckForUpdate());
        });

        it ("Should otherwise check to update PowerShell", function () {
            const version: IPowerShellVersionDetails = {
                "version": "7.3.0",
                "edition": "Core",
                "commit": "7.3.0",
                "architecture": "X64"
            };
            // @ts-expect-error testing doesn't require all arguments.
            const updater = new UpdatePowerShell(undefined, settings, testLogger, version);
            // @ts-expect-error method is private.
            assert(updater.shouldCheckForUpdate());
        });
    });

    describe("Which version it gets", function () {
        it("Would update to LTS", async function() {
            process.env.POWERSHELL_UPDATECHECK = "LTS";
            const version: IPowerShellVersionDetails = {
                "version": "7.0.0",
                "edition": "Core",
                "commit": "7.0.0",
                "architecture": "X64"
            };
            // @ts-expect-error testing doesn't require all arguments.
            const updater = new UpdatePowerShell(undefined, settings, testLogger, version);
            // @ts-expect-error method is private.
            const tag: string | undefined = await updater.maybeGetNewRelease();
            // NOTE: This will need to be updated each new major LTS.
            assert(tag?.startsWith("v7.2"));
        });

        it("Would update to stable", async function() {
            const version: IPowerShellVersionDetails = {
                "version": "7.0.0",
                "edition": "Core",
                "commit": "7.0.0",
                "architecture": "X64"
            };
            // @ts-expect-error testing doesn't require all arguments.
            const updater = new UpdatePowerShell(undefined, settings, testLogger, version);
            // @ts-expect-error method is private.
            const tag: string | undefined = await updater.maybeGetNewRelease();
            // NOTE: This will need to be updated each new major stable.
            assert(tag?.startsWith("v7.3"));
        });
    });
});
