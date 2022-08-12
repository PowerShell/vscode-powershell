// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import vscode = require("vscode");

const confirmItemLabel: string = "$(checklist) Confirm";
const checkedPrefix: string = "[ $(check) ]";
const uncheckedPrefix: string = "[     ]";
const defaultPlaceHolder: string = "Select 'Confirm' to confirm or press 'Esc' key to cancel";

export interface ICheckboxQuickPickItem {
    label: string;
    description?: string;
    isSelected: boolean;
}

export interface ICheckboxQuickPickOptions {
    confirmPlaceHolder: string;
}

const defaultOptions: ICheckboxQuickPickOptions = { confirmPlaceHolder: defaultPlaceHolder};

export function showCheckboxQuickPick(
    items: ICheckboxQuickPickItem[],
    options: ICheckboxQuickPickOptions = defaultOptions): Thenable<ICheckboxQuickPickItem[]> {

    return showInner(items, options).then(
        (selectedItem) => {
            // We're mutating the original item list so just return it for now.
            // If 'selectedItem' is undefined it means the user cancelled the
            // inner showQuickPick UI so pass the undefined along.
            return selectedItem !== undefined ? items : undefined;
        });
}

function getQuickPickItems(items: ICheckboxQuickPickItem[]): vscode.QuickPickItem[] {

    const quickPickItems: vscode.QuickPickItem[] = [];
    quickPickItems.push({ label: confirmItemLabel, description: "" });

    for (const item of items) {
        quickPickItems.push({
            label: convertToCheckBox(item),
            description: item.description,
        });
    }

    return quickPickItems;
}

function showInner(
    items: ICheckboxQuickPickItem[],
    options: ICheckboxQuickPickOptions): Thenable<vscode.QuickPickItem> {

    const quickPickThenable: Thenable<vscode.QuickPickItem> =
        vscode.window.showQuickPick(
            getQuickPickItems(items),
            {
                ignoreFocusOut: true,
                matchOnDescription: true,
                placeHolder: options.confirmPlaceHolder,
            });

    return quickPickThenable.then(
        (selection) => {
            if (!selection) {
                return Promise.resolve<vscode.QuickPickItem>(undefined);
            }

            if (selection.label === confirmItemLabel) {
                return selection;
            }

            const index: number = getItemIndex(items, selection.label);

            if (index >= 0) {
                toggleSelection(items[index]);
            } else {
                // tslint:disable-next-line:no-console
                console.log(`Couldn't find CheckboxQuickPickItem for label '${selection.label}'`);
            }

            return showInner(items, options);
        });
}

function getItemIndex(items: ICheckboxQuickPickItem[], itemLabel: string): number {
    const trimmedLabel = itemLabel.substr(itemLabel.indexOf("]") + 2);
    return items.findIndex((item) => item.label === trimmedLabel);
}

function toggleSelection(item: ICheckboxQuickPickItem): void {
    item.isSelected = !item.isSelected;
}

function convertToCheckBox(item: ICheckboxQuickPickItem): string {
    return `${item.isSelected ? checkedPrefix : uncheckedPrefix} ${item.label}`;
}
