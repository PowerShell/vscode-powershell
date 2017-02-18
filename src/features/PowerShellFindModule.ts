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
    private cancelFindToken: vscode.CancellationTokenSource;

    constructor() {
        this.command = vscode.commands.registerCommand('PowerShell.PowerShellFindModule', () => {
            // It takes a while to get the list of PowerShell modules, display some UI to let user know
            this.cancelFindToken = new vscode.CancellationTokenSource();
            vscode.window
                .showQuickPick(
                ["Cancel"],
                { placeHolder: "Please wait, retrieving list of PowerShell modules. This can take some time..." },
                this.cancelFindToken.token)
                .then(response => { if (response === "Cancel") { this.clearCancelFindToken(); } });

            // Cancel the loading prompt after 60 seconds
            setTimeout(() => {
                if (this.cancelFindToken) {
                    this.clearCancelFindToken();

                    vscode.window.showErrorMessage(
                        "The online source for PowerShell modules is not responding. Cancelling Find/Install PowerShell command.");
                }
            }, 60000);

            this.pickPowerShellModule().then((moduleName) => {
                if (moduleName) {
                    // vscode.window.setStatusBarMessage("Installing PowerShell Module " + moduleName, 1500);
                    this.languageClient.sendRequest(InstallModuleRequest.type, moduleName);
                }
            });
        });
    }

    public setLanguageClient(languageclient: LanguageClient) {
        this.languageClient = languageclient;
    }

    public dispose() {
        this.command.dispose();
    }

    private pickPowerShellModule(): Thenable<string> {
        return this.languageClient.sendRequest(FindModuleRequest.type, null).then((modules) => {
            var items: QuickPickItem[] = [];

            // We've got the modules info, let's cancel the timeout unless it's already been cancelled
            if (this.cancelFindToken) {
                this.clearCancelFindToken();
            }
            else {
                // Already timed out, would be weird to dislay modules after we said it timed out.
                return Promise.resolve("");
            }

            for (var item in modules) {
                items.push({ label: modules[item].name, description: modules[item].description });
            };

            if (items.length === 0) {
                return Promise.reject("No PowerShell modules were found.");
            }

            let options: vscode.QuickPickOptions = {
                placeHolder: "Select a PowerShell module to install",
                matchOnDescription: true,
                matchOnDetail: true
            };

            return vscode.window.showQuickPick(items, options).then(item => {
                return item ? item.label : "";
            });
        });
    }

    private clearCancelFindToken() {
        if (this.cancelFindToken) {
            this.cancelFindToken.dispose();
            this.cancelFindToken = undefined;
        }
    }
}
