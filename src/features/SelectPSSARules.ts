/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import vscode = require('vscode');
import { IFeature } from '../feature';
import QuickPickItem = vscode.QuickPickItem;
import { LanguageClient, RequestType, NotificationType } from 'vscode-languageclient';
const figures = require('figures');

export namespace GetPSSARulesRequest {
    export const type: RequestType<any, any, void> = { get method() { return 'powerShell/GetPSSARules'; } };
}

interface LabelToCheckboxMap {
    [Label: string]: string;
}

interface RuleInfo {
    Name: string;
    IsEnabled: boolean;
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

            const editor = vscode.window.activeTextEditor;

            var selection = editor.selection;
            var doc = editor.document;
            var cwr = doc.getWordRangeAtPosition(selection.active)
            var text = doc.getText(cwr);

            let rules: RuleInfo[] = [];
            this.languageClient.sendRequest(GetPSSARulesRequest.type, null).then((returnedRules) => {
                    for (var index = 0; index < returnedRules.length; index++) {
                        var element = returnedRules[index];
                        rules.push({Name : element.name, IsEnabled : element.isEnabled})
                    }

                    this.GetSelections(rules);
                });
        });
    }

    private GetSelections(rules: RuleInfo[])
    {
            vscode.window.showQuickPick(this.GetQuickPickItems(rules))
                .then((selection) =>{
                    if (!selection)
                    {
                        return;
                    }

                    if (selection.label == figures.tick)
                    {
                        return;
                    }

                    let index = this.GetRuleIndex(rules, selection.description);
                    rules[index].IsEnabled = this.ToggleState(rules[index].IsEnabled);
                    this.GetSelections(rules);
                });
    }

    private GetRuleIndex(rules: RuleInfo[], ruleName: string) : number
    {
        return rules.findIndex(rule => rule.Name == ruleName);
    }

    private GetCheckBoxOn() : string
    {
        return "[ x ]"; // this looks better than figure.checkboxOn
    }

    private GetCheckBoxOff() : string
    {
        return "[   ]"; // this looks better than figure.checkboxOff
    }

    private ConvertToState(checkBox: string) : boolean
    {
        return checkBox == this.GetCheckBoxOn();
    }

    private ToggleState(state: boolean) : boolean
    {
        return !state;
    }

    private ToggleCheckBox(checkBox: string): string
    {
        return this.ConvertToCheckBox(this.ToggleState(this.ConvertToState(checkBox)));
    }

    private ConvertToCheckBox(state: boolean): string
    {
        if (state)
        {
            return this.GetCheckBoxOn();
        }
        else
        {
            return this.GetCheckBoxOff();
        }
    }

    private GetQuickPickItems(rules: RuleInfo[]): QuickPickItem[] {
        let qItems: QuickPickItem[] = [];
        for (var index = 0; index < rules.length; index++) {
            var element = rules[index];
            qItems.push({label: this.ConvertToCheckBox(element.IsEnabled), description: element.Name })
        }
        qItems.push({label: figures.tick, description: "confirm"});
        return qItems;
    }

    public setLanguageClient(languageclient: LanguageClient) {
        this.languageClient = languageclient;
    }

    public dispose() {
        this.command.dispose();
    }
}
