/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import vscode = require("vscode");
import { LanguageClient, NotificationType, RequestType } from "vscode-languageclient";
import { ICheckboxQuickPickItem, showCheckboxQuickPick } from "../controls/checkboxQuickPick";
import { IFeature } from "../feature";

export const EvaluateRequestType = new RequestType<IEvaluateRequestArguments, void, void, void>("evaluate");
export const OutputNotificationType = new NotificationType<IOutputNotificationBody, void>("output");

export const ShowChoicePromptRequestType =
    new RequestType<IShowChoicePromptRequestArgs,
                    IShowChoicePromptResponseBody, string, void>("powerShell/showChoicePrompt");

export const ShowInputPromptRequestType =
    new RequestType<IShowInputPromptRequestArgs,
                    IShowInputPromptResponseBody, string, void>("powerShell/showInputPrompt");

export interface IEvaluateRequestArguments {
    expression: string;
}

export interface IOutputNotificationBody {
    category: string;
    output: string;
}

interface IChoiceDetails {
    label: string;
    helpMessage: string;
}

interface IShowInputPromptRequestArgs {
    name: string;
    label: string;
}

interface IShowChoicePromptRequestArgs {
    isMultiChoice: boolean;
    caption: string;
    message: string;
    choices: IChoiceDetails[];
    defaultChoices: number[];
}

interface IShowChoicePromptResponseBody {
    responseText: string;
    promptCancelled: boolean;
}

interface IShowInputPromptResponseBody {
    responseText: string;
    promptCancelled: boolean;
}

function showChoicePrompt(
    promptDetails: IShowChoicePromptRequestArgs,
    client: LanguageClient): Thenable<IShowChoicePromptResponseBody> {

    let resultThenable: Thenable<IShowChoicePromptResponseBody>;

    if (!promptDetails.isMultiChoice) {
        let quickPickItems =
            promptDetails.choices.map<vscode.QuickPickItem>((choice) => {
                return {
                    label: choice.label,
                    description: choice.helpMessage,
                };
            });

        if (promptDetails.defaultChoices && promptDetails.defaultChoices.length > 0) {
            // Shift the default items to the front of the
            // array so that the user can select it easily
            const defaultChoice = promptDetails.defaultChoices[0];
            if (defaultChoice > -1 &&
                defaultChoice < promptDetails.choices.length) {

                const defaultChoiceItem = quickPickItems[defaultChoice];
                quickPickItems.splice(defaultChoice, 1);

                // Add the default choice to the head of the array
                quickPickItems = [defaultChoiceItem].concat(quickPickItems);
            }
        }

        resultThenable =
            vscode.window
                .showQuickPick(
                    quickPickItems,
                    { placeHolder: promptDetails.caption + " - " + promptDetails.message })
                .then(onItemSelected);
    } else {
        const checkboxQuickPickItems =
            promptDetails.choices.map<ICheckboxQuickPickItem>((choice) => {
                return {
                    label: choice.label,
                    description: choice.helpMessage,
                    isSelected: false,
                };
            });

        // Select the defaults
        promptDetails.defaultChoices.forEach((choiceIndex) => {
            checkboxQuickPickItems[choiceIndex].isSelected = true;
        });

        resultThenable =
            showCheckboxQuickPick(
                    checkboxQuickPickItems,
                    { confirmPlaceHolder: `${promptDetails.caption} - ${promptDetails.message}`})
                .then(onItemsSelected);
    }

    return resultThenable;
}

function showInputPrompt(
    promptDetails: IShowInputPromptRequestArgs,
    client: LanguageClient): Thenable<IShowInputPromptResponseBody> {

    const resultThenable =
        vscode.window.showInputBox({
            placeHolder: promptDetails.name + ": ",
        }).then(onInputEntered);

    return resultThenable;
}

function onItemsSelected(chosenItems: ICheckboxQuickPickItem[]): IShowChoicePromptResponseBody {
    if (chosenItems !== undefined) {
        return {
            promptCancelled: false,
            responseText: chosenItems.filter((item) => item.isSelected).map((item) => item.label).join(", "),
        };
    } else {
        // User cancelled the prompt, send the cancellation
        return {
            promptCancelled: true,
            responseText: undefined,
        };
    }
}

function onItemSelected(chosenItem: vscode.QuickPickItem): IShowChoicePromptResponseBody {
    if (chosenItem !== undefined) {
        return {
            promptCancelled: false,
            responseText: chosenItem.label,
        };
    } else {
        // User cancelled the prompt, send the cancellation
        return {
            promptCancelled: true,
            responseText: undefined,
        };
    }
}

function onInputEntered(responseText: string): IShowInputPromptResponseBody {
    if (responseText !== undefined) {
        return {
            promptCancelled: false,
            responseText,
        };
    } else {
        return {
            promptCancelled: true,
            responseText: undefined,
        };
    }
}

export class ConsoleFeature implements IFeature {
    private commands: vscode.Disposable[];
    private languageClient: LanguageClient;

    constructor() {
        this.commands = [
            vscode.commands.registerCommand("PowerShell.RunSelection", () => {
                if (this.languageClient === undefined) {
                    // TODO: Log error message
                    return;
                }

                const editor = vscode.window.activeTextEditor;
                let selectionRange: vscode.Range;

                if (!editor.selection.isEmpty) {
                    selectionRange =
                        new vscode.Range(
                            editor.selection.start,
                            editor.selection.end);
                } else {
                    selectionRange = editor.document.lineAt(editor.selection.start.line).range;
                }

                this.languageClient.sendRequest(EvaluateRequestType, {
                    expression: editor.document.getText(selectionRange),
                });

                // Show the integrated console if it isn't already visible
                vscode.commands.executeCommand("PowerShell.ShowSessionConsole", true);
            }),
        ];
    }

    public dispose() {
        this.commands.forEach((command) => command.dispose());
    }

    public setLanguageClient(languageClient: LanguageClient) {
        this.languageClient = languageClient;

        this.languageClient.onRequest(
            ShowChoicePromptRequestType,
            (promptDetails) => showChoicePrompt(promptDetails, this.languageClient));

        this.languageClient.onRequest(
            ShowInputPromptRequestType,
            (promptDetails) => showInputPrompt(promptDetails, this.languageClient));
    }
}
