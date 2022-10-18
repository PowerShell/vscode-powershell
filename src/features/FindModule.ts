// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

// TODO: PSES does not currently support findModule...so this whole thing is broken!

import vscode = require("vscode");
import { RequestType } from "vscode-languageclient";
import QuickPickItem = vscode.QuickPickItem;
import { LanguageClientConsumer } from "../languageClientConsumer";

// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface IFindModuleRequestArguments {
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface IModule {
    name: string,
    description: string
}

export const FindModuleRequestType =
    new RequestType<IFindModuleRequestArguments, IModule[], void>("powerShell/findModule");

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
                    this.languageClient?.sendRequest(InstallModuleRequestType, moduleName);
                }
            });
        });
    }

    public dispose() {
        this.command.dispose();
    }

    private async pickPowerShellModule(): Promise<string | undefined> {
        const modules = await this.languageClient?.sendRequest(FindModuleRequestType, undefined);
        const items: QuickPickItem[] = [];

        // We've got the modules info, let's cancel the timeout unless it's already been cancelled
        if (this.cancelFindToken) {
            this.clearCancelFindToken();
        } else {
            // Already timed out, would be weird to display modules after we said it timed out.
            return Promise.resolve("");
        }

        for (const module of modules ?? []) {
            items.push({ label: module.name, description: module.description });
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
    }

    private clearCancelFindToken() {
        this.cancelFindToken?.dispose();
        this.cancelFindToken = undefined;
    }
}
