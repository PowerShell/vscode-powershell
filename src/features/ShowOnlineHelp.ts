/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import vscode = require("vscode");
import { LanguageClient, NotificationType, RequestType } from "vscode-languageclient";
import { IFeature } from "../feature";

export const ShowOnlineHelpRequestType =
    new RequestType<string, void, void, void>("powerShell/showOnlineHelp");

export class ShowHelpFeature implements IFeature {

    private command: vscode.Disposable;
    private languageClient: LanguageClient;

    constructor() {
        this.command = vscode.commands.registerCommand("PowerShell.OnlineHelp", () => {
            if (this.languageClient === undefined) {
                // TODO: Log error message
                return;
            }

            const editor = vscode.window.activeTextEditor;

            const selection = editor.selection;
            const doc = editor.document;
            const cwr = doc.getWordRangeAtPosition(selection.active);
            const text = doc.getText(cwr);

            this.languageClient.sendRequest(ShowOnlineHelpRequestType, text);
        });
    }

    public dispose() {
        this.command.dispose();
    }

    public setLanguageClient(languageclient: LanguageClient) {
        this.languageClient = languageclient;
    }
}
