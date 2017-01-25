/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import vscode = require("vscode");

var confirmItemLabel: string = "$(checklist) Confirm";
var checkedPrefix: string = "[ $(check) ]";
var uncheckedPrefix: string = "[     ]";
var defaultPlaceHolder: string = "Select 'Confirm' to confirm or press 'Esc' key to cancel";

export interface CheckboxQuickPickItem {
    label: string;
    description?: string;
    isSelected: boolean;
}

export interface CheckboxQuickPickOptions {
    confirmPlaceHolder: string;
}

var defaultOptions:CheckboxQuickPickOptions = { confirmPlaceHolder: defaultPlaceHolder};

export function showCheckboxQuickPick(
    items: CheckboxQuickPickItem[],
    options: CheckboxQuickPickOptions = defaultOptions): Thenable<CheckboxQuickPickItem[]> {

    return showInner(items, options).then(
        (selectedItem) => {
            // We're mutating the original item list so just return it for now.
            // If 'selectedItem' is undefined it means the user cancelled the
            // inner showQuickPick UI so pass the undefined along.
            return selectedItem != undefined ? items : undefined;
        })
}

function getQuickPickItems(items: CheckboxQuickPickItem[]): vscode.QuickPickItem[] {

    let quickPickItems: vscode.QuickPickItem[] = [];
    quickPickItems.push({ label: confirmItemLabel, description: "" });

    items.forEach(item =>
        quickPickItems.push({
                label: convertToCheckBox(item),
                description: item.description
        }));

    return quickPickItems;
}

function showInner(
    items: CheckboxQuickPickItem[],
    options: CheckboxQuickPickOptions): Thenable<vscode.QuickPickItem> {

    var quickPickThenable: Thenable<vscode.QuickPickItem> =
        vscode.window.showQuickPick(
            getQuickPickItems(items),
            {
                ignoreFocusOut: true,
                matchOnDescription: true,
                placeHolder: options.confirmPlaceHolder
            });

    return quickPickThenable.then(
        (selection) => {
            if (!selection) {
                //return Promise.reject<vscode.QuickPickItem>("showCheckBoxQuickPick cancelled")
                return Promise.resolve<vscode.QuickPickItem>(undefined);
            }

            if (selection.label === confirmItemLabel) {
                return selection;
            }

            let index: number = getItemIndex(items, selection.label);

            if (index >= 0) {
                toggleSelection(items[index]);
            }
            else {
                console.log(`Couldn't find CheckboxQuickPickItem for label '${selection.label}'`);
            }

            return showInner(items, options);
        });
}

function getItemIndex(items: CheckboxQuickPickItem[], itemLabel: string): number {
    var trimmedLabel = itemLabel.substr(itemLabel.indexOf("]") + 2);
    return items.findIndex(item => item.label === trimmedLabel);
}

function toggleSelection(item: CheckboxQuickPickItem): void {
    item.isSelected = !item.isSelected;
}

function convertToCheckBox(item: CheckboxQuickPickItem): string {
    return `${item.isSelected ? checkedPrefix : uncheckedPrefix} ${item.label}`;
}