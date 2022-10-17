// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import vscode = require("vscode");
import Window = vscode.window;
import { RequestType } from "vscode-languageclient";
import { LanguageClientConsumer } from "../languageClientConsumer";

export const ExpandAliasRequestType = new RequestType<any, any, void>("powerShell/expandAlias");

export class ExpandAliasFeature extends LanguageClientConsumer {
    private command: vscode.Disposable;

    constructor() {
        super();
        this.command = vscode.commands.registerCommand("PowerShell.ExpandAlias", () => {
            const editor = Window.activeTextEditor;
            if (editor === undefined) {
                return;
            }

            const document = editor.document;
            const selection = editor.selection;
            const sls = selection.start;
            const sle = selection.end;

            let text: string | any[];
            let range: vscode.Range | vscode.Position;

            if ((sls.character === sle.character) && (sls.line === sle.line)) {
                text = document.getText();
                range = new vscode.Range(0, 0, document.lineCount, text.length);
            } else {
                text = document.getText(selection);
                range = new vscode.Range(sls.line, sls.character, sle.line, sle.character);
            }

            this.languageClient?.sendRequest(ExpandAliasRequestType, { text }).then((result) => {
                editor.edit((editBuilder) => {
                    editBuilder.replace(range, result.text);
                });
            });
        });
    }

    public dispose() {
        this.command.dispose();
    }
}
