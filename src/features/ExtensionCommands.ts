/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import os = require("os");
import path = require("path");
import vscode = require("vscode");
import { LanguageClient, NotificationType, Position, Range, RequestType } from "vscode-languageclient";
import { IFeature } from "../feature";

export interface IExtensionCommand {
    name: string;
    displayName: string;
}

export interface IExtensionCommandQuickPickItem extends vscode.QuickPickItem {
    command: IExtensionCommand;
}

export const InvokeExtensionCommandRequestType =
    new RequestType<InvokeExtensionCommandRequestArguments, void, void, void>(
        "powerShell/invokeExtensionCommand");

export interface IEditorContext {
    currentFilePath: string;
    cursorPosition: Position;
    selectionRange: Range;
}

export interface InvokeExtensionCommandRequestArguments {
    name: string;
    context: IEditorContext;
}

export const ExtensionCommandAddedNotificationType =
    new NotificationType<IExtensionCommandAddedNotificationBody, void>(
        "powerShell/extensionCommandAdded");

export interface IExtensionCommandAddedNotificationBody {
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

export const GetEditorContextRequestType =
    new RequestType<IGetEditorContextRequestArguments, IEditorContext, void, void>(
        "editor/getEditorContext");

// tslint:disable-next-line:no-empty-interface
export interface IGetEditorContextRequestArguments {
}

enum EditorOperationResponse {
    Unsupported = 0,
    Completed,
}

export const InsertTextRequestType =
    new RequestType<IInsertTextRequestArguments, EditorOperationResponse, void, void>(
        "editor/insertText");

export interface IInsertTextRequestArguments {
    filePath: string;
    insertText: string;
    insertRange: Range;
}

export const SetSelectionRequestType =
    new RequestType<ISetSelectionRequestArguments, EditorOperationResponse, void, void>(
        "editor/setSelection");

export interface ISetSelectionRequestArguments {
    selectionRange: Range;
}

export const OpenFileRequestType =
    new RequestType<IOpenFileDetails, EditorOperationResponse, void, void>(
        "editor/openFile");

export interface IOpenFileDetails {
    filePath: string;
    preview: boolean;
}

export const NewFileRequestType =
    new RequestType<string, EditorOperationResponse, void, void>(
        "editor/newFile");

export const CloseFileRequestType =
    new RequestType<string, EditorOperationResponse, void, void>(
        "editor/closeFile");

export const SaveFileRequestType =
    new RequestType<ISaveFileDetails, EditorOperationResponse, void, void>(
        "editor/saveFile");

export const ShowErrorMessageRequestType =
    new RequestType<string, EditorOperationResponse, void, void>(
        "editor/showErrorMessage");

export const ShowWarningMessageRequestType =
    new RequestType<string, EditorOperationResponse, void, void>(
        "editor/showWarningMessage");

export const ShowInformationMessageRequestType =
    new RequestType<string, EditorOperationResponse, void, void>(
        "editor/showInformationMessage");

export const SetStatusBarMessageRequestType =
    new RequestType<IStatusBarMessageDetails, EditorOperationResponse, void, void>(
        "editor/setStatusBarMessage");

export interface ISaveFileDetails {
    filePath: string;
    newPath?: string;
}

export interface IStatusBarMessageDetails {
    message: string;
    timeout?: number;
}
interface IInvokeRegisteredEditorCommandParameter {
    commandName: string;
}

export class ExtensionCommandsFeature implements IFeature {

    private command: vscode.Disposable;
    private command2: vscode.Disposable;
    private languageClient: LanguageClient;
    private extensionCommands: IExtensionCommand[] = [];

