import vscode = require('vscode');
import { LanguageClient, RequestType, NotificationType } from 'vscode-languageclient';

export namespace EvaluateRequest {
    export const type: RequestType<EvaluateRequestArguments, void, void> =
        { get method() { return 'evaluate'; } };
}

export interface EvaluateRequestArguments {
    expression: string;
}

export namespace OutputNotification {
    export const type: NotificationType<OutputNotificationBody> =
        { get method() { return 'output'; } };
}

export interface OutputNotificationBody {
    category: string;
    output: string;
}

export namespace ShowChoicePromptNotification {
    export const type: NotificationType<ShowChoicePromptNotificationBody> =
        { get method() { return 'powerShell/showChoicePrompt'; } };
}

interface ChoiceDetails {
    label: string;
    helpMessage: string;
}

interface ShowChoicePromptNotificationBody {
    caption: string;
    message: string;
    choices: ChoiceDetails[];
    defaultChoice: number;
}

export namespace CompleteChoicePromptNotification {
    export const type: NotificationType<CompleteChoicePromptNotificationBody> =
        { get method() { return 'powerShell/completeChoicePrompt'; } };
}

interface CompleteChoicePromptNotificationBody {
    chosenItem: string;
    promptCancelled: boolean;
}

function showChoicePrompt(
    promptDetails: ShowChoicePromptNotificationBody,
    client: LanguageClient) {

    var quickPickItems =
        promptDetails.choices.map<vscode.QuickPickItem>(choice => {
            return {
                label: choice.label,
                description: choice.helpMessage
            }
        });

    // Shift the default item to the front of the
    // array so that the user can select it easily
    if (promptDetails.defaultChoice > -1 &&
        promptDetails.defaultChoice < promptDetails.choices.length) {

        var defaultChoiceItem = quickPickItems[promptDetails.defaultChoice];
        quickPickItems.splice(promptDetails.defaultChoice, 1);

        // Add the default choice to the head of the array
        quickPickItems = [defaultChoiceItem].concat(quickPickItems);
    }

    vscode.window
        .showQuickPick(
        quickPickItems,
        { placeHolder: promptDetails.caption + " - " + promptDetails.message })
        .then(chosenItem => onItemSelected(chosenItem, client));
}

function onItemSelected(chosenItem: vscode.QuickPickItem, client: LanguageClient) {
    if (chosenItem !== undefined) {
        client.sendNotification(
            CompleteChoicePromptNotification.type,
            { chosenItem: chosenItem.label });
    }
    else {
        // User cancelled the prompt, send the cancellation
        client.sendNotification(
            CompleteChoicePromptNotification.type,
            { promptCancelled: true });
    }
}

export function registerConsoleCommands(client: LanguageClient): void {

    vscode.commands.registerCommand('PowerShell.RunSelection', () => {
        var editor = vscode.window.activeTextEditor;
        var start = editor.selection.start;
        var end = editor.selection.end;
        if (editor.selection.isEmpty) {
            start = new vscode.Position(start.line, 0)
        }
        client.sendRequest(EvaluateRequest.type, {
            expression:
            editor.document.getText(
                new vscode.Range(start, end))
        });
    });

    var consoleChannel = vscode.window.createOutputChannel("PowerShell Output");
    client.onNotification(OutputNotification.type, (output) => {
        var outputEditorExist = vscode.window.visibleTextEditors.some((editor) => {
	           return editor.document.languageId == 'Log'
        });
        if (!outputEditorExist)
            consoleChannel.show(vscode.ViewColumn.Three);
        consoleChannel.append(output.output);
    });

    client.onNotification(
        ShowChoicePromptNotification.type,
        promptDetails => showChoicePrompt(promptDetails, client));
}
