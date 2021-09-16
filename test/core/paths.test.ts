// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import * as assert from "assert";
import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { before } from "mocha";

// This lets us test the rest of our path assumptions against the baseline of
// this test file existing at `<root>/out/test/core/paths.test.ts`.
const rootPath = path.resolve(__dirname, "../../../")
// tslint:disable-next-line: no-var-requires
const packageJSON: any = require(path.resolve(rootPath, "package.json"));
const extensionId = `${packageJSON.publisher}.${packageJSON.name}`;

suite("Path assumptions", () => {
    before(async () => {
        const extension = vscode.extensions.getExtension(extensionId);
        if (!extension.isActive) { await extension.activate(); }
    });

    test("The examples folder can be opened (and exists)", async () => {
        assert(await vscode.commands.executeCommand("PowerShell.OpenExamplesFolder"));
    });

    test("The session folder is created in the right place", async () => {
        assert(fs.existsSync(path.resolve(rootPath, "sessions")));
    });

    test("The logs folder is created in the right place", async () => {
        assert(fs.existsSync(path.resolve(rootPath, "logs")));
    });
});
