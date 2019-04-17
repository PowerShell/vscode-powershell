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
});
