/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import vscode = require('vscode');
import { IFeature } from '../feature';
import QuickPickItem = vscode.QuickPickItem;
import { LanguageClient, RequestType, NotificationType } from 'vscode-languageclient';
import { Option, CheckboxQuickPick } from '../checkboxQuickPick';
const figures = require('figures');

export namespace GetPSSARulesRequest {
    export const type: RequestType<any, any, void> = { get method() { return 'powerShell/getPSSARules'; } };
}

export namespace SetPSSARulesRequest {
    export const type: RequestType<any, any, void> = { get method() { return 'powerShell/setPSSARules'; } }
}

interface RuleInfo {
    name: string;
    isEnabled: boolean;
}

export class SelectPSSARulesFeature implements IFeature {

    private command: vscode.Disposable;
    private languageClient: LanguageClient;

    constructor() {
        this.command = vscode.commands.registerCommand('PowerShell.SelectPSSARules', () => {
            if (this.languageClient === undefined) {
                // TODO: Log error message
                return;
            }

            let options: Option[] = [];
            this.languageClient.sendRequest(GetPSSARulesRequest.type, null).then((returnedRules) => {
                let options: Option[] = returnedRules.map(function (rule): Option {
                    return { name: rule.name, isSelected: rule.isEnabled };
                });
                (new CheckboxQuickPick(options)).show((updatedOptions) => {
                    this.languageClient.sendRequest(
                        SetPSSARulesRequest.type,
                        updatedOptions.map(function (option): RuleInfo {
                            return { name: option.name, isEnabled: option.isSelected };
                        }));
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
}
