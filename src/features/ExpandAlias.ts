/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import vscode = require('vscode');
import Window = vscode.window;
import { IFeature } from '../feature';
import { LanguageClient, RequestType, NotificationType } from 'vscode-languageclient';

export namespace ExpandAliasRequest {
    export const type: RequestType<string, any, void> = { get method() { return 'powerShell/expandAlias'; } };
}

export class ExpandAliasFeature implements IFeature {
    private command: vscode.Disposable;
    private languageClient: LanguageClient;

    constructor() {
        this.command = vscode.commands.registerCommand('PowerShell.ExpandAlias', () => {
            if (this.languageClient === undefined) {
                // TODO: Log error message
                return;
            }

            var editor = Window.activeTextEditor;
            var document = editor.document;
            var selection = editor.selection;
            var text, range;

            var sls = selection.start;
            var sle = selection.end;

            if (
                (sls.character === sle.character) &&
                (sls.line === sle.line)
            ) {
                text = document.getText();
                range = new vscode.Range(0, 0, document.lineCount, text.length);
            } else {
                text = document.getText(selection);
                range = new vscode.Range(sls.line, sls.character, sle.line, sle.character);
            }

            this.languageClient.sendRequest(ExpandAliasRequest.type, text).then((result) => {
                editor.edit((editBuilder) => {
                    editBuilder.replace(range, result);
                });
            });
        });
    }

    public setLanguageClient(languageclient: LanguageClient) {
        this.languageClient = languageclient;
    }

    public dispose() {
        this.command.dispose();
    }
}