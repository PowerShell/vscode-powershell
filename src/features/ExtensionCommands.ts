/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import os = require('os');
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
    export const type =
        new RequestType<InvokeExtensionCommandRequestArguments, void, void, void>(
            'powerShell/invokeExtensionCommand');
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
    export const type =
        new NotificationType<ExtensionCommandAddedNotificationBody, void>(
            'powerShell/extensionCommandAdded');
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
    export const type =
        new RequestType<GetEditorContextRequestArguments, EditorContext, void, void>(
            'editor/getEditorContext');
}

export interface GetEditorContextRequestArguments {
}

enum EditorOperationResponse {
    Unsupported = 0,
    Completed
}

export namespace InsertTextRequest {
    export const type =
        new RequestType<InsertTextRequestArguments, EditorOperationResponse, void, void>(
            'editor/insertText');
}

export interface InsertTextRequestArguments {
    filePath: string;
    insertText: string;
    insertRange: Range
}

export namespace SetSelectionRequest {
    export const type =
        new RequestType<SetSelectionRequestArguments, EditorOperationResponse, void, void>(
            'editor/setSelection');
}

export interface SetSelectionRequestArguments {
    selectionRange: Range
}

export namespace OpenFileRequest {
    export const type =
        new RequestType<string, EditorOperationResponse, void, void>(
            'editor/openFile');
}

export namespace NewFileRequest {
    export const type =
        new RequestType<string, EditorOperationResponse, void, void>(
            'editor/newFile');
}

export namespace CloseFileRequest {
    export const type =
        new RequestType<string, EditorOperationResponse, void, void>(
            'editor/closeFile');
}

export namespace SaveFileRequest {
    export const type =
        new RequestType<string, EditorOperationResponse, void, void>(
            'editor/saveFile');
}

export namespace ShowErrorMessageRequest {
    export const type =
        new RequestType<string, EditorOperationResponse, void, void>(
            'editor/showErrorMessage');
}

export namespace ShowWarningMessageRequest {
    export const type =
        new RequestType<string, EditorOperationResponse, void, void>(
            'editor/showWarningMessage');
}

export namespace ShowInformationMessageRequest {
    export const type =
        new RequestType<string, EditorOperationResponse, void, void>(
            'editor/showInformationMessage');
}

export namespace SetStatusBarMessageRequest {
    export const type =
        new RequestType<StatusBarMessageDetails, EditorOperationResponse, void, void>(
            'editor/setStatusBarMessage');
}

export interface StatusBarMessageDetails {
    message: string;
    timeout?: number;
}
interface InvokeRegisteredEditorCommandParameter{
    commandName : string
}

export class ExtensionCommandsFeature implements IFeature {

    private command: vscode.Disposable;
    private command2: vscode.Disposable;
    private languageClient: LanguageClient;
    private extensionCommands: ExtensionCommand[] = [];

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
        this.command2 = vscode.commands.registerCommand('PowerShell.InvokeRegisteredEditorCommand',(param : InvokeRegisteredEditorCommandParameter) => {
            if(this.extensionCommands.length == 0){
                return;
            }

            let commandToExecute = this.extensionCommands.find(x => x.name === param.commandName);

            if(commandToExecute){
                this.languageClient.sendRequest(
                    InvokeExtensionCommandRequest.type,
                    { name: commandToExecute.name,
                    context: this.getEditorContext() });
            }
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
		        NewFileRequest.type,
                filePath => this.newFile());

            this.languageClient.onRequest(
                OpenFileRequest.type,
                filePath => this.openFile(filePath));

            this.languageClient.onRequest(
                CloseFileRequest.type,
                filePath => this.closeFile(filePath));

            this.languageClient.onRequest(
                SaveFileRequest.type,
                filePath => this.saveFile(filePath));

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
        this.command2.dispose();
    }

    private addExtensionCommand(command: ExtensionCommandAddedNotificationBody) {

        this.extensionCommands.push({
            name: command.name,
            displayName: command.displayName
        });

        this.extensionCommands.sort(
            (a: ExtensionCommand, b: ExtensionCommand) =>
                a.name.localeCompare(b.name));
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
                    description: command.name,
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
            currentFilePath: vscode.window.activeTextEditor.document.uri.toString(),
            cursorPosition: asPosition(vscode.window.activeTextEditor.selection.active),
            selectionRange:
                asRange(
                    new vscode.Range(
                        vscode.window.activeTextEditor.selection.start,
                        vscode.window.activeTextEditor.selection.end))
        }
    }

    private newFile(): Thenable<EditorOperationResponse> {
        return vscode.workspace.openTextDocument({ content: ''})
                     .then(doc => vscode.window.showTextDocument(doc))
                     .then(_ => EditorOperationResponse.Completed);
    }

    private openFile(filePath: string): Thenable<EditorOperationResponse> {

        filePath = this.normalizeFilePath(filePath);

        var promise =
            vscode.workspace.openTextDocument(filePath)
                .then(doc => vscode.window.showTextDocument(doc))
                .then(_ => EditorOperationResponse.Completed);

        return promise;
    }

    private closeFile(filePath: string): Thenable<EditorOperationResponse> {

        var promise: Thenable<EditorOperationResponse>;
        if (this.findTextDocument(this.normalizeFilePath(filePath)))
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

    private saveFile(filePath: string): Thenable<EditorOperationResponse> {

        var promise: Thenable<EditorOperationResponse>;
        if (this.findTextDocument(this.normalizeFilePath(filePath)))
        {
            promise =
                vscode.workspace.openTextDocument(filePath)
                    .then(doc => {
                        if (doc.isDirty) {
                            doc.save();
                        }
                    })
                    .then(_ => EditorOperationResponse.Completed);
        }
        else
        {
            promise = Promise.resolve(EditorOperationResponse.Completed);
        }

        return promise;
    }

    private normalizeFilePath(filePath: string): string {
        var platform = os.platform();
        if (platform == "win32") {
            // Make sure the file path is absolute
            if (!path.win32.isAbsolute(filePath))
            {
                filePath = path.win32.resolve(
                    vscode.workspace.rootPath,
                    filePath);
            }

            // Normalize file path case for comparison for Windows
            return filePath.toLowerCase();
        } else {
            // Make sure the file path is absolute
            if (!path.isAbsolute(filePath))
            {
                filePath = path.resolve(
                    vscode.workspace.rootPath,
                    filePath);
            }

            //macOS is case-insensitive
            if (platform == "darwin") {
                filePath = filePath.toLowerCase();
            }

            return  filePath;
        }
    }

    private findTextDocument(filePath: string): boolean {
        // since Windows and macOS are case-insensitive, we need to normalize them differently
        var canFind = vscode.workspace.textDocuments.find(doc => {
            var docPath, platform = os.platform();
            if (platform == "win32" || platform == "darwin") {
                // for Windows and macOS paths, they are normalized to be lowercase
                docPath = doc.fileName.toLowerCase();
            } else {
                docPath = doc.fileName;
            }
            return docPath == filePath;
        });

        return canFind != null;
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
