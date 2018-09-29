/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import vscode = require("vscode");
import Window = vscode.window;
import { LanguageClient, NotificationType, RequestType } from "vscode-languageclient";
import { IFeature } from "../feature";
import { Logger } from "../logging";

export const ExpandAliasRequestType = new RequestType<string, any, void, void>("powerShell/expandAlias");

export class ExpandAliasFeature implements IFeature {
    private command: vscode.Disposable;
    private languageClient: LanguageClient;

    constructor(private log: Logger) {
        this.command = vscode.commands.registerCommand("PowerShell.ExpandAlias", () => {
            if (this.languageClient === undefined) {
                this.log.writeAndShowError(`<${ExpandAliasFeature.name}>: ` +
                    "Unable to instantiate; language client undefined.");
                return;
            }

            const editor = Window.activeTextEditor;
            const document = editor.document;
            const selection = editor.selection;
            const sls = selection.start;
            const sle = selection.end;

            let text;
            let range;

            if ((sls.character === sle.character) && (sls.line === sle.line)) {
                text = document.getText();
                range = new vscode.Range(0, 0, document.lineCount, text.length);
            } else {
                text = document.getText(selection);
                range = new vscode.Range(sls.line, sls.character, sle.line, sle.character);
            }

            this.languageClient.sendRequest(ExpandAliasRequestType, text).then((result) => {
                editor.edit((editBuilder) => {
                    editBuilder.replace(range, result);
                });
            });
        });
    }

    public dispose() {
        this.command.dispose();
    }

    public setLanguageClient(languageclient: LanguageClient) {
        this.languageClient = languageclient;
    }
}
