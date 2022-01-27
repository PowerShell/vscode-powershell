// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import * as assert from "assert";
import utils = require("../utils");
import { IExternalPowerShellDetails, IPowerShellExtensionClient } from "../../src/features/ExternalApi";

describe("ExternalApi feature", function () {
    describe("External extension registration", function () {
        let powerShellExtensionClient: IPowerShellExtensionClient;
        before(async function () {
            const powershellExtension = await utils.ensureExtensionIsActivated();
            powerShellExtensionClient = powershellExtension!.exports as IPowerShellExtensionClient;
        });

        it("Registers and unregisters an extension", function () {
            const sessionId: string = powerShellExtensionClient.registerExternalExtension(utils.extensionId);
            assert.notStrictEqual(sessionId, "");
            assert.notStrictEqual(sessionId, null);
            assert.strictEqual(
                powerShellExtensionClient.unregisterExternalExtension(sessionId),
                true);
        });

        it("Registers and unregisters an extension with a version", function () {
            const sessionId: string = powerShellExtensionClient.registerExternalExtension(utils.extensionId, "v2");
            assert.notStrictEqual(sessionId, "");
            assert.notStrictEqual(sessionId, null);
            assert.strictEqual(
                powerShellExtensionClient.unregisterExternalExtension(sessionId),
                true);
        });

        it("Rejects if not registered", async function () {
            assert.rejects(
                async () => await powerShellExtensionClient.getPowerShellVersionDetails(""))
        });

        it("Throws if attempting to register an extension more than once", async function () {
            const sessionId: string = powerShellExtensionClient.registerExternalExtension(utils.extensionId);
            try {
                assert.throws(
                    () => powerShellExtensionClient.registerExternalExtension(utils.extensionId),
                    {
                        message: `The extension '${utils.extensionId}' is already registered.`
                    });
            } finally {
                powerShellExtensionClient.unregisterExternalExtension(sessionId);
            }
        });

        it("Throws when unregistering an extension that isn't registered", async function () {
            assert.throws(
                () => powerShellExtensionClient.unregisterExternalExtension("not-real"),
                {
                    message: `No extension registered with session UUID: not-real`
                });
        });
    });

    describe("PowerShell version details", () => {
        let sessionId: string;
        let powerShellExtensionClient: IPowerShellExtensionClient;

        before(async function () {
            const powershellExtension = await utils.ensureExtensionIsActivated();
            powerShellExtensionClient = powershellExtension!.exports as IPowerShellExtensionClient;
            sessionId = powerShellExtensionClient.registerExternalExtension(utils.extensionId);
        });

        after(function () { powerShellExtensionClient.unregisterExternalExtension(sessionId); });

        it("Gets non-empty version details from the PowerShell Editor Services", async function () {
            const versionDetails: IExternalPowerShellDetails = await powerShellExtensionClient.getPowerShellVersionDetails(sessionId);

            assert.notStrictEqual(versionDetails.architecture, "");
            assert.notStrictEqual(versionDetails.architecture, null);

            assert.notStrictEqual(versionDetails.displayName, "");
            assert.notStrictEqual(versionDetails.displayName, null);

            assert.notStrictEqual(versionDetails.exePath, "");
            assert.notStrictEqual(versionDetails.exePath, null);

            assert.notStrictEqual(versionDetails.version, "");
            assert.notStrictEqual(versionDetails.version, null);
        });
    });
});
