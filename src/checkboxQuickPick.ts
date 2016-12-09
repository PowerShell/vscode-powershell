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
    private options: CheckboxQuickPickItem[];
    private readonly confirm: string;
    private readonly checkboxOn: string;
    private readonly checkboxOff: string;
    private readonly confirmPlaceHolder: string;

    constructor(options: CheckboxQuickPickItem[]) {
        this.options = options;
        this.confirm = "$(check)";
        this.checkboxOn = "[ x ]";
        this.checkboxOff = "[   ]";
        this.confirmPlaceHolder = "Select 'Confirm' to confirm change; Press 'esc' key to cancel changes";
    }

    public show(callback: (options: CheckboxQuickPickItem[]) => void): void {
        let tempOptions: CheckboxQuickPickItem[] = this.options.slice();
        this.showInner(tempOptions, callback);
    }

    private showInner(
        tempOptions: CheckboxQuickPickItem[],
        callback: (options: CheckboxQuickPickItem[]) => void): void {
            vscode.window.showQuickPick(
                this.getQuickPickItems(tempOptions),
                { ignoreFocusOut: true, placeHolder: this.confirmPlaceHolder }).then((selection) => {
                    if (!selection) {
                        return;
                    }

                    if (selection.label == this.confirm) {
                        callback(tempOptions);
                        this.options = tempOptions;
                        return;
                    }

                    let index: number = this.getRuleIndex(tempOptions, selection.description);
                    this.toggleOption(tempOptions[index]);
                    this.showInner(tempOptions, callback);
                });
    }

    private getRuleIndex(options: CheckboxQuickPickItem[], optionLabel: string): number {
        return options.findIndex(opt => opt.name == optionLabel);
    }

    private getQuickPickItems(tempOptions: CheckboxQuickPickItem[]): QuickPickItem[] {
        let quickPickItems: QuickPickItem[] = [];
        quickPickItems.push({ label: this.confirm, description: "Confirm" });
        tempOptions.forEach(option =>
            quickPickItems.push({
                label: this.convertToCheckBox(option.isSelected), description: option.name
            }));
        return quickPickItems;
    }

    private convertToState(checkBox: string): boolean {
        return checkBox == this.checkboxOn;
    }

    private toggleState(state: boolean): boolean {
        return !state;
    }

    private toggleOption(option: CheckboxQuickPickItem): void {
        option.isSelected = this.toggleState(option.isSelected);
    }

    private toggleCheckBox(checkBox: string): string {
        return this.convertToCheckBox(this.toggleState(this.convertToState(checkBox)));
    }

    private convertToCheckBox(state: boolean): string {
        if (state) {
            return this.checkboxOn;
        }
        else {
            return this.checkboxOff;
        }
    }
}