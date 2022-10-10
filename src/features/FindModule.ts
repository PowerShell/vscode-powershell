// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import vscode = require("vscode");
import { RequestType } from "vscode-languageclient";
import QuickPickItem = vscode.QuickPickItem;
import { LanguageClientConsumer } from "../languageClientConsumer";

export const FindModuleRequestType =
    new RequestType<any, any, void>("powerShell/findModule");

export const InstallModuleRequestType =
    new RequestType<string, void, void>("powerShell/installModule");

export class FindModuleFeature extends LanguageClientConsumer {

    private command: vscode.Disposable;
    private cancelFindToken?: vscode.CancellationTokenSource;

    constructor() {
        super();
        this.command = vscode.commands.registerCommand("PowerShell.PowerShellFindModule", () => {
            // It takes a while to get the list of PowerShell modules, display some UI to let user know
            this.cancelFindToken = new vscode.CancellationTokenSource();
            vscode.window
                .showQuickPick(
                ["Cancel"],
                { placeHolder: "Please wait, retrieving list of PowerShell modules. This can take some time..." },
                this.cancelFindToken.token)
                .then((response) => {
                    if (response === "Cancel") { this.clearCancelFindToken(); }
                });

            // Cancel the loading prompt after 60 seconds
            setTimeout(() => {
                if (this.cancelFindToken) {
                    this.clearCancelFindToken();

                    vscode.window.showErrorMessage(
                        "The online source for PowerShell modules is not responding. " +
                        "Cancelling Find/Install PowerShell command.");
                }
            }, 60000);

            this.pickPowerShellModule().then((moduleName) => {
                if (moduleName) {
                    // vscode.window.setStatusBarMessage("Installing PowerShell Module " + moduleName, 1500);
                    this.languageClient.sendRequest(InstallModuleRequestType, moduleName);
                }
            });
        });
    }

    public dispose() {
        this.command.dispose();
    }

    private pickPowerShellModule(): Thenable<string> {
        return this.languageClient.sendRequest(FindModuleRequestType, undefined).then((modules) => {
            const items: QuickPickItem[] = [];

            // We've got the modules info, let's cancel the timeout unless it's already been cancelled
            if (this.cancelFindToken) {
                this.clearCancelFindToken();
            } else {
                // Already timed out, would be weird to display modules after we said it timed out.
                return Promise.resolve("");
            }

            for (const item in modules) {
                if (modules.hasOwnProperty(item)) {
                    items.push({ label: modules[item].name, description: modules[item].description });
                }
            }

            if (items.length === 0) {
                return Promise.reject("No PowerShell modules were found.");
            }

            const options: vscode.QuickPickOptions = {
                placeHolder: "Select a PowerShell module to install",
                matchOnDescription: true,
                matchOnDetail: true,
            };

            return vscode.window.showQuickPick(items, options).then((item) => {
                return item ? item.label : "";
            });
        });
    }

    private clearCancelFindToken() {
        this.cancelFindToken?.dispose();
        this.cancelFindToken = undefined;
    }
}
