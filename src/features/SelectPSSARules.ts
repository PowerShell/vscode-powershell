/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import vscode = require("vscode");
import { IFeature } from "../feature";
import { LanguageClient, RequestType } from "vscode-languageclient";
import { CheckboxQuickPickItem, showCheckboxQuickPick } from "../checkboxQuickPick";

export namespace GetPSSARulesRequest {
    export const type: RequestType<any, any, void> = { get method(): string { return "powerShell/getPSSARules"; } };
}

export namespace SetPSSARulesRequest {
    export const type: RequestType<any, any, void> = { get method(): string { return "powerShell/setPSSARules"; } };
}

class RuleInfo {
    name: string;
    isEnabled: boolean;
}

class SetPSSARulesRequestParams {
    filepath: string;
    ruleInfos: RuleInfo[];
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
                    .then(updatedOptions => {
                        let filepath: string = vscode.window.activeTextEditor.document.uri.fsPath;
                        let ruleInfos: RuleInfo[] = updatedOptions.map(
                            function (option: CheckboxQuickPickItem): RuleInfo {
                                return { name: option.label, isEnabled: option.isSelected };
                            });
                        let requestParams: SetPSSARulesRequestParams = {filepath, ruleInfos};
                        this.languageClient.sendRequest(SetPSSARulesRequest.type, requestParams);
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
