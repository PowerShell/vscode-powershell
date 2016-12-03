import vscode = require('vscode');
import { LanguageClient, RequestType, NotificationType } from 'vscode-languageclient';
import Window = vscode.window;
import { IFeature } from '../feature';

export class CodeActionsFeature implements IFeature {
    private command: vscode.Disposable;
    private languageClient: LanguageClient;

    constructor() {
        this.command = vscode.commands.registerCommand('PowerShell.ApplyCodeActionEdits', (edit: any) => {
            var editor = Window.activeTextEditor;
            var filePath = editor.document.fileName;
            var workspaceEdit = new vscode.WorkspaceEdit();
            workspaceEdit.set(
                vscode.Uri.file(filePath),
                [
                    new vscode.TextEdit(
                        new vscode.Range(
                            edit.StartLineNumber - 1,
                            edit.StartColumnNumber - 1,
                            edit.EndLineNumber - 1,
                            edit.EndColumnNumber - 1),
                        edit.Text)
                ]);
            vscode.workspace.applyEdit(workspaceEdit);
        });
    }

    public setLanguageClient(languageclient: LanguageClient) {
        this.languageClient = languageclient;
    }

    public dispose() {
        this.command.dispose();
    }
}