/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import vscode = require("vscode");
import { IFeature } from "../feature";
import { LanguageClient, RequestType } from "vscode-languageclient";
import { CheckboxQuickPickItem, CheckboxQuickPick } from "../checkboxQuickPick";

export namespace GetPSSARulesRequest {
    export const type: RequestType<any, any, void> = { get method(): string { return "powerShell/getPSSARules"; } };
}

export namespace SetPSSARulesRequest {
    export const type: RequestType<any, any, void> = { get method(): string { return "powerShell/setPSSARules"; } };
}

interface IRuleInfo {
    name: string;
    isEnabled: boolean;
}

export class SelectPSSARulesFeature implements IFeature {

    private command: vscode.Disposable;
    private languageClient: LanguageClient;

    constructor() {
        this.command = vscode.commands.registerCommand("PowerShell.SelectPSSARules", () => {
            if (this.languageClient === undefined) {
                // TODO: Log error message
                return;
            }

            this.languageClient.sendRequest(GetPSSARulesRequest.type, null).then((returnedRules) => {
                if (returnedRules == null) {
                    vscode.window.showWarningMessage(
                        "PowerShell extension uses PSScriptAnalyzer settings file - Cannot update rules.");
                    return;
                }
                let options: CheckboxQuickPickItem[] = returnedRules.map(function (rule: IRuleInfo): CheckboxQuickPickItem {
                    return { name: rule.name, isSelected: rule.isEnabled };
                });
                CheckboxQuickPick.show(options, (updatedOptions) => {
                    this.languageClient.sendRequest(
                        SetPSSARulesRequest.type,
                        updatedOptions.map(function (option: CheckboxQuickPickItem): IRuleInfo {
                            return { name: option.name, isEnabled: option.isSelected };
                        }));
                });
            });
        });
    }

    public setLanguageClient(languageclient: LanguageClient): void {
        this.languageClient = languageclient;
    }

    public dispose(): void {
        this.command.dispose();
    }
}
