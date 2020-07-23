/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/
import * as assert from "assert";
import * as vscode from "vscode";
import { beforeEach, afterEach } from "mocha";
import { IExternalPowerShellDetails } from "../../src/features/ExternalApi";

const testExtensionId = "ms-vscode.powershell-preview";

suite("ExternalApi feature - Registration API", () => {
    test("It can register and unregister an extension", async () => {
        const sessionId: string = await vscode.commands.executeCommand("PowerShell.RegisterExternalExtension", testExtensionId);
        assert.notStrictEqual(sessionId , "");
        assert.notStrictEqual(sessionId , null);
        assert.strictEqual(
            await vscode.commands.executeCommand("PowerShell.UnregisterExternalExtension", sessionId),
            true);
    });

    test("It can register and unregister an extension with a version", async () => {
        const sessionId: string = await vscode.commands.executeCommand("PowerShell.RegisterExternalExtension", "ms-vscode.powershell-preview", "v2");
        assert.notStrictEqual(sessionId , "");
        assert.notStrictEqual(sessionId , null);
        assert.strictEqual(
            await vscode.commands.executeCommand("PowerShell.UnregisterExternalExtension", sessionId),
            true);
    });

    /*
        NEGATIVE TESTS
    */
    test("API fails if not registered", async () => {
        assert.rejects(
            async () => await vscode.commands.executeCommand("PowerShell.GetPowerShellVersionDetails"),
            "UUID provided was invalid, make sure you execute the 'PowerShell.RegisterExternalExtension' command and pass in the UUID that it returns to subsequent command executions.");
    });

    test("It can't register the same extension twice", async () => {
        const sessionId: string = await vscode.commands.executeCommand("PowerShell.RegisterExternalExtension", testExtensionId);
        try {
            assert.rejects(
                async () => await vscode.commands.executeCommand("PowerShell.RegisterExternalExtension", testExtensionId),
                `The extension '${testExtensionId}' is already registered.`);
        } finally {
            await vscode.commands.executeCommand("PowerShell.UnregisterExternalExtension", sessionId);
        }
    });

    test("It can't unregister an extension that isn't registered", async () => {
        assert.rejects(
            async () => await vscode.commands.executeCommand("PowerShell.RegisterExternalExtension", "not-real"),
            `No extension registered with session UUID: not-real`);
    });
});

suite("ExternalApi feature - Other APIs", () => {
    let sessionId: string;

    beforeEach(async () => {
        sessionId = await vscode.commands.executeCommand("PowerShell.RegisterExternalExtension", "ms-vscode.powershell-preview");
    });

    afterEach(async () => {
        await vscode.commands.executeCommand("PowerShell.UnregisterExternalExtension", sessionId);
    });

    test("It can get PowerShell version details", async () => {
        const versionDetails: IExternalPowerShellDetails = await vscode.commands.executeCommand("PowerShell.GetPowerShellVersionDetails", sessionId);

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
