/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import vscode = require('vscode');
import QuickPickItem = vscode.QuickPickItem;
const figures = require('figures');

export interface Option {
    name: string;
    isSelected: boolean;
}

export class CheckboxQuickPick {
    private options: Option[];
    private readonly confirm: string;
    private readonly checkboxOn: string;
    private readonly checkboxOff: string;
    private readonly confirmPlaceHolder: string;

    constructor(options: Option[]) {
        this.options = options;
        this.confirm = figures.tick;
        this.checkboxOn = "[ x ]";
        this.checkboxOff = "[   ]";
        this.confirmPlaceHolder = "Select " + this.confirm + " to confirm";
    }

    public show(callback: (options: Option[]) => void) {
        let tempOptions = this.options.slice();
        this.showInner(tempOptions, callback);
    }

    private showInner(tempOptions: Option[], callback: (options: Option[]) => void) {
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

                let index = this.getRuleIndex(tempOptions, selection.description);
                // this.toggleOption(tempOptions[index]);
                tempOptions[index].isSelected = this.toggleState(tempOptions[index].isSelected);
                this.showInner(tempOptions, callback);
            });
    }

    private getRuleIndex(options: Option[], optionLabel: string) {
        return options.findIndex(opt => opt.name == optionLabel);
    }

    private getQuickPickItems(tempOptions: Option[]): QuickPickItem[] {
        let quickPickItems: QuickPickItem[] = [];
        tempOptions.forEach(option =>
            quickPickItems.push({
                label: this.convertToCheckBox(option.isSelected), description: option.name
            }));
        quickPickItems.push({ label: this.confirm, description: "Confirm" });
        return quickPickItems;
    }

    private convertToState(checkBox: string): boolean {
        return checkBox == this.checkboxOn;
    }

    private toggleOption(option: Option) {
        option.isSelected = this.toggleState(option.isSelected);
    }

    private toggleState(state: boolean): boolean {
        return !state;
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