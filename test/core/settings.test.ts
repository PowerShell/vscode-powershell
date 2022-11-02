// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import * as assert from "assert";
import * as vscode from "vscode";
import { CommentType, getSettings, changeSetting, getEffectiveConfigurationTarget } from "../../src/settings";

describe("Settings module", function () {
    it("Loads without error", function () {
        assert.doesNotThrow(getSettings);
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
