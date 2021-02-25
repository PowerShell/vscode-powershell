/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/
import * as assert from "assert";
import * as vscode from "vscode";
import { before, beforeEach, afterEach } from "mocha";
import { IExternalPowerShellDetails, IPowerShellExtensionClient } from "../../src/features/ExternalApi";

const testExtensionId = "ms-vscode.powershell";

suite("ExternalApi feature - Registration API", () => {
    let powerShellExtensionClient: IPowerShellExtensionClient;
    before(async () => {
        const powershellExtension = vscode.extensions.getExtension<IPowerShellExtensionClient>(testExtensionId);
        if (!powershellExtension.isActive) {
            powerShellExtensionClient = await powershellExtension.activate();
            return;
        }
        powerShellExtensionClient = powershellExtension!.exports as IPowerShellExtensionClient;
    });

    test("It can register and unregister an extension", () => {
        const sessionId: string = powerShellExtensionClient.registerExternalExtension(testExtensionId);
        assert.notStrictEqual(sessionId , "");
        assert.notStrictEqual(sessionId , null);
        assert.strictEqual(
            powerShellExtensionClient.unregisterExternalExtension(sessionId),
            true);
    });

    test("It can register and unregister an extension with a version", () => {
        const sessionId: string = powerShellExtensionClient.registerExternalExtension(testExtensionId, "v2");
        assert.notStrictEqual(sessionId , "");
        assert.notStrictEqual(sessionId , null);
        assert.strictEqual(
            powerShellExtensionClient.unregisterExternalExtension(sessionId),
            true);
    });

    /*
        NEGATIVE TESTS
    */
    test("API fails if not registered", async () => {
        assert.rejects(
            async () => await powerShellExtensionClient.getPowerShellVersionDetails(""),
            "UUID provided was invalid, make sure you ran the 'powershellExtensionClient.registerExternalExtension(extensionId)' method and pass in the UUID that it returns to subsequent methods.");
    });

    test("It can't register the same extension twice", async () => {
        const sessionId: string = powerShellExtensionClient.registerExternalExtension(testExtensionId);
        try {
            assert.throws(
                () => powerShellExtensionClient.registerExternalExtension(testExtensionId),
                {
                    message: `The extension '${testExtensionId}' is already registered.`
                });
        } finally {
            powerShellExtensionClient.unregisterExternalExtension(sessionId);
        }
    });

    test("It can't unregister an extension that isn't registered", async () => {
        assert.throws(
            () => powerShellExtensionClient.unregisterExternalExtension("not-real"),
            {
                message: `No extension registered with session UUID: not-real`
            });
        });
});

suite("ExternalApi feature - Other APIs", () => {
    let sessionId: string;
    let powerShellExtensionClient: IPowerShellExtensionClient;

    before(async () => {
        const powershellExtension = vscode.extensions.getExtension<IPowerShellExtensionClient>(testExtensionId);
        if (!powershellExtension.isActive) {
            powerShellExtensionClient = await powershellExtension.activate();
            return;
        }
        powerShellExtensionClient = powershellExtension!.exports as IPowerShellExtensionClient;
    });

    beforeEach(() => {
        sessionId = powerShellExtensionClient.registerExternalExtension("ms-vscode.powershell");
    });

    afterEach(() => {
        powerShellExtensionClient.unregisterExternalExtension(sessionId);
    });

    test("It can get PowerShell version details", async () => {
        const versionDetails: IExternalPowerShellDetails = await powerShellExtensionClient.getPowerShellVersionDetails(sessionId);

        assert.notStrictEqual(versionDetails.architecture, "");
        assert.notStrictEqual(versionDetails.architecture, null);

        assert.notStrictEqual(versionDetails.displayName, "");
        assert.notStrictEqual(versionDetails.displayName, null);

        assert.notStrictEqual(versionDetails.exePath, "");
        assert.notStrictEqual(versionDetails.exePath, null);

        assert.notStrictEqual(versionDetails.version, "");
        assert.notStrictEqual(versionDetails.version, null);

        // Start up can take some time... so set the time out to 30s
    }).timeout(30000);
});
