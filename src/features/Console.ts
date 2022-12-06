// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import vscode = require("vscode");
import { NotificationType, RequestType } from "vscode-languageclient";
import { LanguageClient } from "vscode-languageclient/node";
import { ICheckboxQuickPickItem, showCheckboxQuickPick } from "../controls/checkboxQuickPick";
import { ILogger } from "../logging";
import { getSettings } from "../settings";
import { LanguageClientConsumer } from "../languageClientConsumer";

export const EvaluateRequestType = new RequestType<IEvaluateRequestArguments, void, void>("evaluate");
export const OutputNotificationType = new NotificationType<IOutputNotificationBody>("output");

export const ShowChoicePromptRequestType =
    new RequestType<IShowChoicePromptRequestArgs,
        IShowChoicePromptResponseBody, string>("powerShell/showChoicePrompt");

export const ShowInputPromptRequestType =
    new RequestType<IShowInputPromptRequestArgs,
        IShowInputPromptResponseBody, string>("powerShell/showInputPrompt");

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
    responseText: string | undefined;
    promptCancelled: boolean;
}

interface IShowInputPromptResponseBody {
    responseText: string | undefined;
    promptCancelled: boolean;
}


function showChoicePrompt(promptDetails: IShowChoicePromptRequestArgs): Thenable<IShowChoicePromptResponseBody> {

    let resultThenable: Thenable<IShowChoicePromptResponseBody>;

    if (!promptDetails.isMultiChoice) {
        let quickPickItems =
            promptDetails.choices.map<vscode.QuickPickItem>((choice) => {
                return {
                    label: choice.label,
                    description: choice.helpMessage,
                };
            });

        if (promptDetails.defaultChoices.length > 0) {
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
                    { placeHolder: promptDetails.message })
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
        for (const choice of promptDetails.defaultChoices) {
            checkboxQuickPickItems[choice].isSelected = true;
        }

        resultThenable =
            showCheckboxQuickPick(
                checkboxQuickPickItems,
                { confirmPlaceHolder: promptDetails.message })
                .then(onItemsSelected);
    }

    return resultThenable;
}

async function showInputPrompt(promptDetails: IShowInputPromptRequestArgs): Promise<IShowInputPromptResponseBody> {
    const responseText = await vscode.window.showInputBox({ placeHolder: promptDetails.name + ": " });
    return onInputEntered(responseText);
}

function onItemsSelected(chosenItems: ICheckboxQuickPickItem[] | undefined): IShowChoicePromptResponseBody {
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

function onItemSelected(chosenItem: vscode.QuickPickItem | undefined): IShowChoicePromptResponseBody {
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

function onInputEntered(responseText: string | undefined): IShowInputPromptResponseBody {
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

export class ConsoleFeature extends LanguageClientConsumer {
    private commands: vscode.Disposable[];
    private handlers: vscode.Disposable[] = [];

    constructor(private logger: ILogger) {
        super();
        this.commands = [
            vscode.commands.registerCommand("PowerShell.RunSelection", async () => {
                if (vscode.window.activeTerminal &&
                    vscode.window.activeTerminal.name !== "PowerShell Extension") {
                    this.logger.write("PowerShell Extension Terminal is not active! Running in current terminal using 'runSelectedText'");
                    await vscode.commands.executeCommand("workbench.action.terminal.runSelectedText");

                    // We need to honor the focusConsoleOnExecute setting here too. However, the boolean that `show`
                    // takes is called `preserveFocus` which when `true` the terminal will not take focus.
                    // This is the inverse of focusConsoleOnExecute so we have to inverse the boolean.
                    vscode.window.activeTerminal.show(!getSettings().integratedConsole.focusConsoleOnExecute);
                    await vscode.commands.executeCommand("workbench.action.terminal.scrollToBottom");

                    return;
                }

                const editor = vscode.window.activeTextEditor;
                if (editor === undefined) {
                    return;
                }

                let selectionRange: vscode.Range;

                if (!editor.selection.isEmpty) {
                    selectionRange = new vscode.Range(editor.selection.start, editor.selection.end);
                } else {
                    selectionRange = editor.document.lineAt(editor.selection.start.line).range;
                }

                await this.languageClient?.sendRequest(EvaluateRequestType, {
                    expression: editor.document.getText(selectionRange),
                });

                // Show the Extension Terminal if it isn't already visible and
                // scroll terminal to bottom so new output is visible
                await vscode.commands.executeCommand("PowerShell.ShowSessionConsole", true);
                await vscode.commands.executeCommand("workbench.action.terminal.scrollToBottom");
            }),
        ];
    }

    public dispose() {
        for (const command of this.commands) {
            command.dispose();
        }
        for (const handler of this.handlers) {
            handler.dispose();
        }
    }

    public override setLanguageClient(languageClient: LanguageClient) {
        this.languageClient = languageClient;
        this.handlers = [
            this.languageClient.onRequest(
                ShowChoicePromptRequestType,
                (promptDetails) => showChoicePrompt(promptDetails)),

            this.languageClient.onRequest(
                ShowInputPromptRequestType,
                (promptDetails) => showInputPrompt(promptDetails)),
        ];
    }
}
