/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/
import * as assert from "assert";
import * as vscode from "vscode";
import { ISECompatibilityFeature } from "../../src/features/ISECompatibility";

suite("ISECompatibility feature", () => {
    test("It sets ISE Settings", async () => {
        await vscode.commands.executeCommand("PowerShell.EnableISEMode");
        for (const iseSetting of ISECompatibilityFeature.settings) {
            const currently = vscode.workspace.getConfiguration(iseSetting.path).get(iseSetting.name);
            assert.equal(currently, iseSetting.value);
        }
    });
    test("It unsets ISE Settings", async () => {
        await vscode.commands.executeCommand("PowerShell.DisableISEMode");
        for (const iseSetting of ISECompatibilityFeature.settings) {
            const currently = vscode.workspace.getConfiguration(iseSetting.path).get(iseSetting.name);
            assert.notEqual(currently, iseSetting.value);
        }
    });
    test("It leaves Theme after being changed after enabling ISE Mode", async () => {
        await vscode.commands.executeCommand("PowerShell.EnableISEMode");
        await vscode.workspace.getConfiguration("workbench").update("colorTheme", "Dark+", true);
        await vscode.commands.executeCommand("PowerShell.DisableISEMode");
        for (const iseSetting of ISECompatibilityFeature.settings) {
            const currently = vscode.workspace.getConfiguration(iseSetting.path).get(iseSetting.name);
            assert.notEqual(currently, iseSetting.value);
        }
        assert.equal(vscode.workspace.getConfiguration("workbench").get("colorTheme"), "Dark+");
    });
});
