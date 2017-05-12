/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import vscode = require('vscode');
import { IFeature } from '../feature';
import { LanguageClient, RequestType, NotificationType } from 'vscode-languageclient';

export namespace ShowOnlineHelpRequest {
    export const type = new RequestType<string, void, void, void>('powerShell/showOnlineHelp');
}

export class ShowHelpFeature implements IFeature {

    private command: vscode.Disposable;
    private languageClient: LanguageClient;

    constructor() {
        this.command = vscode.commands.registerCommand('PowerShell.OnlineHelp', () => {
            if (this.languageClient === undefined) {
                // TODO: Log error message
                return;
            }

            const editor = vscode.window.activeTextEditor;

            var selection = editor.selection;
            var doc = editor.document;
            var cwr = doc.getWordRangeAtPosition(selection.active)
            var text = doc.getText(cwr);

            this.languageClient.sendRequest(ShowOnlineHelpRequest.type, text);
        });
    }

    public setLanguageClient(languageclient: LanguageClient) {
        this.languageClient = languageclient;
    }

    public dispose() {
        this.command.dispose();
    }
}
