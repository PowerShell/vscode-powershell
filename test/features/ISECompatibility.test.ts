// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import * as assert from "assert";
import * as vscode from "vscode";
import { ISECompatibilityFeature } from "../../src/features/ISECompatibility";
import utils = require("../utils");

describe("ISE compatibility feature", function () {
    let currentTheme: string;

    async function enableISEMode() { await vscode.commands.executeCommand("PowerShell.EnableISEMode"); }
    async function disableISEMode() { await vscode.commands.executeCommand("PowerShell.DisableISEMode"); }

    before(async function () {
        // Save user's current theme.
        currentTheme = await vscode.workspace.getConfiguration("workbench").get("colorTheme");
        await utils.ensureEditorServicesIsConnected();
    });

    after(async function () {
        // Reset user's current theme.
        await vscode.workspace.getConfiguration("workbench").update("colorTheme", currentTheme, true);
        assert.strictEqual(vscode.workspace.getConfiguration("workbench").get("colorTheme"), currentTheme);
    });

    describe("EnableISEMode command", async function () {
        before(enableISEMode);
        after(disableISEMode);
        for (const iseSetting of ISECompatibilityFeature.settings) {
            it(`Sets ${iseSetting.name} correctly`, function () {
                const currently = vscode.workspace.getConfiguration(iseSetting.path).get(iseSetting.name);
                assert.strictEqual(currently, iseSetting.value);
            });
        }
    });

    describe("DisableISEMode command", async function () {
        before(enableISEMode);
        before(disableISEMode);
        for (const iseSetting of ISECompatibilityFeature.settings) {
            it(`Unsets ${iseSetting.name} correctly`, function () {
                const currently = vscode.workspace.getConfiguration(iseSetting.path).get(iseSetting.name);
                assert.notStrictEqual(currently, iseSetting.value);
            });
        }
    });

    describe("Color theme interactions", async function () {
        beforeEach(enableISEMode);

        function assertISESettings() {
            for (const iseSetting of ISECompatibilityFeature.settings) {
                const currently = vscode.workspace.getConfiguration(iseSetting.path).get(iseSetting.name);
                assert.notStrictEqual(currently, iseSetting.value);
            }
        }

        it("Changes the theme back from PowerShell ISE", async function () {
            // Change state to something that DisableISEMode will change
            await vscode.workspace.getConfiguration("workbench").update("colorTheme", "PowerShell ISE", true);
            assert.strictEqual(vscode.workspace.getConfiguration("workbench").get("colorTheme"), "PowerShell ISE");
            await disableISEMode();
            assertISESettings();
        });

        it("Doesn't change theme if it was manually changed", async function () {
            assert.strictEqual(vscode.workspace.getConfiguration("workbench").get("colorTheme"), "PowerShell ISE");
            // "Manually" change theme after enabling ISE mode. Use a built-in theme but not the default.
            await vscode.workspace.getConfiguration("workbench").update("colorTheme", "Monokai", true);
            assert.strictEqual(vscode.workspace.getConfiguration("workbench").get("colorTheme"), "Monokai");
            await disableISEMode();
            assertISESettings();
            assert.strictEqual(vscode.workspace.getConfiguration("workbench").get("colorTheme"), "Monokai");
        });
    });
});
