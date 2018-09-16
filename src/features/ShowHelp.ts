/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import vscode = require("vscode");
import { LanguageClient, NotificationType, RequestType } from "vscode-languageclient";
import { IFeature } from "../feature";

export const ShowOnlineHelpRequestType =
    new RequestType<string, void, void, void>("powerShell/showOnlineHelp");
    // I think we can take out the ShowOnlineHelpRequestType... I don't think we actually send it...
export const ShowHelpRequestType =
    new RequestType<string, void, void, void>("powerShell/showHelp");
export class ShowHelpFeature implements IFeature {

    private command: vscode.Disposable;
    private deprecatedCommand: vscode.Disposable;
    // TODO: Remove Dummy command before merge.
    // Dummy command is used to test out the write-warning in PSES
    // when you send powerShell/showOnlineHelp instead of powerShell/showHelp.
    private dummyCommand: vscode.Disposable;
    private languageClient: LanguageClient;

    constructor() {
        // TODO: Remove this before merge.
        this.dummyCommand = vscode.commands.registerCommand("PowerShell.ShowOnlineHelp", () => {
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
        this.command = vscode.commands.registerCommand("PowerShell.ShowHelp", () => {
            if (this.languageClient === undefined) {
                // TODO: Log error message
                return;
            }

            const editor = vscode.window.activeTextEditor;

            const selection = editor.selection;
            const doc = editor.document;
            const cwr = doc.getWordRangeAtPosition(selection.active);
            const text = doc.getText(cwr);

            this.languageClient.sendRequest(ShowHelpRequestType, text);
        });
        this.deprecatedCommand = vscode.commands.registerCommand("PowerShell.OnlineHelp", () => {
            const warnText = "PowerShell.OnlineHelp is being deprecated. Use PowerShell.ShowHelp instead.";
            vscode.window.showWarningMessage(warnText);
            vscode.commands.executeCommand("PowerShell.ShowHelp");
        });
    }

    public dispose() {
        this.command.dispose();
        this.deprecatedCommand.dispose();
        // TODO: Remove this dummyCommand too...
        // Don't forget the one in package.json
        this.dummyCommand.dispose();
    }

    public setLanguageClient(languageclient: LanguageClient) {
        this.languageClient = languageclient;
    }
}
