// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import * as assert from "assert";
import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { suiteSetup } from "mocha";
import utils = require("../utils");

suite("Path assumptions", () => {
    suiteSetup(utils.ensureExtensionIsActivated);

    // TODO: This is skipped because it intereferes with other tests. Either
    // need to find a way to close the opened folder via a Code API, or find
    // another way to test this.
    test.skip("The examples folder can be opened (and exists)", async () => {
        assert(await vscode.commands.executeCommand("PowerShell.OpenExamplesFolder"));
    });

    test("The session folder is created in the right place", async () => {
        assert(fs.existsSync(path.resolve(utils.rootPath, "sessions")));
    });

    test("The logs folder is created in the right place", async () => {
        assert(fs.existsSync(path.resolve(utils.rootPath, "logs")));
    });
});
