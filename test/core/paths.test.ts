// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import * as assert from "assert";
import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import utils = require("../utils");

describe("Path assumptions", function() {
    before(utils.ensureExtensionIsActivated);

    // TODO: This is skipped because it intereferes with other tests. Either
    // need to find a way to close the opened folder via a Code API, or find
    // another way to test this.
    it.skip("The examples folder can be opened (and exists)", async function() {
        assert(await vscode.commands.executeCommand("PowerShell.OpenExamplesFolder"));
    });

    it("The session folder is created in the right place", async function() {
        assert(fs.existsSync(path.resolve(utils.rootPath, "sessions")));
    });

    it("The logs folder is created in the right place", async function() {
        assert(fs.existsSync(path.resolve(utils.rootPath, "logs")));
    });
});
