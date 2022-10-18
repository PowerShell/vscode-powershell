// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import vscode = require("vscode");

const confirmItemLabel = "$(checklist) Confirm";
const checkedPrefix = "[ $(check) ]";
const uncheckedPrefix = "[     ]";
const defaultPlaceHolder = "Select 'Confirm' to confirm or press 'Esc' key to cancel";

export interface ICheckboxQuickPickItem {
    label: string;
    description?: string;
    isSelected: boolean;
}

export interface ICheckboxQuickPickOptions {
    confirmPlaceHolder: string;
}

const defaultOptions: ICheckboxQuickPickOptions = { confirmPlaceHolder: defaultPlaceHolder };

export async function showCheckboxQuickPick(
    items: ICheckboxQuickPickItem[],
    options: ICheckboxQuickPickOptions = defaultOptions): Promise<ICheckboxQuickPickItem[] | undefined> {

    const selectedItem = await showInner(items, options);
    return selectedItem !== undefined ? items : undefined;
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

async function showInner(
    items: ICheckboxQuickPickItem[],
    options: ICheckboxQuickPickOptions): Promise<vscode.QuickPickItem | undefined> {

    const selection = await vscode.window.showQuickPick(
        getQuickPickItems(items),
        {
            ignoreFocusOut: true,
            matchOnDescription: true,
            placeHolder: options.confirmPlaceHolder,
        });

    if (selection === undefined) {
        return undefined;
    }

    if (selection.label === confirmItemLabel) {
        return selection;
    }

    const index: number = getItemIndex(items, selection.label);
    if (index >= 0) {
        toggleSelection(items[index]);
    } else {
        console.log(`Couldn't find CheckboxQuickPickItem for label '${selection.label}'`);
    }

    return showInner(items, options);
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
