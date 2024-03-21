// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import vscode = require("vscode");
import { RequestType } from "vscode-languageclient";
import { LanguageClientConsumer } from "../languageClientConsumer";
import type { LanguageClient } from "vscode-languageclient/node";

// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface IExpandAliasRequestArguments {
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface IExpandAliasRequestResponse {
    text: string
}

export const ExpandAliasRequestType = new RequestType<IExpandAliasRequestArguments, IExpandAliasRequestResponse, void>("powerShell/expandAlias");

export class ExpandAliasFeature extends LanguageClientConsumer {
    private command: vscode.Disposable;

    constructor() {
        super();
        this.command = vscode.commands.registerCommand("PowerShell.ExpandAlias", async () => {
            const editor = vscode.window.activeTextEditor;
            if (editor === undefined) {
                return;
            }

            const document = editor.document;
            const selection = editor.selection;
            const sls = selection.start;
            const sle = selection.end;

            let text: string;
            let range: vscode.Range | vscode.Position;

            if ((sls.character === sle.character) && (sls.line === sle.line)) {
                text = document.getText();
                range = new vscode.Range(0, 0, document.lineCount, text.length);
            } else {
                text = document.getText(selection);
                range = new vscode.Range(sls.line, sls.character, sle.line, sle.character);
            }

            const client = await LanguageClientConsumer.getLanguageClient();
            const result = await client.sendRequest(ExpandAliasRequestType, { text });
            await editor.edit((editBuilder) => {
                editBuilder.replace(range, result.text);
            });
        });
    }

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    public override onLanguageClientSet(_languageClient: LanguageClient): void {}

    public dispose(): void {
        this.command.dispose();
    }
}
