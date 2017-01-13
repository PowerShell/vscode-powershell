/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import path = require('path');
import vscode = require('vscode');
import { IFeature } from '../feature';
import { LanguageClient, RequestType, NotificationType, Range, Position } from 'vscode-languageclient';

export interface ExtensionCommand {
    name: string;
    displayName: string;
}

export interface ExtensionCommandQuickPickItem extends vscode.QuickPickItem {
    command: ExtensionCommand;
}

export namespace InvokeExtensionCommandRequest {
    export const type: RequestType<InvokeExtensionCommandRequestArguments, void, void> =
        { get method() { return 'powerShell/invokeExtensionCommand'; } };
}

export interface EditorContext {
    currentFilePath: string;
    cursorPosition: Position;
    selectionRange: Range;
}

export interface InvokeExtensionCommandRequestArguments {
    name: string;
    context: EditorContext;
}

export namespace ExtensionCommandAddedNotification {
    export const type: NotificationType<ExtensionCommandAddedNotificationBody> =
        { get method() { return 'powerShell/extensionCommandAdded'; } };
}

export interface ExtensionCommandAddedNotificationBody {
    name: string;
    displayName: string;
}

// ---------- Editor Operations ----------

function asRange(value: vscode.Range): Range {

	if (value === undefined) {
		return undefined;
	} else if (value === null) {
		return null;
	}
	return { start: asPosition(value.start), end: asPosition(value.end) };
}

function asPosition(value: vscode.Position): Position {

	if (value === undefined) {
		return undefined;
	} else if (value === null) {
		return null;
	}
	return { line: value.line, character: value.character };
}

function asCodeRange(value: Range): vscode.Range {

	if (value === undefined) {
		return undefined;
	} else if (value === null) {
		return null;
	}
	return new vscode.Range(asCodePosition(value.start), asCodePosition(value.end));
}

function asCodePosition(value: Position): vscode.Position {

	if (value === undefined) {
		return undefined;
	} else if (value === null) {
		return null;
	}
	return new vscode.Position(value.line, value.character);
}

export namespace GetEditorContextRequest {
    export const type: RequestType<GetEditorContextRequestArguments, EditorContext, void> =
        { get method() { return 'editor/getEditorContext'; } };
}

export interface GetEditorContextRequestArguments {
}

enum EditorOperationResponse {
    Unsupported = 0,
    Completed
}

export namespace InsertTextRequest {
    export const type: RequestType<InsertTextRequestArguments, EditorOperationResponse, void> =
        { get method() { return 'editor/insertText'; } };
}

export interface InsertTextRequestArguments {
    filePath: string;
    insertText: string;
    insertRange: Range
}

export namespace SetSelectionRequest {
    export const type: RequestType<SetSelectionRequestArguments, EditorOperationResponse, void> =
        { get method() { return 'editor/setSelection'; } };
}

export interface SetSelectionRequestArguments {
    selectionRange: Range
}

export namespace OpenFileRequest {
    export const type: RequestType<string, EditorOperationResponse, void> =
        { get method() { return 'editor/openFile'; } };
}

export namespace CloseFileRequest {
    export const type: RequestType<string, EditorOperationResponse, void> =
        { get method() { return 'editor/closeFile'; } };
}

export namespace ShowErrorMessageRequest {
    export const type: RequestType<string, EditorOperationResponse, void> =
        { get method() { return 'editor/showErrorMessage'; } };
}

export namespace ShowWarningMessageRequest {
    export const type: RequestType<string, EditorOperationResponse, void> =
        { get method() { return 'editor/showWarningMessage'; } };
}

export namespace ShowInformationMessageRequest {
    export const type: RequestType<string, EditorOperationResponse, void> =
        { get method() { return 'editor/showInformationMessage'; } };
}

export namespace SetStatusBarMessageRequest {
    export const type: RequestType<StatusBarMessageDetails, EditorOperationResponse, void> =
        { get method() { return 'editor/setStatusBarMessage'; } };
}

export interface StatusBarMessageDetails {
    message: string;
    timeout?: number;
}

export class ExtensionCommandsFeature implements IFeature {

    private command: vscode.Disposable;
    private languageClient: LanguageClient;
    private extensionCommands = [];

    constructor() {
        this.command = vscode.commands.registerCommand('PowerShell.ShowAdditionalCommands', () => {
            if (this.languageClient === undefined) {
                // TODO: Log error message
                return;
            }

            var editor = vscode.window.activeTextEditor;
            var start = editor.selection.start;
            var end = editor.selection.end;
            if (editor.selection.isEmpty) {
                start = new vscode.Position(start.line, 0)
            }

            this.showExtensionCommands(this.languageClient);
        });
    }

    public setLanguageClient(languageclient: LanguageClient) {
        // Clear the current list of extension commands since they were
        // only relevant to the previous session
        this.extensionCommands = [];

        this.languageClient = languageclient;
        if (this.languageClient !== undefined) {
            this.languageClient.onNotification(
                ExtensionCommandAddedNotification.type,
                command => this.addExtensionCommand(command));

            this.languageClient.onRequest(
                GetEditorContextRequest.type,
                details => this.getEditorContext());

            this.languageClient.onRequest(
                InsertTextRequest.type,
                details => this.insertText(details));

            this.languageClient.onRequest(
                SetSelectionRequest.type,
                details => this.setSelection(details));

            this.languageClient.onRequest(
                OpenFileRequest.type,
                filePath => this.openFile(filePath));

            this.languageClient.onRequest(
                CloseFileRequest.type,
                filePath => this.closeFile(filePath));

            this.languageClient.onRequest(
                ShowInformationMessageRequest.type,
                message => this.showInformationMessage(message));

            this.languageClient.onRequest(
                ShowErrorMessageRequest.type,
                message => this.showErrorMessage(message));

            this.languageClient.onRequest(
                ShowWarningMessageRequest.type,
                message => this.showWarningMessage(message));

            this.languageClient.onRequest(
                SetStatusBarMessageRequest.type,
                messageDetails => this.setStatusBarMessage(messageDetails));
        }
    }

