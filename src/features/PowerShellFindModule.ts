/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import vscode = require('vscode');
import Window = vscode.window;
import { IFeature } from '../feature';
import QuickPickItem = vscode.QuickPickItem;
import { LanguageClient, RequestType, NotificationType } from 'vscode-languageclient';

export namespace FindModuleRequest {
    export const type: RequestType<any, any, void> = { get method() { return 'powerShell/findModule'; } };
}

export namespace InstallModuleRequest {
    export const type: RequestType<string, void, void> = { get method() { return 'powerShell/installModule'; } };
}

export class FindModuleFeature implements IFeature {

    private command: vscode.Disposable;
    private languageClient: LanguageClient;

    constructor() {
        this.command = vscode.commands.registerCommand('PowerShell.PowerShellFindModule', () => {
            var items: QuickPickItem[] = [];

            vscode.window.setStatusBarMessage(this.getCurrentTime() + " Initializing...");
            this.languageClient.sendRequest(FindModuleRequest.type, null).then((modules) => {
                for(var item in modules) {
                    items.push({ label: modules[item].name, description: modules[item].description });
                };

                vscode.window.setStatusBarMessage("");
                Window.showQuickPick(items,{placeHolder: "Results: (" + modules.length + ")"}).then((selection) => {
                    if (!selection) { return; }
                    switch (selection.label) {
                        default :
                            var moduleName = selection.label;
                            //vscode.window.setStatusBarMessage("Installing PowerShell Module " + moduleName, 1500);
                            this.languageClient.sendRequest(InstallModuleRequest.type, moduleName);
                        }
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

    private getCurrentTime() {

        var timeNow = new Date();
        var hours   = timeNow.getHours();
        var minutes = timeNow.getMinutes();
        var seconds = timeNow.getSeconds();

        var timeString = "" + ((hours > 12) ? hours - 12 : hours);
        timeString  += ((minutes < 10) ? ":0" : ":") + minutes;
        timeString  += ((seconds < 10) ? ":0" : ":") + seconds;
        timeString  += (hours >= 12) ? " PM" : " AM";

        return timeString;
    }
}