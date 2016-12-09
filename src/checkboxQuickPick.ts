/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import vscode = require("vscode");
import QuickPickItem = vscode.QuickPickItem;

export class CheckboxQuickPickItem {
    name: string;
    isSelected: boolean;
}

export class CheckboxQuickPick {
    private static readonly confirm: string = "$(check)";
    private static readonly checkboxOn: string = "[ x ]";
    private static readonly checkboxOff: string = "[   ]";
    private static readonly confirmPlaceHolder: string = "Select 'Confirm' to confirm change; Press 'esc' key to cancel changes";

    public static show(
        checkboxQuickPickItems: CheckboxQuickPickItem[],
        callback: (items: CheckboxQuickPickItem[]) => void): void {
        CheckboxQuickPick.showInner(checkboxQuickPickItems.slice(), callback);
    }

    private static showInner(
        tempOptions: CheckboxQuickPickItem[],
        callback: (options: CheckboxQuickPickItem[]) => void): void {
            vscode.window.showQuickPick(
                CheckboxQuickPick.getQuickPickItems(tempOptions),
                { ignoreFocusOut: true, placeHolder: CheckboxQuickPick.confirmPlaceHolder }).then((selection) => {
                    if (!selection) {
                        return;
                    }

                    if (selection.label === CheckboxQuickPick.confirm) {
                        callback(tempOptions);
                        return;
                    }

                    let index: number = CheckboxQuickPick.getRuleIndex(tempOptions, selection.description);
                    CheckboxQuickPick.toggleOption(tempOptions[index]);
                    CheckboxQuickPick.showInner(tempOptions, callback);
                });
    }

    private static getRuleIndex(options: CheckboxQuickPickItem[], optionLabel: string): number {
        return options.findIndex(opt => opt.name == optionLabel);
    }

    private static getQuickPickItems(tempOptions: CheckboxQuickPickItem[]): QuickPickItem[] {
        let quickPickItems: QuickPickItem[] = [];
        quickPickItems.push({ label: CheckboxQuickPick.confirm, description: "Confirm" });
        tempOptions.forEach(option =>
            quickPickItems.push({
                label: CheckboxQuickPick.convertToCheckBox(option.isSelected), description: option.name
            }));
        return quickPickItems;
    }

    private static convertToState(checkBox: string): boolean {
        return checkBox === CheckboxQuickPick.checkboxOn;
    }

    private static toggleState(state: boolean): boolean {
        return !state;
    }

    private static toggleOption(option: CheckboxQuickPickItem): void {
        option.isSelected = CheckboxQuickPick.toggleState(option.isSelected);
    }

    private static toggleCheckBox(checkBox: string): string {
        return CheckboxQuickPick.convertToCheckBox(
            CheckboxQuickPick.toggleState(
                CheckboxQuickPick.convertToState(checkBox)));
    }

    private static convertToCheckBox(state: boolean): string {
        if (state) {
            return CheckboxQuickPick.checkboxOn;
        }
        else {
            return CheckboxQuickPick.checkboxOff;
        }
    }
}