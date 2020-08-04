/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as vscode from "vscode";
import { NotificationType, NotificationType0,
    Position, Range, RequestType } from "vscode-languageclient";
import { LanguageClient } from "vscode-languageclient/node";
import { Logger } from "../logging";
import Settings = require("../settings");
import { LanguageClientConsumer } from "../languageClientConsumer";

export interface IExtensionCommand {
    name: string;
    displayName: string;
}

export interface IExtensionCommandQuickPickItem extends vscode.QuickPickItem {
    command: IExtensionCommand;
}

export const InvokeExtensionCommandRequestType =
    new RequestType<IInvokeExtensionCommandRequestArguments, void, void, void>(
        "powerShell/invokeExtensionCommand");

export interface IEditorContext {
    currentFileContent: string;
    currentFileLanguage: string;
    currentFilePath: string;
    cursorPosition: Position;
    selectionRange: Range;
}

export interface IInvokeExtensionCommandRequestArguments {
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

export const ClearTerminalNotificationType =
        new NotificationType0("editor/clearTerminal");

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

export class ExtensionCommandsFeature extends LanguageClientConsumer {

    private command: vscode.Disposable;
    private command2: vscode.Disposable;
    private extensionCommands: IExtensionCommand[] = [];

    constructor(private log: Logger) {
        super();
        this.command = vscode.commands.registerCommand("PowerShell.ShowAdditionalCommands", () => {

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

            this.languageClient.onNotification(
                ClearTerminalNotificationType,
                () => {
                    // We check to see if they have TrueClear on. If not, no-op because the
                    // overriden Clear-Host already calls [System.Console]::Clear()
                    if (Settings.load().integratedConsole.forceClearScrollbackBuffer) {
                        vscode.commands.executeCommand("workbench.action.terminal.clear");
                    }
                });
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

    private showExtensionCommands(client: LanguageClient): Thenable<IInvokeExtensionCommandRequestArguments> {

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
            currentFileContent: vscode.window.activeTextEditor.document.getText(),
            currentFileLanguage: vscode.window.activeTextEditor.document.languageId,
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

    /**
     * Save a file, possibly to a new path. If the save is not possible, return a completed response
     * @param saveFileDetails the object detailing the path of the file to save and optionally its new path to save to
     */
    private async saveFile(saveFileDetails: ISaveFileDetails): Promise<EditorOperationResponse> {
        // Try to interpret the filepath as a URI, defaulting to "file://" if we don't succeed
        let currentFileUri: vscode.Uri;
        if (saveFileDetails.filePath.startsWith("untitled") || saveFileDetails.filePath.startsWith("file")) {
            currentFileUri = vscode.Uri.parse(saveFileDetails.filePath);
        } else {
            currentFileUri = vscode.Uri.file(saveFileDetails.filePath);
        }

        let newFileAbsolutePath: string;
        switch (currentFileUri.scheme) {
            case "file":
                // If the file to save can't be found, just complete the request
                if (!this.findTextDocument(this.normalizeFilePath(currentFileUri.fsPath))) {
                    this.log.writeAndShowError(`File to save not found: ${currentFileUri.fsPath}.`);
                    return EditorOperationResponse.Completed;
                }

                // If no newFile is given, just save the current file
                if (!saveFileDetails.newPath) {
                    const doc = await vscode.workspace.openTextDocument(currentFileUri.fsPath);
                    if (doc.isDirty) {
                        await doc.save();
                    }
                    return EditorOperationResponse.Completed;
                }

                // Make sure we have an absolute path
                if (path.isAbsolute(saveFileDetails.newPath)) {
                    newFileAbsolutePath = saveFileDetails.newPath;
                } else {
                    // If not, interpret the path as relative to the current file
                    newFileAbsolutePath = path.join(path.dirname(currentFileUri.fsPath), saveFileDetails.newPath);
                }
                break;

            case "untitled":
                // We need a new name to save an untitled file
                if (!saveFileDetails.newPath) {
                    // TODO: Create a class handle vscode warnings and errors so we can warn easily
                    //       without logging
                    this.log.writeAndShowWarning(
                        "Cannot save untitled file. Try SaveAs(\"path/to/file.ps1\") instead.");
                    return EditorOperationResponse.Completed;
                }

                // Make sure we have an absolute path
                if (path.isAbsolute(saveFileDetails.newPath)) {
                    newFileAbsolutePath = saveFileDetails.newPath;
                } else {
                    // In fresh contexts, workspaceFolders is not defined...
                    if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
                        this.log.writeAndShowWarning("Cannot save file to relative path: no workspaces are open. " +
                            "Try saving to an absolute path, or open a workspace.");
                        return EditorOperationResponse.Completed;
                    }

                    // If not, interpret the path as relative to the workspace root
                    const workspaceRootUri = vscode.workspace.workspaceFolders[0].uri;
                    // We don't support saving to a non-file URI-schemed workspace
                    if (workspaceRootUri.scheme !== "file") {
                        this.log.writeAndShowWarning(
                            "Cannot save untitled file to a relative path in an untitled workspace. " +
                            "Try saving to an absolute path or opening a workspace folder.");
                        return EditorOperationResponse.Completed;
                    }
                    newFileAbsolutePath = path.join(workspaceRootUri.fsPath, saveFileDetails.newPath);
                }
                break;

            default:
                // Other URI schemes are not supported
                const msg = JSON.stringify(saveFileDetails);
                this.log.writeVerbose(
                    `<${ExtensionCommandsFeature.name}>: Saving a document with scheme '${currentFileUri.scheme}' ` +
                    `is currently unsupported. Message: '${msg}'`);
                return EditorOperationResponse.Completed;
        }

        await this.saveDocumentContentToAbsolutePath(currentFileUri, newFileAbsolutePath);
        return EditorOperationResponse.Completed;

    }

    /**
     * Take a document available to vscode at the given URI and save it to the given absolute path
     * @param documentUri the URI of the vscode document to save
     * @param destinationAbsolutePath the absolute path to save the document contents to
     */
    private async saveDocumentContentToAbsolutePath(
        documentUri: vscode.Uri,
        destinationAbsolutePath: string): Promise<void> {
            // Retrieve the text out of the current document
            const oldDocument = await vscode.workspace.openTextDocument(documentUri);

            // Write it to the new document path
            try {
                // TODO: Change this to be asyncronous
                await new Promise<void>((resolve, reject) => {
                    fs.writeFile(destinationAbsolutePath, oldDocument.getText(), (err) => {
                        if (err) {
                            return reject(err);
                        }
                        return resolve();
                    });
                });
            } catch (e) {
                this.log.writeAndShowWarning(`<${ExtensionCommandsFeature.name}>: ` +
                    `Unable to save file to path '${destinationAbsolutePath}': ${e}`);
                return;
            }

            // Finally open the new document
            const newFileUri = vscode.Uri.file(destinationAbsolutePath);
            const newFile = await vscode.workspace.openTextDocument(newFileUri);
            vscode.window.showTextDocument(newFile, { preview: true });
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
