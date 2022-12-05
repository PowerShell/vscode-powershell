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
                "displayVersion": "7.3",
                "edition": "Core",
                "architecture": "X64"
            };
            // @ts-expect-error testing doesn't require all arguments.
            const updater = new UpdatePowerShell(undefined, settings, testLogger, version);
            // @ts-expect-error method is private.
            assert(!updater.shouldCheckForUpdate());
        });

        it("Won't check for Windows PowerShell", function () {
            const version: IPowerShellVersionDetails = {
                // TODO: This should handle e.g. 5.1.22621.436
                "version": "5.1.0",
                "displayVersion": "5.1",
                "edition": "Desktop",
                "architecture": "X64"
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
                "displayVersion": "7.3",
                "edition": "Core",
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
                "displayVersion": "7.3",
                "edition": "Core",
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
                "displayVersion": "7.0",
                "edition": "Core",
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
                "displayVersion": "7.0",
                "edition": "Core",
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
