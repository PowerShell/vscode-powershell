/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import vscode = require("vscode");
import { LanguageClient, RequestType } from "vscode-languageclient";
import { ICheckboxQuickPickItem, showCheckboxQuickPick } from "../controls/checkboxQuickPick";
import { IFeature } from "../feature";
import { Logger } from "../logging";

export const GetPSSARulesRequestType = new RequestType<any, any, void, void>("powerShell/getPSSARules");
export const SetPSSARulesRequestType = new RequestType<any, any, void, void>("powerShell/setPSSARules");

class RuleInfo {
    public name: string;
    public isEnabled: boolean;
}

export class SelectPSSARulesFeature implements IFeature {

    private command: vscode.Disposable;
    private languageClient: LanguageClient;

    constructor(private log: Logger) {
        this.command = vscode.commands.registerCommand("PowerShell.SelectPSSARules", () => {
            if (this.languageClient === undefined) {
                this.log.writeAndShowError(`<${SelectPSSARulesFeature.name}>: ` +
                    "Unable to instantiate; language client undefined.");
                return;
            }

            this.languageClient.sendRequest(GetPSSARulesRequestType, null).then((returnedRules) => {
                if (returnedRules == null) {
                    vscode.window.showWarningMessage(
                        "PowerShell extension uses PSScriptAnalyzer settings file - Cannot update rules.");
                    return;
                }

                const options: ICheckboxQuickPickItem[] =
                    returnedRules.map((rule: RuleInfo): ICheckboxQuickPickItem => {
                        return { label: rule.name, isSelected: rule.isEnabled };
                });

                showCheckboxQuickPick(options)
                    .then((updatedOptions: ICheckboxQuickPickItem[]) => {
                        if (updatedOptions === undefined) {
                            return;
                        }

                        this.languageClient.sendRequest(
                            SetPSSARulesRequestType,
                            {
                                filepath: vscode.window.activeTextEditor.document.uri.toString(),
                                ruleInfos: updatedOptions.map((option: ICheckboxQuickPickItem): RuleInfo => {
                                    return { name: option.label, isEnabled: option.isSelected };
                                }),
                            });
                    });
            });
        });
    }

    public dispose(): void {
        this.command.dispose();
    }

    public setLanguageClient(languageclient: LanguageClient): void {
        this.languageClient = languageclient;
    }
}