    constructor() {
        this.command = vscode.commands.registerCommand("PowerShell.ShowAdditionalCommands", () => {
            if (this.languageClient === undefined) {
                // TODO: Log error message
                return;
            }

            const editor = vscode.window.activeTextEditor;
            let start = editor.selection.start;
            const end = editor.selection.end;
            if (editor.selection.isEmpty) {
                start = new vscode.Position(start.line, 0);
            }

            this.showExtensionCommands(this.languageClient);
        });

        this.command2 = vscode.commands.registerCommand("PowerShell.InvokeRegisteredEditorCommand",
                                                        (param: IInvokeRegisteredEditorCommandParameter) => {
            if (this.extensionCommands.length === 0) {
                return;
            }

            const commandToExecute = this.extensionCommands.find((x) => x.name === param.commandName);

            if (commandToExecute) {
                this.languageClient.sendRequest(
                    InvokeExtensionCommandRequestType,
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
                ExtensionCommandAddedNotificationType,
                (command) => this.addExtensionCommand(command));

            this.languageClient.onRequest(
                GetEditorContextRequestType,
                (details) => this.getEditorContext());

            this.languageClient.onRequest(
                InsertTextRequestType,
                (details) => this.insertText(details));

            this.languageClient.onRequest(
                SetSelectionRequestType,
                (details) => this.setSelection(details));

            this.languageClient.onRequest(
                NewFileRequestType,
                (filePath) => this.newFile());

            this.languageClient.onRequest(
                OpenFileRequestType,
                (filePath) => this.openFile(filePath));

            this.languageClient.onRequest(
                CloseFileRequestType,
                (filePath) => this.closeFile(filePath));

            this.languageClient.onRequest(
                SaveFileRequestType,
                (saveFileDetails) => this.saveFile(saveFileDetails));

            this.languageClient.onRequest(
                ShowInformationMessageRequestType,
                (message) => this.showInformationMessage(message));

            this.languageClient.onRequest(
                ShowErrorMessageRequestType,
                (message) => this.showErrorMessage(message));

            this.languageClient.onRequest(
                ShowWarningMessageRequestType,
                (message) => this.showWarningMessage(message));

            this.languageClient.onRequest(
                SetStatusBarMessageRequestType,
                (messageDetails) => this.setStatusBarMessage(messageDetails));
        }
    }

    public dispose() {
        this.command.dispose();
        this.command2.dispose();
    }

    private addExtensionCommand(command: IExtensionCommandAddedNotificationBody) {

        this.extensionCommands.push({
            name: command.name,
            displayName: command.displayName,
        });

        this.extensionCommands.sort(
            (a: IExtensionCommand, b: IExtensionCommand) =>
                a.name.localeCompare(b.name));
    }

    private showExtensionCommands(client: LanguageClient): Thenable<InvokeExtensionCommandRequestArguments> {

        // If no extension commands are available, show a message
        if (this.extensionCommands.length === 0) {
            vscode.window.showInformationMessage(
                "No extension commands have been loaded into the current session.");

            return;
        }

        const quickPickItems =
            this.extensionCommands.map<IExtensionCommandQuickPickItem>((command) => {
                return {
                    label: command.displayName,
                    description: command.name,
                    command,
                };
            });

        vscode.window
            .showQuickPick(
                quickPickItems,
                { placeHolder: "Select a command" })
            .then((command) => this.onCommandSelected(command, client));
    }

    private onCommandSelected(
        chosenItem: IExtensionCommandQuickPickItem,
        client: LanguageClient) {

        if (chosenItem !== undefined) {
            client.sendRequest(
                InvokeExtensionCommandRequestType,
                { name: chosenItem.command.name,
                context: this.getEditorContext() });
        }
    }

    private insertText(details: IInsertTextRequestArguments): EditorOperationResponse {
        const edit = new vscode.WorkspaceEdit();

        edit.set(
            vscode.Uri.parse(details.filePath),
            [
                new vscode.TextEdit(
                    new vscode.Range(
                        details.insertRange.start.line,
                        details.insertRange.start.character,
                        details.insertRange.end.line,
                        details.insertRange.end.character),
                        details.insertText),
            ],
        );

        vscode.workspace.applyEdit(edit);

        return EditorOperationResponse.Completed;
    }

    private getEditorContext(): IEditorContext {
        return {
            currentFilePath: vscode.window.activeTextEditor.document.uri.toString(),
            cursorPosition: asPosition(vscode.window.activeTextEditor.selection.active),
            selectionRange:
                asRange(
                    new vscode.Range(
                        vscode.window.activeTextEditor.selection.start,
                        vscode.window.activeTextEditor.selection.end)),
        };
    }

    private newFile(): Thenable<EditorOperationResponse> {
        return vscode.workspace.openTextDocument({ content: ""})
                     .then((doc) => vscode.window.showTextDocument(doc))
                     .then((_) => EditorOperationResponse.Completed);
    }

    private openFile(openFileDetails: IOpenFileDetails): Thenable<EditorOperationResponse> {

        const filePath = this.normalizeFilePath(openFileDetails.filePath);

        const promise =
            vscode.workspace.openTextDocument(filePath)
                .then((doc) => vscode.window.showTextDocument(
                    doc,
                    { preview: openFileDetails.preview }))
                .then((_) => EditorOperationResponse.Completed);

        return promise;
    }

    private closeFile(filePath: string): Thenable<EditorOperationResponse> {

        let promise: Thenable<EditorOperationResponse>;
        if (this.findTextDocument(this.normalizeFilePath(filePath))) {
            promise =
                vscode.workspace.openTextDocument(filePath)
                    .then((doc) => vscode.window.showTextDocument(doc))
                    .then((editor) => vscode.commands.executeCommand("workbench.action.closeActiveEditor"))
                    .then((_) => EditorOperationResponse.Completed);
        } else {
            promise = Promise.resolve(EditorOperationResponse.Completed);
        }

        return promise;
    }

    private saveFile(saveFileDetails: ISaveFileDetails): Thenable<EditorOperationResponse> {

        // If the file to save can't be found, just complete the request
        if (!this.findTextDocument(this.normalizeFilePath(saveFileDetails.filePath))) {
            return Promise.resolve(EditorOperationResponse.Completed);
        }

        // If no newFile is given, just save the current file
        if (!saveFileDetails.newPath) {
            return vscode.workspace.openTextDocument(saveFileDetails.filePath)
                .then((doc) => {
                    if (doc.isDirty) {
                        doc.save();
                    }
                })
                .then((_) => EditorOperationResponse.Completed);
        }

        // Otherwise we want to save as a new file

        // First turn the path we were given into an absolute path
        // Relative paths are interpreted as relative to the original file
        const newFileAbsolutePath = path.isAbsolute(saveFileDetails.newPath) ?
            saveFileDetails.newPath :
            path.resolve(path.dirname(saveFileDetails.filePath), saveFileDetails.newPath);

        // Create an "untitled-scheme" path so that VSCode will let us create a new file with a given path
        const newFileUri = vscode.Uri.parse("untitled:" + newFileAbsolutePath);

        // Now we need to copy the content of the current file,
        // then create a new file at the given path, insert the content,
        // save it and open the document
        return vscode.workspace.openTextDocument(saveFileDetails.filePath)
            .then((oldDoc) => {
                return vscode.workspace.openTextDocument(newFileUri)
                    .then((newDoc) => {
                        return vscode.window.showTextDocument(newDoc, 1, false)
                            .then((editor) => {
                                return editor.edit((editBuilder) => {
                                    editBuilder.insert(new vscode.Position(0, 0), oldDoc.getText());
                                })
                                .then(() => {
                                    return newDoc.save()
                                        .then(() => EditorOperationResponse.Completed);
                                });
                            });
                    });
            });
    }

    private normalizeFilePath(filePath: string): string {
        const platform = os.platform();
        if (platform === "win32") {
            // Make sure the file path is absolute
            if (!path.win32.isAbsolute(filePath)) {
                filePath = path.win32.resolve(
                    vscode.workspace.rootPath,
                    filePath);
            }

            // Normalize file path case for comparison for Windows
            return filePath.toLowerCase();
        } else {
            // Make sure the file path is absolute
            if (!path.isAbsolute(filePath)) {
                filePath = path.resolve(
                    vscode.workspace.rootPath,
                    filePath);
            }

            // macOS is case-insensitive
            if (platform === "darwin") {
                filePath = filePath.toLowerCase();
            }

            return  filePath;
        }
    }

    private findTextDocument(filePath: string): boolean {
        // since Windows and macOS are case-insensitive, we need to normalize them differently
        const canFind = vscode.workspace.textDocuments.find((doc) => {
            let docPath;
            const platform = os.platform();
            if (platform === "win32" || platform === "darwin") {
                // for Windows and macOS paths, they are normalized to be lowercase
                docPath = doc.fileName.toLowerCase();
            } else {
                docPath = doc.fileName;
            }
            return docPath === filePath;
        });

        return canFind != null;
    }

    private setSelection(details: ISetSelectionRequestArguments): EditorOperationResponse {
        vscode.window.activeTextEditor.selections = [
            new vscode.Selection(
                asCodePosition(details.selectionRange.start),
                asCodePosition(details.selectionRange.end)),
        ];

        return EditorOperationResponse.Completed;
    }

    private showInformationMessage(message: string): Thenable<EditorOperationResponse> {
        return vscode.window
                     .showInformationMessage(message)
                     .then((_) => EditorOperationResponse.Completed);
    }

    private showErrorMessage(message: string): Thenable<EditorOperationResponse> {
        return vscode.window
                     .showErrorMessage(message)
                     .then((_) => EditorOperationResponse.Completed);
    }

    private showWarningMessage(message: string): Thenable<EditorOperationResponse> {
        return vscode.window
                     .showWarningMessage(message)
                     .then((_) => EditorOperationResponse.Completed);
    }

    private setStatusBarMessage(messageDetails: IStatusBarMessageDetails): EditorOperationResponse {

        if (messageDetails.timeout) {
            vscode.window.setStatusBarMessage(messageDetails.message, messageDetails.timeout);
        } else {
            vscode.window.setStatusBarMessage(messageDetails.message);
        }

        return EditorOperationResponse.Completed;
    }
}
