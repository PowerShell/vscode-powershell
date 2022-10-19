// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import * as assert from "assert";
import * as vscode from "vscode";
import { IPowerShellExtensionClient } from "../../src/features/ExternalApi";
import utils = require("../utils");
import { checkIfDirectoryExists } from "../../src/utils";

describe("Path assumptions", function () {
    let globalStorageUri: vscode.Uri;
    before(async () => {
        const extension: IPowerShellExtensionClient = await utils.ensureEditorServicesIsConnected();
        globalStorageUri = extension.getStorageUri();
    });

    // TODO: This is skipped because it interferes with other tests. Either
    // need to find a way to close the opened folder via a Code API, or find
    // another way to test this.
    it.skip("Opens the examples folder at the expected path", async function () {
        assert(await vscode.commands.executeCommand("PowerShell.OpenExamplesFolder"));
    });

    it("Creates the session folder at the correct path", async function () {
        assert(await checkIfDirectoryExists(vscode.Uri.joinPath(globalStorageUri, "sessions")));
    });

    it("Creates the log folder at the correct path", async function () {
        assert(await checkIfDirectoryExists(vscode.Uri.joinPath(globalStorageUri, "logs")));
    });
});
