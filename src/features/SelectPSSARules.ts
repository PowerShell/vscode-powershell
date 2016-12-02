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

            let rules: string[] = [];
            this.languageClient.sendRequest(GetPSSARulesRequest.type, null).then((returnedRules) => {
                    returnedRules.forEach(item => rules.push(item))
                    let ruleSelectionMap = new Map<string,boolean>();
                    rules.forEach(rule => ruleSelectionMap[rule] = false);
                    ruleSelectionMap = this.GetSelections(rules, ruleSelectionMap);
                });
        });
    }

    private GetSelections(rules: string[], ruleSelectionMap: Map<string,boolean>): Map<string,boolean>
    {
            vscode.window.showQuickPick(this.GetQuickPickItems(rules, ruleSelectionMap))
                .then((selection) =>{
                    if (!selection)
                    {
                        return;
                    }

                    if (selection.label == figures.tick)
                    {
                        vscode.window.showInformationMessage("yes!");
                        return;
                    }

                    ruleSelectionMap[selection.description] = this.ToggleState(ruleSelectionMap[selection.description]);
                    this.GetSelections(rules, ruleSelectionMap);
                });
            return ruleSelectionMap;
    }

    private GetCheckBoxOn() : string
    {
        return figures.checkboxOn;
    }

    private GetCheckBoxOff() : string
    {
        return figures.checkboxOff;
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

    private GetQuickPickItems(items: string[], itemsMap: Map<string,boolean>): QuickPickItem[] {
        let qItems: QuickPickItem[] = [];
        items.forEach(item => qItems.push({label: this.ConvertToCheckBox(itemsMap[item]), description: item }));
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
