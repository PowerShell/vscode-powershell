// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import * as assert from "assert";
import * as vscode from "vscode";
import * as settings from "../../src/settings";

describe("Settings module", function () {
    it("Loads without error", function () {
        assert.doesNotThrow(settings.getSettings);
    });

    it("Loads the correct defaults", function () {
        const testSettings = new settings.Settings();
        testSettings.enableProfileLoading = false;
        testSettings.powerShellAdditionalExePaths = { "Some PowerShell": "somePath" };
        const actualSettings = settings.getSettings();
        assert.deepStrictEqual(actualSettings, testSettings);
    });


    it("Updates correctly", async function () {
        await settings.changeSetting("helpCompletion", settings.CommentType.LineComment, false, undefined);
        assert.strictEqual(settings.getSettings().helpCompletion, settings.CommentType.LineComment);
    });

    it("Gets the effective configuration target", async function () {
        await settings.changeSetting("helpCompletion", settings.CommentType.LineComment, false, undefined);
        let target = settings.getEffectiveConfigurationTarget("helpCompletion");
        assert.strictEqual(target, vscode.ConfigurationTarget.Workspace);

        await settings.changeSetting("helpCompletion", undefined, false, undefined);
        target = settings.getEffectiveConfigurationTarget("helpCompletion");
        assert.strictEqual(target, undefined);
    });
});
