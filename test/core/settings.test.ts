// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import * as assert from "assert";
import * as vscode from "vscode";
import { Settings, getSettings, getEffectiveConfigurationTarget, changeSetting, CommentType } from "../../src/settings";

describe("Settings E2E", function () {
    this.slow(800);
    it("Loads without error", function () {
        assert.doesNotThrow(getSettings);
    });

    it("Loads the correct defaults", function () {
        const testSettings = new Settings();
        const actualSettings = getSettings();
        assert.deepStrictEqual(actualSettings, testSettings);
    });

    it("Updates correctly", async function () {
        await changeSetting("helpCompletion", CommentType.LineComment, false, undefined);
        assert.strictEqual(getSettings().helpCompletion, CommentType.LineComment);
    });

    it("Gets the effective configuration target", async function () {
        await changeSetting("helpCompletion", CommentType.LineComment, false, undefined);
        let target = getEffectiveConfigurationTarget("helpCompletion");
        assert.strictEqual(target, vscode.ConfigurationTarget.Workspace);

        await changeSetting("helpCompletion", undefined, false, undefined);
        target = getEffectiveConfigurationTarget("helpCompletion");
        assert.strictEqual(target, undefined);
    });
});
