/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import vscode = require('vscode');
import { IFeature } from '../feature';
import { showCheckboxQuickPick, CheckboxQuickPickItem } from '../controls/checkboxQuickPick'
import { LanguageClient, RequestType, NotificationType } from 'vscode-languageclient';

export namespace EvaluateRequest {
    export const type = new RequestType<EvaluateRequestArguments, void, void, void>('evaluate');
}

export interface EvaluateRequestArguments {
    expression: string;
}

export namespace OutputNotification {
    export const type = new NotificationType<OutputNotificationBody, void>('output');
}

export interface OutputNotificationBody {
    category: string;
    output: string;
}

export namespace ShowChoicePromptRequest {
    export const type =
        new RequestType<ShowChoicePromptRequestArgs, ShowChoicePromptResponseBody, string, void>('powerShell/showChoicePrompt');
}

export namespace ShowInputPromptRequest {
    export const type =
        new RequestType<ShowInputPromptRequestArgs, ShowInputPromptResponseBody, string, void>('powerShell/showInputPrompt');
}

interface ChoiceDetails {
    label: string;
    helpMessage: string;
}

interface ShowInputPromptRequestArgs {
    name: string;
    label: string;
}

interface ShowChoicePromptRequestArgs {
    isMultiChoice: boolean;
    caption: string;
    message: string;
    choices: ChoiceDetails[];
    defaultChoices: number[];
}

interface ShowChoicePromptResponseBody {
    responseText: string;
    promptCancelled: boolean;
}

interface ShowInputPromptResponseBody {
    responseText: string;
    promptCancelled: boolean;
}

function showChoicePrompt(
    promptDetails: ShowChoicePromptRequestArgs,
    client: LanguageClient) : Thenable<ShowChoicePromptResponseBody> {

    var resultThenable: Thenable<ShowChoicePromptResponseBody> = undefined;

    if (!promptDetails.isMultiChoice) {
        var quickPickItems =
            promptDetails.choices.map<vscode.QuickPickItem>(choice => {
                return {
                    label: choice.label,
                    description: choice.helpMessage
                }
            });

        if (promptDetails.defaultChoices &&
            promptDetails.defaultChoices.length > 0) {

            // Shift the default items to the front of the
            // array so that the user can select it easily
            var defaultChoice = promptDetails.defaultChoices[0];
            if (defaultChoice > -1 &&
                defaultChoice < promptDetails.choices.length) {

                var defaultChoiceItem = quickPickItems[defaultChoice];
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
    }
    else {
        var checkboxQuickPickItems =
            promptDetails.choices.map<CheckboxQuickPickItem>(choice => {
                return {
                    label: choice.label,
                    description: choice.helpMessage,
                    isSelected: false
                }
            });

        // Select the defaults
        promptDetails.defaultChoices.forEach(choiceIndex => {
            checkboxQuickPickItems[choiceIndex].isSelected = true
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
    promptDetails: ShowInputPromptRequestArgs,
    client: LanguageClient) : Thenable<ShowInputPromptResponseBody> {

    var resultThenable =
        vscode.window.showInputBox({
            placeHolder: promptDetails.name + ": "
        }).then(onInputEntered)

    return resultThenable;
}

function onItemsSelected(chosenItems: CheckboxQuickPickItem[]): ShowChoicePromptResponseBody {
    if (chosenItems !== undefined) {
        return {
            promptCancelled: false,
            responseText: chosenItems.filter(item => item.isSelected).map(item => item.label).join(", ")
        };
    }
    else {
        // User cancelled the prompt, send the cancellation
        return {
            promptCancelled: true,
            responseText: undefined
        };
    }
}

function onItemSelected(chosenItem: vscode.QuickPickItem): ShowChoicePromptResponseBody {
    if (chosenItem !== undefined) {
        return {
            promptCancelled: false,
            responseText: chosenItem.label
        };
    }
    else {
        // User cancelled the prompt, send the cancellation
        return {
            promptCancelled: true,
            responseText: undefined
        };
    }
}

function onInputEntered(responseText: string): ShowInputPromptResponseBody {
    if (responseText !== undefined) {
        return {
            promptCancelled: false,
            responseText: responseText
        }
    }
    else {
        return {
            promptCancelled: true,
            responseText: undefined
        }
    }
}

export class ConsoleFeature implements IFeature {
    private commands: vscode.Disposable[];
    private languageClient: LanguageClient;

    constructor() {
        this.commands = [
            vscode.commands.registerCommand('PowerShell.RunSelection', () => {
                if (this.languageClient === undefined) {
                    // TODO: Log error message
                    return;
                }

                var editor = vscode.window.activeTextEditor;
                var selectionRange: vscode.Range = undefined;

                if (!editor.selection.isEmpty) {
                    selectionRange =
                        new vscode.Range(
                            editor.selection.start,
                            editor.selection.end);
                }
                else {
                    selectionRange = editor.document.lineAt(editor.selection.start.line).range;
                }

                this.languageClient.sendRequest(EvaluateRequest.type, {
                    expression: editor.document.getText(selectionRange)
                });

                // Show the integrated console if it isn't already visible
                vscode.commands.executeCommand("PowerShell.ShowSessionConsole", true);
            })
        ];
    }

    public setLanguageClient(languageClient: LanguageClient) {
        this.languageClient = languageClient;

        this.languageClient.onRequest(
            ShowChoicePromptRequest.type,
            promptDetails => showChoicePrompt(promptDetails, this.languageClient));

        this.languageClient.onRequest(
            ShowInputPromptRequest.type,
            promptDetails => showInputPrompt(promptDetails, this.languageClient));
    }

    public dispose() {
        this.commands.forEach(command => command.dispose());
    }
}
