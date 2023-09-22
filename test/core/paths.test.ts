// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import assert from "assert";
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

    it("Creates the session folder at the correct path", async function () {
        assert(await checkIfDirectoryExists(vscode.Uri.joinPath(globalStorageUri, "sessions")));
    });

    it("Creates the log folder at the correct path", async function () {
        assert(await checkIfDirectoryExists(vscode.Uri.joinPath(globalStorageUri, "logs")));
    });
});
