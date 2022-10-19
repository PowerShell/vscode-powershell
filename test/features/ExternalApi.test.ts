// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import * as assert from "assert";
import utils = require("../utils");
import { IExternalPowerShellDetails, IPowerShellExtensionClient } from "../../src/features/ExternalApi";

describe("ExternalApi feature", function () {
    describe("External extension registration", function () {
        let extension: IPowerShellExtensionClient;
        before(async function () {
            extension = await utils.ensureExtensionIsActivated();
        });

        it("Registers and unregisters an extension", function () {
            const sessionId: string = extension.registerExternalExtension(utils.extensionId);
            assert.notStrictEqual(sessionId, "");
            assert.notStrictEqual(sessionId, null);
            assert.strictEqual(
                extension.unregisterExternalExtension(sessionId),
                true);
        });

        it("Registers and unregisters an extension with a version", function () {
            const sessionId: string = extension.registerExternalExtension(utils.extensionId, "v2");
            assert.notStrictEqual(sessionId, "");
            assert.notStrictEqual(sessionId, null);
            assert.strictEqual(
                extension.unregisterExternalExtension(sessionId),
                true);
        });

        it("Rejects if not registered", async function () {
            await assert.rejects(async () => await extension.getPowerShellVersionDetails(""));
        });

        it("Throws if attempting to register an extension more than once", function () {
            const sessionId: string = extension.registerExternalExtension(utils.extensionId);
            try {
                assert.throws(
                    () => extension.registerExternalExtension(utils.extensionId),
                    {
                        message: `The extension '${utils.extensionId}' is already registered.`
                    });
            } finally {
                extension.unregisterExternalExtension(sessionId);
            }
        });

        it("Throws when unregistering an extension that isn't registered", function () {
            assert.throws(
                () => extension.unregisterExternalExtension("not-real"),
                {
                    message: "No extension registered with session UUID: not-real"
                });
        });
    });

    describe("PowerShell version details", () => {
        let sessionId: string;
        let extension: IPowerShellExtensionClient;

        before(async function () {
            extension = await utils.ensureExtensionIsActivated();
            sessionId = extension.registerExternalExtension(utils.extensionId);
        });

        after(function () { extension.unregisterExternalExtension(sessionId); });

        it("Gets non-empty version details from the PowerShell Editor Services", async function () {
            const versionDetails: IExternalPowerShellDetails = await extension.getPowerShellVersionDetails(sessionId);

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
