/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as assert from "assert";
import Settings = require("../src/settings");

suite("Settings module", () => {
    test("Settings load without error", () => {
        assert.doesNotThrow(Settings.load);
    });

    // TODO: Remove this test when PSReadLine is in stable
    test("PSReadLine featureFlag set correctly", () => {
        const settings: Settings.ISettings = Settings.load();
        if (process.platform === "win32") {
            assert.deepEqual(settings.developer.featureFlags, ["PSReadLine"]);
        } else {
            assert.deepEqual(settings.developer.featureFlags, []);
        }
    });

    test("Settings update correctly", async () => {
        // then syntax
        Settings.change("helpCompletion", "BlockComment", false).then(() =>
            assert.strictEqual(Settings.load().helpCompletion, "BlockComment"));

        // async/await syntax
        await Settings.change("helpCompletion", "LineComment", false);
        assert.strictEqual(Settings.load().helpCompletion, "LineComment");
    });

    test("Settings that can only be user settings update correctly", async () => {
        // set to false means it's set as a workspace-level setting so this should throw.
        assert.rejects(async () => await Settings.change("powerShellExePath", "dummyPath", false));

        // set to true means it's a user-level setting so this should not throw.
        await Settings.change("powerShellExePath", "dummyPath", true);
        assert.strictEqual(Settings.load().powerShellExePath, "dummyPath");
    });
});
