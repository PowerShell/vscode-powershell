// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import * as assert from "assert";
import * as vscode from "vscode";
import { before } from "mocha";
import { ISECompatibilityFeature } from "../../src/features/ISECompatibility";
import utils = require("../utils");

suite("ISECompatibility feature", () => {
    before(async () => { await utils.ensureExtensionIsActivated(); } );

    test("It sets ISE Settings", async () => {
        await vscode.commands.executeCommand("PowerShell.EnableISEMode");
        for (const iseSetting of ISECompatibilityFeature.settings) {
            const currently = vscode.workspace.getConfiguration(iseSetting.path).get(iseSetting.name);
            assert.strictEqual(currently, iseSetting.value);
        }
    });

    test("It unsets ISE Settings", async () => {
        // Change state to something that DisableISEMode will change
        await vscode.workspace.getConfiguration("workbench").update("colorTheme", "PowerShell ISE", true);
        assert.strictEqual(vscode.workspace.getConfiguration("workbench").get("colorTheme"), "PowerShell ISE");

        await vscode.commands.executeCommand("PowerShell.DisableISEMode");
        for (const iseSetting of ISECompatibilityFeature.settings) {
            const currently = vscode.workspace.getConfiguration(iseSetting.path).get(iseSetting.name);
            assert.notStrictEqual(currently, iseSetting.value);
        }
    }).timeout(10000);

    test("It leaves Theme after being changed after enabling ISE Mode", async () => {
        await vscode.commands.executeCommand("PowerShell.EnableISEMode");
        assert.strictEqual(vscode.workspace.getConfiguration("workbench").get("colorTheme"), "PowerShell ISE");

        await vscode.workspace.getConfiguration("workbench").update("colorTheme", "Dark+", true);
        await vscode.commands.executeCommand("PowerShell.DisableISEMode");
        for (const iseSetting of ISECompatibilityFeature.settings) {
            const currently = vscode.workspace.getConfiguration(iseSetting.path).get(iseSetting.name);
            assert.notStrictEqual(currently, iseSetting.value);
        }
        assert.strictEqual(vscode.workspace.getConfiguration("workbench").get("colorTheme"), "Dark+");
    }).timeout(10000);
});
