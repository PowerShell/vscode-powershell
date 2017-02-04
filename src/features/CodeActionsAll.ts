/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import vscode = require('vscode');
import { LanguageClient, RequestType, NotificationType } from 'vscode-languageclient';
import Window = vscode.window;
import { IFeature } from '../feature';

export class CodeActionsAllFeature implements IFeature {
    private command: vscode.Disposable;
    private languageClient: LanguageClient;

    constructor() {
        this.command = vscode.commands.registerCommand('PowerShell.ApplyAllCodeActionEdits', (allEdits: any) => {
            if (allEdits != null) {
                allEdits.forEach(edit => {
                    Window.activeTextEditor.edit((editBuilder) => {
                        editBuilder.replace(
                            new vscode.Range(
                                edit.StartLineNumber - 1,
                                edit.StartColumnNumber - 1,
                                edit.EndLineNumber - 1,
                                edit.EndColumnNumber - 1),
                            edit.Text);
                    });
                });
            }
        });
    }

    public setLanguageClient(languageclient: LanguageClient) {
        this.languageClient = languageclient;
    }

    public dispose() {
        this.command.dispose();
    }
}