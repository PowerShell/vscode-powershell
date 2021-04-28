// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import path = require("path");
import vscode = require("vscode");

export class ExamplesFeature implements vscode.Disposable {
    private command: vscode.Disposable;
    private examplesPath: string;

    constructor() {
        this.examplesPath = path.resolve(__dirname, "../../../examples");
        this.command = vscode.commands.registerCommand("PowerShell.OpenExamplesFolder", () => {
            vscode.commands.executeCommand(
                "vscode.openFolder",
                vscode.Uri.file(this.examplesPath),
                true);
        });
    }

    public dispose() {
        this.command.dispose();
    }
}
