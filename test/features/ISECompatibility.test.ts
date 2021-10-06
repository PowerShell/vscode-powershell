// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import * as assert from "assert";
import * as vscode from "vscode";
import { suiteSetup, setup, suiteTeardown, teardown } from "mocha";
import { ISECompatibilityFeature } from "../../src/features/ISECompatibility";
import utils = require("../utils");

suite("ISECompatibility feature", () => {
    let currentTheme: string;

    suiteSetup(async () => {
        // Save user's current theme.
        currentTheme = await vscode.workspace.getConfiguration("workbench").get("colorTheme");
        await utils.ensureExtensionIsActivated();
    });

    setup(async () => { await vscode.commands.executeCommand("PowerShell.EnableISEMode"); });

    teardown(async () => { await vscode.commands.executeCommand("PowerShell.DisableISEMode"); });

    suiteTeardown(async () => {
        // Reset user's current theme.
        await vscode.workspace.getConfiguration("workbench").update("colorTheme", currentTheme, true);
        assert.strictEqual(vscode.workspace.getConfiguration("workbench").get("colorTheme"), currentTheme);
    });

    test("It sets ISE Settings", async () => {
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
    });

    test("It doesn't change theme when disabled if theme was manually changed after being enabled", async () => {
        assert.strictEqual(vscode.workspace.getConfiguration("workbench").get("colorTheme"), "PowerShell ISE");

        // "Manually" change theme after enabling ISE mode. Use a built-in theme but not the default.
        await vscode.workspace.getConfiguration("workbench").update("colorTheme", "Monokai", true);
        assert.strictEqual(vscode.workspace.getConfiguration("workbench").get("colorTheme"), "Monokai");

        await vscode.commands.executeCommand("PowerShell.DisableISEMode");
        for (const iseSetting of ISECompatibilityFeature.settings) {
            const currently = vscode.workspace.getConfiguration(iseSetting.path).get(iseSetting.name);
            assert.notStrictEqual(currently, iseSetting.value);
        }
        assert.strictEqual(vscode.workspace.getConfiguration("workbench").get("colorTheme"), "Monokai");
    });
});
