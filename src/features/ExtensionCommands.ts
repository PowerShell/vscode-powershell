// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import * as os from "os";
import * as path from "path";
import * as vscode from "vscode";
import {
    NotificationType, NotificationType0,
    Position, Range, RequestType
} from "vscode-languageclient";
import { LanguageClient } from "vscode-languageclient/node";
import { ILogger } from "../logging";
import { getSettings, validateCwdSetting } from "../settings";
import { LanguageClientConsumer } from "../languageClientConsumer";

export interface IExtensionCommand {
    name: string;
    displayName: string;
}

export interface IExtensionCommandQuickPickItem extends vscode.QuickPickItem {
    command: IExtensionCommand;
}

export const InvokeExtensionCommandRequestType =
    new RequestType<IInvokeExtensionCommandRequestArguments, void, void>(
        "powerShell/invokeExtensionCommand");

export interface IEditorContext {
    currentFileContent: string;
    currentFileLanguage: string;
    currentFilePath: string;
    cursorPosition: Position | undefined | null;
    selectionRange: Range | undefined | null;
}

export interface IInvokeExtensionCommandRequestArguments {
    name: string;
    context: IEditorContext;
}

export const ExtensionCommandAddedNotificationType =
    new NotificationType<IExtensionCommandAddedNotificationBody>(
        "powerShell/extensionCommandAdded");

export interface IExtensionCommandAddedNotificationBody {
    name: string;
    displayName: string;
}

function asRange(value: vscode.Range): Range {
    return { start: asPosition(value.start), end: asPosition(value.end) };
}

function asPosition(value: vscode.Position): Position {
    return { line: value.line, character: value.character };
}

function asCodePosition(value: Position): vscode.Position {
    return new vscode.Position(value.line, value.character);
}

export const GetEditorContextRequestType =
    new RequestType<IGetEditorContextRequestArguments, IEditorContext, void>(
        "editor/getEditorContext");

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface IGetEditorContextRequestArguments {
}

enum EditorOperationResponse {
    Unsupported = 0,
    Completed,
}

export const InsertTextRequestType =
    new RequestType<IInsertTextRequestArguments, EditorOperationResponse, void>(
        "editor/insertText");

export interface IInsertTextRequestArguments {
    filePath: string;
    insertText: string;
    insertRange: Range;
}

export const SetSelectionRequestType =
    new RequestType<ISetSelectionRequestArguments, EditorOperationResponse, void>(
        "editor/setSelection");

export interface ISetSelectionRequestArguments {
    selectionRange: Range;
}

export const OpenFileRequestType =
    new RequestType<IOpenFileDetails, EditorOperationResponse, void>(
        "editor/openFile");

export interface IOpenFileDetails {
    filePath: string;
    preview: boolean;
}

export const NewFileRequestType =
    new RequestType<string, EditorOperationResponse, void>(
        "editor/newFile");

export const CloseFileRequestType =
    new RequestType<string, EditorOperationResponse, void>(
        "editor/closeFile");

export const SaveFileRequestType =
    new RequestType<ISaveFileDetails, EditorOperationResponse, void>(
        "editor/saveFile");

export const ShowErrorMessageRequestType =
    new RequestType<string, EditorOperationResponse, void>(
        "editor/showErrorMessage");

export const ShowWarningMessageRequestType =
    new RequestType<string, EditorOperationResponse, void>(
        "editor/showWarningMessage");

export const ShowInformationMessageRequestType =
    new RequestType<string, EditorOperationResponse, void>(
        "editor/showInformationMessage");

