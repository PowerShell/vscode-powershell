// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import vscode = require("vscode");
import { NotificationType, RequestType } from "vscode-languageclient";
import { LanguageClient } from "vscode-languageclient/node";
import { ICheckboxQuickPickItem, showCheckboxQuickPick } from "../controls/checkboxQuickPick";
import { Logger } from "../logging";
import Settings = require("../settings");
import { LanguageClientConsumer } from "../languageClientConsumer";

export const EvaluateRequestType = new RequestType<IEvaluateRequestArguments, void, void>("evaluate");
export const OutputNotificationType = new NotificationType<IOutputNotificationBody>("output");
export const ExecutionStatusChangedNotificationType =
    new NotificationType<IExecutionStatusDetails>("powerShell/executionStatusChanged");

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

interface IExecutionStatusDetails {
    executionOptions: IExecutionOptions;
    executionStatus: ExecutionStatus;
    hadErrors: boolean;
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

enum ExecutionStatus {
    Pending,
    Running,
    Failed,
    Aborted,
    Completed,
}

interface IExecutionOptions {
    writeOutputToHost: boolean;
    writeErrorsToHost: boolean;
    addToHistory: boolean;
    interruptCommandPrompt: boolean;
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
        promptDetails.defaultChoices.forEach((choiceIndex) => {
            checkboxQuickPickItems[choiceIndex].isSelected = true;
        });

        resultThenable =
            showCheckboxQuickPick(
                    checkboxQuickPickItems,
                    { confirmPlaceHolder: promptDetails.message })
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

export class ConsoleFeature extends LanguageClientConsumer {
    private commands: vscode.Disposable[];
    private resolveStatusBarPromise: (value?: {} | PromiseLike<{}>) => void;

    constructor(private log: Logger) {
        super();
        this.commands = [
            vscode.commands.registerCommand("PowerShell.RunSelection", async () => {

                if (vscode.window.activeTerminal &&
                    vscode.window.activeTerminal.name !== "PowerShell Extension") {
                    this.log.write("PowerShell Extension Terminal is not active! Running in current terminal using 'runSelectedText'");
                    await vscode.commands.executeCommand("workbench.action.terminal.runSelectedText");

                    // We need to honor the focusConsoleOnExecute setting here too. However, the boolean that `show`
                    // takes is called `preserveFocus` which when `true` the terminal will not take focus.
                    // This is the inverse of focusConsoleOnExecute so we have to inverse the boolean.
                    vscode.window.activeTerminal.show(!Settings.load().integratedConsole.focusConsoleOnExecute);
                    await vscode.commands.executeCommand("workbench.action.terminal.scrollToBottom");

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

                // Show the Extension Terminal if it isn't already visible and
                // scroll terminal to bottom so new output is visible
                await vscode.commands.executeCommand("PowerShell.ShowSessionConsole", true);
                await vscode.commands.executeCommand("workbench.action.terminal.scrollToBottom");
            }),
        ];
    }

    public dispose() {
        // Make sure we cancel any status bar
        this.clearStatusBar();
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

        // Set up status bar alerts for when PowerShell is executing a script
        this.languageClient.onNotification(
            ExecutionStatusChangedNotificationType,
            (executionStatusDetails) => {
                switch (executionStatusDetails.executionStatus) {
                    // If execution has changed to running, make a notification
                    case ExecutionStatus.Running:
                        this.showExecutionStatus("PowerShell");
                        break;

                    // If the execution has stopped, destroy the previous notification
                    case ExecutionStatus.Completed:
                    case ExecutionStatus.Aborted:
                    case ExecutionStatus.Failed:
                        this.clearStatusBar();
                        break;
                }
            });

    }

    private showExecutionStatus(message: string) {
        vscode.window.withProgress({
                location: vscode.ProgressLocation.Window,
            }, (progress) => {
                return new Promise((resolve, reject) => {
                    this.clearStatusBar();

                    this.resolveStatusBarPromise = resolve;
                    progress.report({ message });
                });
            });
    }

    private clearStatusBar() {
        if (this.resolveStatusBarPromise) {
            this.resolveStatusBarPromise();
        }
    }
}
