/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import vscode = require("vscode");
import { LanguageClient, NotificationType } from "vscode-languageclient";
import { IFeature } from "../feature";
import { Logger } from "../logging";
import { LanguageClientConsumer } from "../languageClientConsumer";

export const ShowHelpNotificationType =
    new NotificationType<any, void>("powerShell/showHelp");

export class ShowHelpFeature extends LanguageClientConsumer implements IFeature {
    private command: vscode.Disposable;
    private deprecatedCommand: vscode.Disposable;

    constructor(private log: Logger) {
        super();
        this.command = vscode.commands.registerCommand("PowerShell.ShowHelp", (item?) => {
            if (!item || !item.Name) {

                const editor = vscode.window.activeTextEditor;

                const selection = editor.selection;
                const doc = editor.document;
                const cwr = doc.getWordRangeAtPosition(selection.active);
                const text = doc.getText(cwr);

                this.languageClient.sendNotification(ShowHelpNotificationType, { text });
            } else {
                this.languageClient.sendNotification(ShowHelpNotificationType, { text: item.Name } );
            }
        });
    }

    public dispose() {
        this.command.dispose();
        this.deprecatedCommand.dispose();
    }

    public setLanguageClient(languageclient: LanguageClient) {
        this.languageClient = languageclient;
    }
}
