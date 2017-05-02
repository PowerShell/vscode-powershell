/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import vscode = require("vscode");
import { IFeature } from "../feature";
import { LanguageClient, RequestType } from "vscode-languageclient";
import { CheckboxQuickPickItem, showCheckboxQuickPick } from "../controls/checkboxQuickPick";

export namespace GetPSSARulesRequest {
    export const type = new RequestType<any, any, void, void>("powerShell/getPSSARules");
}

export namespace SetPSSARulesRequest {
    export const type = new RequestType<any, any, void, void>("powerShell/setPSSARules");
}

class RuleInfo {
    name: string;
    isEnabled: boolean;
}

export class SelectPSSARulesFeature implements IFeature {

    private command: vscode.Disposable;
    private languageClient: LanguageClient;

    constructor() {
        this.command = vscode.commands.registerCommand("PowerShell.SelectPSSARules", () => {
            if (this.languageClient === undefined) {
                return;
            }

            this.languageClient.sendRequest(GetPSSARulesRequest.type, null).then((returnedRules) => {
                if (returnedRules == null) {
                    vscode.window.showWarningMessage(
                        "PowerShell extension uses PSScriptAnalyzer settings file - Cannot update rules.");
                    return;
                }
                let options: CheckboxQuickPickItem[] = returnedRules.map(function (rule: RuleInfo): CheckboxQuickPickItem {
                    return { label: rule.name, isSelected: rule.isEnabled };
                });

                showCheckboxQuickPick(options)
                    .then((updatedOptions: CheckboxQuickPickItem[]) => {
                        if (updatedOptions === undefined) {
                            return;
                        }
                        this.languageClient.sendRequest(
                            SetPSSARulesRequest.type,
                            {
                                filepath: vscode.window.activeTextEditor.document.uri.fsPath,
                                ruleInfos: updatedOptions.map(
                                    function (option: CheckboxQuickPickItem): RuleInfo {
                                        return { name: option.label, isEnabled: option.isSelected };
                                    })
                            });
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
