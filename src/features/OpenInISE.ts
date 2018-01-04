/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import ChildProcess = require("child_process");
import vscode = require("vscode");
import { IFeature, LanguageClient } from "../feature";

export class OpenInISEFeature implements IFeature {
    private command: vscode.Disposable;

    constructor() {
        this.command = vscode.commands.registerCommand("PowerShell.OpenInISE", () => {

            const editor = vscode.window.activeTextEditor;
            const document = editor.document;
            const uri = document.uri;

            let ISEPath = process.env.windir;

            if (process.env.hasOwnProperty("PROCESSOR_ARCHITEW6432")) {
                ISEPath += "\\Sysnative";
            } else {
                ISEPath += "\\System32";
            }

            ISEPath += "\\WindowsPowerShell\\v1.0\\powershell_ise.exe";

            ChildProcess.exec(ISEPath + ' -File "' + uri.fsPath + '"').unref();
        });
    }

    public dispose() {
        this.command.dispose();
    }

    public setLanguageClient(languageClient: LanguageClient) {
        // Not needed for this feature.
    }
}
