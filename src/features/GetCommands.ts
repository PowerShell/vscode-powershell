/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as vscode from "vscode";
import { LanguageClient, RequestType } from "vscode-languageclient";
import { IFeature } from "../feature";

export const GetCommandsRequestType = new RequestType<string, any, void, void>("powershell/expandAlias");

export class GetCommandsFeature implements IFeature {
    private command: vscode.Disposable;
    private languageClient: LanguageClient;

    constructor() {
        this.command = vscode.commands.registerCommand("PowerShell.GetCommands", () => {
            if (this.languageClient === undefined) {
                // We be screwed
                return;
            }
            vscode.window.showInformationMessage("Before calling PSES");
            this.languageClient.sendRequest(GetCommandsRequestType, "gci").then((result) => {
                vscode.window.showInformationMessage("In the Promise from calling PSES")
                vscode.window.showInformationMessage(result);
            });
            vscode.window.showInformationMessage("After calling PSES");
        });
    }

    public dispose() {
        this.command.dispose();
    }

    public setLanguageClient(languageclient: LanguageClient) {
        this.languageClient = languageclient;
    }
}
