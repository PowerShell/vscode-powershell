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
        items: CheckboxQuickPickItem[],
        callback: (items: CheckboxQuickPickItem[]) => void): void {
        vscode.window.showQuickPick(
            CheckboxQuickPick.getQuickPickItems(items),
            {
                ignoreFocusOut: true,
                matchOnDescription: true,
                placeHolder: CheckboxQuickPick.confirmPlaceHolder
            }).then((selection) => {
                if (!selection) {
                    return;
                }

                if (selection.label === CheckboxQuickPick.confirm) {
                    callback(items);
                    return;
                }

                let index: number = CheckboxQuickPick.getRuleIndex(items, selection.description);
                CheckboxQuickPick.toggleSelection(items[index]);
                CheckboxQuickPick.showInner(items, callback);
            });
    }

    private static getRuleIndex(items: CheckboxQuickPickItem[], itemLabel: string): number {
        return items.findIndex(item => item.name === itemLabel);
    }

    private static getQuickPickItems(items: CheckboxQuickPickItem[]): QuickPickItem[] {
        let quickPickItems: QuickPickItem[] = [];
        quickPickItems.push({ label: CheckboxQuickPick.confirm, description: "Confirm" });
        items.forEach(item =>
            quickPickItems.push({
                label: CheckboxQuickPick.convertToCheckBox(item.isSelected), description: item.name
            }));
        return quickPickItems;
    }

    private static toggleSelection(item: CheckboxQuickPickItem): void {
        item.isSelected = !item.isSelected;
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