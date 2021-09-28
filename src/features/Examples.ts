// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import path = require("path");
import utils = require("../utils")
import vscode = require("vscode");

export class ExamplesFeature implements vscode.Disposable {
    private command: vscode.Disposable;
    private examplesPath: vscode.Uri;

    constructor() {
        this.examplesPath = vscode.Uri.file(path.resolve(__dirname, "../examples"));
        this.command = vscode.commands.registerCommand("PowerShell.OpenExamplesFolder", () => {
            vscode.commands.executeCommand("vscode.openFolder", this.examplesPath, true);
            // Return existence of the path for testing. The `vscode.openFolder`
            // command should do this, but doesn't (yet).
            return utils.fileExists(this.examplesPath);
        });
    }

    public dispose() {
        this.command.dispose();
    }
}
