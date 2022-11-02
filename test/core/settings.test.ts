// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import * as assert from "assert";
import * as vscode from "vscode";
import Settings = require("../../src/settings");

describe("Settings module", function () {
    it("Loads without error", function () {
        assert.doesNotThrow(Settings.load);
    });

    it("Updates correctly", async function () {
        await Settings.change("helpCompletion", "LineComment", false, undefined);
        assert.strictEqual(Settings.load().helpCompletion, "LineComment");
    });

    it("Gets the effective configuration target", async function () {
        await Settings.change("helpCompletion", "LineComment", false, undefined);
        let target = Settings.getEffectiveConfigurationTarget("helpCompletion");
        assert.strictEqual(target, vscode.ConfigurationTarget.Workspace);

        await Settings.change("helpCompletion", undefined, false, undefined);
        target = Settings.getEffectiveConfigurationTarget("helpCompletion");
        assert.strictEqual(target, undefined);
    });
});
