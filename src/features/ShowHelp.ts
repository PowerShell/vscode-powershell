// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import vscode = require("vscode");
import { NotificationType } from "vscode-languageclient";
import { LanguageClientConsumer } from "../languageClientConsumer";
import type { LanguageClient } from "vscode-languageclient/node";

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
            if (!item?.Name) {

                const editor = vscode.window.activeTextEditor;
                if (editor === undefined) {
                    return;
                }

                const selection = editor.selection;
                const doc = editor.document;
                const cwr = doc.getWordRangeAtPosition(selection.active);
                const text = doc.getText(cwr);

                const client = await LanguageClientConsumer.getLanguageClient();
                await client.sendNotification(ShowHelpNotificationType, { text });
            } else {
                const client = await LanguageClientConsumer.getLanguageClient();
                await client.sendNotification(ShowHelpNotificationType, { text: item.Name });
            }
        });
    }

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    public override onLanguageClientSet(_languageClient: LanguageClient): void {}

    public dispose(): void {
        this.command.dispose();
    }

}
