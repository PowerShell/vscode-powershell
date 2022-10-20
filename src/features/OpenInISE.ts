// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import ChildProcess = require("child_process");
import vscode = require("vscode");

export class OpenInISEFeature implements vscode.Disposable {
    private command: vscode.Disposable;

    constructor() {
        this.command = vscode.commands.registerCommand("PowerShell.OpenInISE", () => {
            const editor = vscode.window.activeTextEditor;
            if (editor === undefined) {
                return;
            }

            const document = editor.document;
            const uri = document.uri;
            let ISEPath = process.env.windir;

            if (process.env.PROCESSOR_ARCHITEW6432 !== undefined) {
                ISEPath += "\\Sysnative";
            } else {
                ISEPath += "\\System32";
            }

            ISEPath += "\\WindowsPowerShell\\v1.0\\powershell_ise.exe";

            ChildProcess.exec(`${ISEPath} -File "${uri.fsPath}"`).unref();
        });
    }

    public dispose() {
        this.command.dispose();
    }
}
