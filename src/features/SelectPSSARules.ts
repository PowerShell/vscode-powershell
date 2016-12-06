/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import vscode = require("vscode");
import { IFeature } from "../feature";
import { LanguageClient, RequestType } from "vscode-languageclient";
import { ICheckboxOption, CheckboxQuickPick } from "../checkboxQuickPick";

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
                let options: ICheckboxOption[] = returnedRules.map(function (rule: IRuleInfo): ICheckboxOption {
                    return { name: rule.name, isSelected: rule.isEnabled };
                });
                (new CheckboxQuickPick(options)).show((updatedOptions) => {
                    this.languageClient.sendRequest(
                        SetPSSARulesRequest.type,
                        updatedOptions.map(function (option: ICheckboxOption): IRuleInfo {
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
