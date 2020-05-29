/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as assert from "assert";
import { IPowerShellExeDetails } from "../src/platform";
import Settings = require("../src/settings");

suite("Settings module", () => {
    test("Settings load without error", () => {
        assert.doesNotThrow(Settings.load);
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
        const psExeDetails = [{
            versionName: "My PowerShell",
            exePath: "dummyPath",
        }];

        assert.rejects(async () => await Settings.change("powerShellAdditionalExePaths", psExeDetails, false));

        // set to true means it's a user-level setting so this should not throw.
        await Settings.change("powerShellAdditionalExePaths", psExeDetails, true);
        assert.strictEqual(Settings.load().powerShellAdditionalExePaths[0].versionName, psExeDetails[0].versionName);
    });
});