    public dispose() {
        this.command.dispose();
    }

    private addExtensionCommand(command: ExtensionCommandAddedNotificationBody) {

        this.extensionCommands.push({
            name: command.name,
            displayName: command.displayName
        });
    }

    private showExtensionCommands(client: LanguageClient) : Thenable<InvokeExtensionCommandRequestArguments> {

        // If no extension commands are available, show a message
        if (this.extensionCommands.length == 0) {
            vscode.window.showInformationMessage(
                "No extension commands have been loaded into the current session.");

            return;
        }

        var quickPickItems =
            this.extensionCommands.map<ExtensionCommandQuickPickItem>(command => {
                return {
                    label: command.displayName,
                    description: "",
                    command: command
                }
            });

        vscode.window
            .showQuickPick(
                quickPickItems,
                { placeHolder: "Select a command" })
            .then(command => this.onCommandSelected(command, client));
    }

    private onCommandSelected(
        chosenItem: ExtensionCommandQuickPickItem,
        client: LanguageClient) {

        if (chosenItem !== undefined) {
            client.sendRequest(
                InvokeExtensionCommandRequest.type,
                { name: chosenItem.command.name,
                context: this.getEditorContext() });
        }
    }

    private insertText(details: InsertTextRequestArguments): EditorOperationResponse {
        var edit = new vscode.WorkspaceEdit();

        edit.set(
            vscode.Uri.parse(details.filePath),
            [
                new vscode.TextEdit(
                    new vscode.Range(
                        details.insertRange.start.line,
                        details.insertRange.start.character,
                        details.insertRange.end.line,
                        details.insertRange.end.character),
                    details.insertText)
            ]
        );

        vscode.workspace.applyEdit(edit);

        return EditorOperationResponse.Completed;
    }

    private getEditorContext(): EditorContext {
        return {
            currentFilePath: vscode.window.activeTextEditor.document.fileName,
            cursorPosition: asPosition(vscode.window.activeTextEditor.selection.active),
            selectionRange:
                asRange(
                    new vscode.Range(
                        vscode.window.activeTextEditor.selection.start,
                        vscode.window.activeTextEditor.selection.end))
        }
    }

    private openFile(filePath: string): Thenable<EditorOperationResponse> {

        // Make sure the file path is absolute
        if (!path.win32.isAbsolute(filePath))
        {
            filePath = path.win32.resolve(
                vscode.workspace.rootPath,
                filePath);
        }

        var promise =
            vscode.workspace.openTextDocument(filePath)
                .then(doc => vscode.window.showTextDocument(doc))
                .then(_ => EditorOperationResponse.Completed);

        return promise;
    }

    private closeFile(filePath: string): Thenable<EditorOperationResponse> {

        var promise: Thenable<EditorOperationResponse>;

        // Make sure the file path is absolute
        if (!path.win32.isAbsolute(filePath))
        {
            filePath = path.win32.resolve(
                vscode.workspace.rootPath,
                filePath);
        }

        // Normalize file path case for comparison
        var normalizedFilePath = filePath.toLowerCase();

        if (vscode.workspace.textDocuments.find(doc => doc.fileName.toLowerCase() == normalizedFilePath))
        {
            promise =
                vscode.workspace.openTextDocument(filePath)
                    .then(doc => vscode.window.showTextDocument(doc))
                    .then(editor => vscode.commands.executeCommand("workbench.action.closeActiveEditor"))
                    .then(_ => EditorOperationResponse.Completed);
        }
        else
        {
            promise = Promise.resolve(EditorOperationResponse.Completed);
        }

        return promise;
    }

    private setSelection(details: SetSelectionRequestArguments): EditorOperationResponse {
        vscode.window.activeTextEditor.selections = [
            new vscode.Selection(
                asCodePosition(details.selectionRange.start),
                asCodePosition(details.selectionRange.end))
        ]

        return EditorOperationResponse.Completed;
    }

    private showInformationMessage(message: string): Thenable<EditorOperationResponse> {
        return vscode.window
                     .showInformationMessage(message)
                     .then(_ => EditorOperationResponse.Completed);
    }

    private showErrorMessage(message: string): Thenable<EditorOperationResponse> {
        return vscode.window
                     .showErrorMessage(message)
                     .then(_ => EditorOperationResponse.Completed);
    }

    private showWarningMessage(message: string): Thenable<EditorOperationResponse> {
        return vscode.window
                     .showWarningMessage(message)
                     .then(_ => EditorOperationResponse.Completed);
    }

    private setStatusBarMessage(messageDetails: StatusBarMessageDetails): EditorOperationResponse {

        if (messageDetails.timeout) {
            vscode.window.setStatusBarMessage(messageDetails.message, messageDetails.timeout);
        }
        else {
            vscode.window.setStatusBarMessage(messageDetails.message);
        }

        return EditorOperationResponse.Completed;
    }
}
