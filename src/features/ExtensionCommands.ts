// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

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
import { DebugConfig, DebugConfigurations } from "./DebugSession";

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

// NOTE: The server at least now expects this response, but it's not used in any
// way. In the future we could actually communicate an error to the user.
enum EditorOperationResponse {
    Completed,
    Failed
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
    private statusBarMessages: vscode.Disposable[] = [];
    private extensionCommands: IExtensionCommand[] = [];

    constructor(private logger: ILogger) {
        super();
        this.commands = [
            vscode.commands.registerCommand("PowerShell.ShowAdditionalCommands", async () => {
                await this.showExtensionCommands();
            }),

            vscode.commands.registerCommand("PowerShell.InvokeRegisteredEditorCommand",
                async (param: IInvokeRegisteredEditorCommandParameter) => {
                    const commandToExecute = this.extensionCommands.find(
                        (x) => x.name === param.commandName);

                    if (commandToExecute) {

                        const client = await LanguageClientConsumer.getLanguageClient();
                        await client.sendRequest(
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
                    await vscode.debug.startDebugging(undefined, DebugConfigurations[DebugConfig.LaunchCurrentFile]);
                })
        ];
    }

    public override onLanguageClientSet(languageClient: LanguageClient): void {
        // Clear the current list of extension commands since they were
        // only relevant to the previous session
        this.extensionCommands = [];
        this.handlers = [
            languageClient.onNotification(
                ExtensionCommandAddedNotificationType,
                (command) => { this.addExtensionCommand(command); }),

            languageClient.onRequest(
                GetEditorContextRequestType,
                (_details) => this.getEditorContext()),

            languageClient.onRequest(
                InsertTextRequestType,
                (details) => this.insertText(details)),

            languageClient.onRequest(
                SetSelectionRequestType,
                (details) => this.setSelection(details)),

            languageClient.onRequest(
                NewFileRequestType,
                (_content) => this.newFile(_content)),

            languageClient.onRequest(
                OpenFileRequestType,
                (filePath) => this.openFile(filePath)),

            languageClient.onRequest(
                CloseFileRequestType,
                (filePath) => this.closeFile(filePath)),

            languageClient.onRequest(
                SaveFileRequestType,
                (saveFileDetails) => this.saveFile(saveFileDetails)),

            languageClient.onRequest(
                ShowInformationMessageRequestType,
                (message) => this.showInformationMessage(message)),

            languageClient.onRequest(
                ShowErrorMessageRequestType,
                (message) => this.showErrorMessage(message)),

            languageClient.onRequest(
                ShowWarningMessageRequestType,
                (message) => this.showWarningMessage(message)),

            languageClient.onRequest(
                SetStatusBarMessageRequestType,
                (messageDetails) => this.setStatusBarMessage(messageDetails)),

            languageClient.onNotification(
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

    public dispose(): void {
        for (const command of this.commands) {
            command.dispose();
        }
        for (const handler of this.handlers) {
            handler.dispose();
        }
        for (const statusBarMessage of this.statusBarMessages) {
            statusBarMessage.dispose();
        }
    }

    private addExtensionCommand(command: IExtensionCommandAddedNotificationBody): void {
        this.extensionCommands.push({
            name: command.name,
            displayName: command.displayName,
        });

        this.extensionCommands.sort(
            (a: IExtensionCommand, b: IExtensionCommand) =>
                a.name.localeCompare(b.name));
    }

    private async showExtensionCommands(): Promise<void> {
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
            { placeHolder: "Select a command..." });

        return this.onCommandSelected(selectedCommand);
    }

    private async onCommandSelected(chosenItem?: IExtensionCommandQuickPickItem): Promise<void> {
        if (chosenItem !== undefined) {
            const client = await LanguageClientConsumer.getLanguageClient();
            await client.sendRequest(
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

    private async newFile(content: string): Promise<EditorOperationResponse> {
        const doc = await vscode.workspace.openTextDocument(
            { language: "powershell", content: content });
        await vscode.window.showTextDocument(doc);
        return EditorOperationResponse.Completed;
    }

    private async openFile(openFileDetails: IOpenFileDetails): Promise<EditorOperationResponse> {
        const filePath = await this.resolveFilePathWithCwd(openFileDetails.filePath);
        try {
            const doc = await vscode.workspace.openTextDocument(filePath);
            await vscode.window.showTextDocument(doc, { preview: openFileDetails.preview });
        } catch {
            void this.logger.writeAndShowWarning(`File to open not found: ${filePath}`);
            return EditorOperationResponse.Failed;
        }
        return EditorOperationResponse.Completed;
    }

    private async closeFile(filePath: string): Promise<EditorOperationResponse> {
        filePath = await this.resolveFilePathWithCwd(filePath);
        const doc = vscode.workspace.textDocuments.find((x) => x.uri.fsPath === filePath);
        if (doc != undefined && !doc.isClosed) {
            await vscode.window.showTextDocument(doc);
            await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
            return EditorOperationResponse.Completed;
        }
        void this.logger.writeAndShowWarning(`File to close not found or already closed: ${filePath}`);
        return EditorOperationResponse.Failed;
    }

    /**
     * Save a file, possibly to a new path. If the save is not possible, return a completed response
     * @param saveFileDetails the object detailing the path of the file to save and optionally its new path to save to
     */
    private async saveFile(saveFileDetails: ISaveFileDetails): Promise<EditorOperationResponse> {
        // Try to interpret the filePath as a URI, defaulting to "file://" if we don't succeed
        let currentFileUri: vscode.Uri;
        if (saveFileDetails.filePath.startsWith("untitled") || saveFileDetails.filePath.startsWith("file")) {
            currentFileUri = vscode.Uri.parse(saveFileDetails.filePath);
        } else {
            const filePath = await this.resolveFilePathWithCwd(saveFileDetails.filePath);
            currentFileUri = vscode.Uri.file(filePath);
        }

        const doc = vscode.workspace.textDocuments.find((x) => x.uri.fsPath === currentFileUri.fsPath);
        if (doc === undefined) {
            void this.logger.writeAndShowWarning(`File to save not found: ${currentFileUri.fsPath}`);
            return EditorOperationResponse.Failed;
        }

        let newFilePath = saveFileDetails.newPath ?? undefined; // Otherwise it's null.
        if (currentFileUri.scheme === "file") {
            // If no newFile is given, just save the current file
            if (newFilePath === undefined) {
                if (doc.isDirty) {
                    await doc.save();
                }
                return EditorOperationResponse.Completed;
            }

            // Special case where we interpret a path as relative to the current
            // file, not the CWD!
            if (!path.isAbsolute(newFilePath)) {
                newFilePath = path.join(path.dirname(currentFileUri.fsPath), newFilePath);
            }
        } else if (currentFileUri.scheme === "untitled") {
            // We need a new name to save an untitled file
            if (newFilePath === undefined) {
                void this.logger.writeAndShowWarning("Cannot save untitled file! Try SaveAs(\"path/to/file.ps1\") instead.");
                return EditorOperationResponse.Failed;
            }

            newFilePath = await this.resolveFilePathWithCwd(newFilePath);
        } else {
            // Other URI schemes are not supported
            const msg = JSON.stringify(saveFileDetails, undefined, 2);
            void this.logger.writeAndShowWarning(
                `<${ExtensionCommandsFeature.name}>: Saving a document with scheme '${currentFileUri.scheme}' ` +
                `is currently unsupported. Message: '${msg}'`);
            return EditorOperationResponse.Failed;
        }

        return await this.saveFileAs(doc, newFilePath);
    }

    /**
     * Take a document available to vscode at the given URI and save it to the given absolute path
     * @param documentUri the URI of the vscode document to save
     * @param filePath the absolute path to save the document contents to
     */
    private async saveFileAs(doc: vscode.TextDocument, filePath: string): Promise<EditorOperationResponse> {
        // Write the old document's contents to the new document path
        const newFileUri = vscode.Uri.file(filePath);
        try {
            await vscode.workspace.fs.writeFile(
                newFileUri,
                Buffer.from(doc.getText()));
        } catch (err) {
            void this.logger.writeAndShowWarning(`<${ExtensionCommandsFeature.name}>: ` +
                `Unable to save file to path '${filePath}': ${err}`);
            return EditorOperationResponse.Failed;
        }

        // Finally open the new document
        const newFile = await vscode.workspace.openTextDocument(newFileUri);
        await vscode.window.showTextDocument(newFile, { preview: true });
        return EditorOperationResponse.Completed;
    }

    // Resolve file path against user's CWD setting
    private async resolveFilePathWithCwd(filePath: string): Promise<string> {
        if (!path.isAbsolute(filePath)) {
            const cwd = await validateCwdSetting(this.logger);
            return path.resolve(cwd, filePath);
        }
        return filePath;
    }

    private setSelection(details: ISetSelectionRequestArguments): EditorOperationResponse {
        if (vscode.window.activeTextEditor !== undefined) {
            vscode.window.activeTextEditor.selections = [
                new vscode.Selection(
                    asCodePosition(details.selectionRange.start),
                    asCodePosition(details.selectionRange.end)),
            ];
            return EditorOperationResponse.Completed;
        }
        return EditorOperationResponse.Failed;
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
            this.statusBarMessages.push(
                vscode.window.setStatusBarMessage(messageDetails.message, messageDetails.timeout));
        } else {
            this.statusBarMessages.push(
                vscode.window.setStatusBarMessage(messageDetails.message));
        }
        return EditorOperationResponse.Completed;
    }
}
