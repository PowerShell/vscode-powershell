/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as assert from "assert";
import Settings = require("../src/settings");

suite("Settings module", () => {
    test("Settings load without error", () => {
        assert.doesNotThrow(Settings.load);
    });

    test("Settings update correctly", async () => {
        // then syntax
        Settings.change("powerShellExePath", "dummypath1", false).then(() =>
            assert.strictEqual(Settings.load().powerShellExePath, "dummypath1"));

        // async/await syntax
        await Settings.change("powerShellExePath", "dummypath2", false);
        assert.strictEqual(Settings.load().powerShellExePath, "dummypath2");
    });
});
