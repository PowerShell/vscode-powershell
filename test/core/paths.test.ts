// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import * as assert from "assert";
import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { before } from "mocha";
import utils = require("../utils");

suite("Path assumptions", () => {
    before(async () => { await utils.ensureExtensionIsActivated(); });

    test("The examples folder can be opened (and exists)", async () => {
        assert(await vscode.commands.executeCommand("PowerShell.OpenExamplesFolder"));
    });

    test("The session folder is created in the right place", async () => {
        assert(fs.existsSync(path.resolve(utils.rootPath, "sessions")));
    });

    test("The logs folder is created in the right place", async () => {
        assert(fs.existsSync(path.resolve(utils.rootPath, "logs")));
    });
});
