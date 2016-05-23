import vscode = require('vscode');
import path = require('path');
import { LanguageClient, RequestType, NotificationType, Range, Position } from 'vscode-languageclient';

export interface ExtensionCommand {
    name: string;
    displayName: string;
}

export interface ExtensionCommandQuickPickItem extends vscode.QuickPickItem {
    command: ExtensionCommand;
}

var extensionCommands: ExtensionCommand[] = [];

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

function addExtensionCommand(command: ExtensionCommandAddedNotificationBody) {

    extensionCommands.push({
        name: command.name,
        displayName: command.displayName
    });
}

function showExtensionCommands(client: LanguageClient) : Thenable<InvokeExtensionCommandRequestArguments> {

    // If no extension commands are available, show a message
    if (extensionCommands.length == 0) {
        vscode.window.showInformationMessage(
            "No extension commands have been loaded into the current session.");

        return;
    }

    var quickPickItems =
        extensionCommands.map<ExtensionCommandQuickPickItem>(command => {
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
        .then(command => onCommandSelected(command, client));
}

function onCommandSelected(
    chosenItem: ExtensionCommandQuickPickItem,
    client: LanguageClient) {

    if (chosenItem !== undefined) {
        client.sendRequest(
            InvokeExtensionCommandRequest.type,
            { name: chosenItem.command.name,
              context: getEditorContext() });
    }
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


export function asCodeRange(value: Range): vscode.Range {

	if (value === undefined) {
		return undefined;
	} else if (value === null) {
		return null;
	}
	return new vscode.Range(asCodePosition(value.start), asCodePosition(value.end));
}

export function asCodePosition(value: Position): vscode.Position {

	if (value === undefined) {
		return undefined;
	} else if (value === null) {
		return null;
	}
	return new vscode.Position(value.line, value.character);
}

function getEditorContext(): EditorContext {
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

function insertText(details: InsertTextRequestArguments): EditorOperationResponse {
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

export namespace SetSelectionRequest {
    export const type: RequestType<SetSelectionRequestArguments, EditorOperationResponse, void> =
        { get method() { return 'editor/setSelection'; } };
}

export interface SetSelectionRequestArguments {
    selectionRange: Range
}

function setSelection(details: SetSelectionRequestArguments): EditorOperationResponse {
    vscode.window.activeTextEditor.selections = [
        new vscode.Selection(
            asCodePosition(details.selectionRange.start),
            asCodePosition(details.selectionRange.end))
    ]

    return EditorOperationResponse.Completed;
}

export namespace OpenFileRequest {
    export const type: RequestType<string, EditorOperationResponse, void> =
        { get method() { return 'editor/openFile'; } };
}

function openFile(filePath: string): Thenable<EditorOperationResponse> {

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

export namespace ShowErrorMessageRequest {
    export const type: RequestType<string, EditorOperationResponse, void> =
        { get method() { return 'editor/showErrorMessage'; } };
}

function showErrorMessage(message: string): Thenable<EditorOperationResponse> {
     vscode.window.showErrorMessage(message);
     return null;
}

export namespace ShowWarningMessageRequest {
    export const type: RequestType<string, EditorOperationResponse, void> =
        { get method() { return 'editor/showWarningMessage'; } };
}

function showWarningMessage(message: string): Thenable<EditorOperationResponse> {
     vscode.window.showWarningMessage(message);
     return null;
}

export namespace ShowInformationMessageRequest {
    export const type: RequestType<string, EditorOperationResponse, void> =
        { get method() { return 'editor/showInformationMessage'; } };
}

function showInformationMessage(message: string): Thenable<EditorOperationResponse> {
     vscode.window.showInformationMessage(message);
     return null;
}

export function registerExtensionCommands(client: LanguageClient): void {

    vscode.commands.registerCommand('PowerShell.ShowAdditionalCommands', () => {
        var editor = vscode.window.activeTextEditor;
        var start = editor.selection.start;
        var end = editor.selection.end;
        if (editor.selection.isEmpty) {
            start = new vscode.Position(start.line, 0)
        }

        showExtensionCommands(client);
    });

    client.onNotification(
        ExtensionCommandAddedNotification.type,
        command => addExtensionCommand(command));

    client.onRequest(
        GetEditorContextRequest.type,
        details => getEditorContext());

    client.onRequest(
        InsertTextRequest.type,
        details => insertText(details));

    client.onRequest(
        SetSelectionRequest.type,
        details => setSelection(details));

    client.onRequest(
        OpenFileRequest.type,
        filePath => openFile(filePath));

    client.onRequest(
        ShowInformationMessageRequest.type,
        message => showInformationMessage(message));

    client.onRequest(
        ShowErrorMessageRequest.type,
        message => showErrorMessage(message));

    client.onRequest(
        ShowWarningMessageRequest.type,
        message => showWarningMessage(message));
}