export const SetStatusBarMessageRequestType =
    new RequestType<IStatusBarMessageDetails, EditorOperationResponse, void>(
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
    private commands: vscode.Disposable[];
    private handlers: vscode.Disposable[] = [];
    private extensionCommands: IExtensionCommand[] = [];

    constructor(private logger: ILogger) {
        super();
        this.commands = [
            vscode.commands.registerCommand("PowerShell.ShowAdditionalCommands", async () => {
                if (this.languageClient !== undefined) {
                    await this.showExtensionCommands(this.languageClient);
                }
            }),

            vscode.commands.registerCommand("PowerShell.InvokeRegisteredEditorCommand",
                async (param: IInvokeRegisteredEditorCommandParameter) => {
                    if (this.extensionCommands.length === 0) {
                        return;
                    }

                    const commandToExecute = this.extensionCommands.find((x) => x.name === param.commandName);

                    if (commandToExecute) {
                        await this.languageClient?.sendRequest(
                            InvokeExtensionCommandRequestType,
                            {
                                name: commandToExecute.name,
                                context: this.getEditorContext()
                            });
                    }
                }),

            vscode.commands.registerCommand("PowerShell.ClosePanel",
                async () => { await vscode.commands.executeCommand("workbench.action.togglePanel"); }),

            vscode.commands.registerCommand("PowerShell.PositionPanelLeft",
                async () => { await vscode.commands.executeCommand("workbench.action.positionPanelLeft"); }),

            vscode.commands.registerCommand("PowerShell.PositionPanelBottom",
                async () => { await vscode.commands.executeCommand("workbench.action.positionPanelBottom"); }),

            vscode.commands.registerCommand("PowerShell.Debug.Start",
                async () => {
                    // TODO: Use a named debug configuration.
                    await vscode.debug.startDebugging(undefined, {
                        name: "PowerShell: Launch Current File",
                        type: "PowerShell",
                        request: "launch",
                        script: "${file}",
                    });
                })
        ];
    }

    public override setLanguageClient(languageclient: LanguageClient) {
        // Clear the current list of extension commands since they were
        // only relevant to the previous session
        this.extensionCommands = [];

        this.languageClient = languageclient;

        this.handlers = [
            this.languageClient.onNotification(
                ExtensionCommandAddedNotificationType,
                (command) => this.addExtensionCommand(command)),

            this.languageClient.onRequest(
                GetEditorContextRequestType,
                (_details) => this.getEditorContext()),

            this.languageClient.onRequest(
                InsertTextRequestType,
                (details) => this.insertText(details)),

            this.languageClient.onRequest(
                SetSelectionRequestType,
                (details) => this.setSelection(details)),

            this.languageClient.onRequest(
                NewFileRequestType,
                // TODO: Shouldn't this use the file path?
                (_filePath) => this.newFile()),

            this.languageClient.onRequest(
                OpenFileRequestType,
                (filePath) => this.openFile(filePath)),

            this.languageClient.onRequest(
                CloseFileRequestType,
                (filePath) => this.closeFile(filePath)),

            this.languageClient.onRequest(
                SaveFileRequestType,
                (saveFileDetails) => this.saveFile(saveFileDetails)),

            this.languageClient.onRequest(
                ShowInformationMessageRequestType,
                (message) => this.showInformationMessage(message)),

            this.languageClient.onRequest(
                ShowErrorMessageRequestType,
                (message) => this.showErrorMessage(message)),

            this.languageClient.onRequest(
                ShowWarningMessageRequestType,
                (message) => this.showWarningMessage(message)),

            this.languageClient.onRequest(
                SetStatusBarMessageRequestType,
                (messageDetails) => this.setStatusBarMessage(messageDetails)),

            this.languageClient.onNotification(
                ClearTerminalNotificationType,
                () => {
                    // We check to see if they have TrueClear on. If not, no-op because the
                    // overriden Clear-Host already calls [System.Console]::Clear()
                    if (getSettings().integratedConsole.forceClearScrollbackBuffer) {
                        void vscode.commands.executeCommand("workbench.action.terminal.clear");
                    }
                })
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

    private addExtensionCommand(command: IExtensionCommandAddedNotificationBody) {
        this.extensionCommands.push({
            name: command.name,
            displayName: command.displayName,
        });

        this.extensionCommands.sort(
            (a: IExtensionCommand, b: IExtensionCommand) =>
                a.name.localeCompare(b.name));
    }

    private async showExtensionCommands(client: LanguageClient): Promise<void> {
        // If no extension commands are available, show a message
        if (this.extensionCommands.length === 0) {
            void this.logger.writeAndShowInformation("No extension commands have been loaded into the current session.");
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

        const selectedCommand = await vscode.window.showQuickPick(
            quickPickItems,
            { placeHolder: "Select a command" });
        return this.onCommandSelected(selectedCommand, client);
    }

    private async onCommandSelected(
        chosenItem: IExtensionCommandQuickPickItem | undefined,
        client: LanguageClient | undefined) {

        if (chosenItem !== undefined) {
            await client?.sendRequest(
                InvokeExtensionCommandRequestType,
                {
                    name: chosenItem.command.name,
                    context: this.getEditorContext()
                });
        }
    }

    private async insertText(details: IInsertTextRequestArguments): Promise<EditorOperationResponse> {
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

        await vscode.workspace.applyEdit(edit);

        return EditorOperationResponse.Completed;
    }

    private getEditorContext(): IEditorContext | undefined {
        if (vscode.window.activeTextEditor === undefined) {
            return undefined;
        }

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

    private async newFile(): Promise<EditorOperationResponse> {
        const doc = await vscode.workspace.openTextDocument({ content: "" });
        await vscode.window.showTextDocument(doc);
        return EditorOperationResponse.Completed;
    }

    private async openFile(openFileDetails: IOpenFileDetails): Promise<EditorOperationResponse> {
        const filePath = await this.normalizeFilePath(openFileDetails.filePath);
        const doc = await vscode.workspace.openTextDocument(filePath);
        await vscode.window.showTextDocument(doc, { preview: openFileDetails.preview });
        return EditorOperationResponse.Completed;
    }

    private async closeFile(filePath: string): Promise<EditorOperationResponse> {
        if (this.findTextDocument(await this.normalizeFilePath(filePath))) {
            const doc = await vscode.workspace.openTextDocument(filePath);
            await vscode.window.showTextDocument(doc);
            await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
        }
        return EditorOperationResponse.Completed;
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
        case "file": {
            // If the file to save can't be found, just complete the request
            if (!this.findTextDocument(await this.normalizeFilePath(currentFileUri.fsPath))) {
                void this.logger.writeAndShowError(`File to save not found: ${currentFileUri.fsPath}.`);
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
            break; }

        case "untitled": {
            // We need a new name to save an untitled file
            if (!saveFileDetails.newPath) {
                // TODO: Create a class handle vscode warnings and errors so we can warn easily
                //       without logging
                void this.logger.writeAndShowWarning("Cannot save untitled file. Try SaveAs(\"path/to/file.ps1\") instead.");
                return EditorOperationResponse.Completed;
            }

            // Make sure we have an absolute path
            if (path.isAbsolute(saveFileDetails.newPath)) {
                newFileAbsolutePath = saveFileDetails.newPath;
            } else {
                const cwd = await validateCwdSetting(this.logger);
                newFileAbsolutePath = path.join(cwd, saveFileDetails.newPath);
            }
            break; }

        default: {
            // Other URI schemes are not supported
            const msg = JSON.stringify(saveFileDetails);
            this.logger.writeVerbose(
                `<${ExtensionCommandsFeature.name}>: Saving a document with scheme '${currentFileUri.scheme}' ` +
                        `is currently unsupported. Message: '${msg}'`);
            return EditorOperationResponse.Completed; }
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
            await vscode.workspace.fs.writeFile(
                vscode.Uri.file(destinationAbsolutePath),
                Buffer.from(oldDocument.getText()));
        } catch (e) {
            void this.logger.writeAndShowWarning(`<${ExtensionCommandsFeature.name}>: ` +
                `Unable to save file to path '${destinationAbsolutePath}': ${e}`);
            return;
        }

        // Finally open the new document
        const newFileUri = vscode.Uri.file(destinationAbsolutePath);
        const newFile = await vscode.workspace.openTextDocument(newFileUri);
        await vscode.window.showTextDocument(newFile, { preview: true });
    }

    private async normalizeFilePath(filePath: string): Promise<string> {
        const cwd = await validateCwdSetting(this.logger);
        const platform = os.platform();
        if (platform === "win32") {
            // Make sure the file path is absolute
            if (!path.win32.isAbsolute(filePath)) {
                filePath = path.win32.resolve(cwd, filePath);
            }

            // Normalize file path case for comparison for Windows
            return filePath.toLowerCase();
        } else {
            // Make sure the file path is absolute
            if (!path.isAbsolute(filePath)) {
                filePath = path.resolve(cwd, filePath);
            }

            // macOS is case-insensitive
            if (platform === "darwin") {
                filePath = filePath.toLowerCase();
            }

            return filePath;
        }
    }

    private findTextDocument(filePath: string): boolean {
        // since Windows and macOS are case-insensitive, we need to normalize them differently
        const canFind = vscode.workspace.textDocuments.find((doc) => {
            let docPath: string;
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
        if (vscode.window.activeTextEditor !== undefined) {
            vscode.window.activeTextEditor.selections = [
                new vscode.Selection(
                    asCodePosition(details.selectionRange.start)!,
                    asCodePosition(details.selectionRange.end)!),
            ];
        }

        return EditorOperationResponse.Completed;
    }

    private showInformationMessage(message: string): EditorOperationResponse {
        void this.logger.writeAndShowInformation(message);
        return EditorOperationResponse.Completed;
    }

    private showErrorMessage(message: string): EditorOperationResponse {
        void this.logger.writeAndShowError(message);
        return EditorOperationResponse.Completed;
    }

    private showWarningMessage(message: string): EditorOperationResponse {
        void this.logger.writeAndShowWarning(message);
        return EditorOperationResponse.Completed;
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
