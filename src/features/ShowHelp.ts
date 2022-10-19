// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import vscode = require("vscode");
import { NotificationType } from "vscode-languageclient";
import { LanguageClientConsumer } from "../languageClientConsumer";

// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface IShowHelpNotificationArguments {
}

export const ShowHelpNotificationType =
    new NotificationType<IShowHelpNotificationArguments>("powerShell/showHelp");

export class ShowHelpFeature extends LanguageClientConsumer {
    private command: vscode.Disposable;

    constructor() {
        super();
        this.command = vscode.commands.registerCommand("PowerShell.ShowHelp", async (item?) => {
            if (!item || !item.Name) {

                const editor = vscode.window.activeTextEditor;
                if (editor === undefined) {
                    return;
                }

                const selection = editor.selection;
                const doc = editor.document;
                const cwr = doc.getWordRangeAtPosition(selection.active);
                const text = doc.getText(cwr);

                await this.languageClient?.sendNotification(ShowHelpNotificationType, { text });
            } else {
                await this.languageClient?.sendNotification(ShowHelpNotificationType, { text: item.Name });
            }
        });
    }

    public dispose() {
        this.command.dispose();
    }

}
