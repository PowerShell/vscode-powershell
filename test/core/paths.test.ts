// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import assert from "assert";
import * as vscode from "vscode";
import { IPowerShellExtensionClient } from "../../src/features/ExternalApi";
import utils = require("../utils");
import { checkIfDirectoryExists, checkIfFileExists, ShellIntegrationScript } from "../../src/utils";

describe("Path assumptions", function () {
    let globalStorageUri: vscode.Uri;
    let logUri: vscode.Uri;
    before(async () => {
        const extension: IPowerShellExtensionClient = await utils.ensureEditorServicesIsConnected();
        globalStorageUri = extension.getStorageUri();
        logUri = extension.getLogUri();
    });

    it("Creates the session folder at the correct path", async function () {
        assert(await checkIfDirectoryExists(vscode.Uri.joinPath(globalStorageUri, "sessions")));
    });

    it("Creates the log folder at the correct path", async function () {
        assert(await checkIfDirectoryExists(logUri));
    });

    it("Finds the Terminal Shell Integration Script", async function () {
        // If VS Code changes the location of the script, we need to know ASAP (as it's not a public API).
        assert(await checkIfFileExists(ShellIntegrationScript));
    });
});
