// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import * as assert from "assert";
import utils = require("../utils");
import { IExternalPowerShellDetails, IPowerShellExtensionClient } from "../../src/features/ExternalApi";

describe("ExternalApi feature - Registration API", function() {
    let powerShellExtensionClient: IPowerShellExtensionClient;
    before(async function() {
        const powershellExtension = await utils.ensureExtensionIsActivated();
        powerShellExtensionClient = powershellExtension!.exports as IPowerShellExtensionClient;
    });

    it("It can register and unregister an extension", function() {
        const sessionId: string = powerShellExtensionClient.registerExternalExtension(utils.extensionId);
        assert.notStrictEqual(sessionId , "");
        assert.notStrictEqual(sessionId , null);
        assert.strictEqual(
            powerShellExtensionClient.unregisterExternalExtension(sessionId),
            true);
    });

    it("It can register and unregister an extension with a version", function() {
        const sessionId: string = powerShellExtensionClient.registerExternalExtension(utils.extensionId, "v2");
        assert.notStrictEqual(sessionId , "");
        assert.notStrictEqual(sessionId , null);
        assert.strictEqual(
            powerShellExtensionClient.unregisterExternalExtension(sessionId),
            true);
    });

    /*
        NEGATIVE TESTS
    */
    it("API fails if not registered", async function() {
        assert.rejects(
            async () => await powerShellExtensionClient.getPowerShellVersionDetails(""))
    });

    it("It can't register the same extension twice", async function() {
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

    it("It can't unregister an extension that isn't registered", async function() {
        assert.throws(
            () => powerShellExtensionClient.unregisterExternalExtension("not-real"),
            {
                message: `No extension registered with session UUID: not-real`
            });
        });
});

describe("ExternalApi feature - Other APIs", () => {
    let sessionId: string;
    let powerShellExtensionClient: IPowerShellExtensionClient;

    before(async function() {
        const powershellExtension = await utils.ensureExtensionIsActivated();
        powerShellExtensionClient = powershellExtension!.exports as IPowerShellExtensionClient;
    });

    beforeEach(function() {
        sessionId = powerShellExtensionClient.registerExternalExtension(utils.extensionId);
    });

    afterEach(function() {
        powerShellExtensionClient.unregisterExternalExtension(sessionId);
    });

    it("It can get PowerShell version details", async function() {
        const versionDetails: IExternalPowerShellDetails = await powerShellExtensionClient.getPowerShellVersionDetails(sessionId);

        assert.notStrictEqual(versionDetails.architecture, "");
        assert.notStrictEqual(versionDetails.architecture, null);

        assert.notStrictEqual(versionDetails.displayName, "");
        assert.notStrictEqual(versionDetails.displayName, null);

        assert.notStrictEqual(versionDetails.exePath, "");
        assert.notStrictEqual(versionDetails.exePath, null);

        assert.notStrictEqual(versionDetails.version, "");
        assert.notStrictEqual(versionDetails.version, null);

        // Start up can take some time...so set the timeout to 30 seconds.
    });
});
