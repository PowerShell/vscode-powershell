// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import * as assert from "assert";
import * as vscode from "vscode";
import Settings = require("../../src/settings");

describe("Settings module", function () {
    it("Loads without error", function () {
        assert.doesNotThrow(Settings.load);
    });

    it("Updates correctly with 'then' syntax", async function () {
        Settings.change("helpCompletion", "BlockComment", false).then(() =>
            assert.strictEqual(Settings.load().helpCompletion, "BlockComment"));
    });

    it("Updates correctly with 'async/await' syntax", async function () {
        await Settings.change("helpCompletion", "LineComment", false);
        assert.strictEqual(Settings.load().helpCompletion, "LineComment");
    });

    describe("User-only settings", async function () {
        const psExeDetails = {
            "My PowerShell": "dummyPath",
        };

        it("Throws when updating at workspace-level", async function () {
            assert.rejects(async () => await Settings.change("powerShellAdditionalExePaths", psExeDetails, false /* workspace-level */));
        });

        it("Doesn't throw when updating at user-level", async function () {
            await Settings.change("powerShellAdditionalExePaths", psExeDetails, true /* user-level */);
            const result = Settings.load().powerShellAdditionalExePaths["My PowerShell"];
            assert.notStrictEqual(result, undefined);
            assert.strictEqual(result, psExeDetails["My PowerShell"]);
        });
    });

    it("Gets the effective configuration target", async function () {
        await Settings.change("helpCompletion", "LineComment", false);
        let target = await Settings.getEffectiveConfigurationTarget("helpCompletion");
        assert.strictEqual(target, vscode.ConfigurationTarget.Workspace);

        await Settings.change("helpCompletion", undefined, false);
        target = await Settings.getEffectiveConfigurationTarget("helpCompletion");
        assert.strictEqual(target, null);
    });
});
