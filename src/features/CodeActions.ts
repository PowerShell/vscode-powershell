import vscode = require('vscode');
import { LanguageClient, RequestType, NotificationType } from 'vscode-languageclient';
import Window = vscode.window;

export function registerCodeActionCommands(client: LanguageClient): void {
    vscode.commands.registerCommand('PowerShell.ApplyCodeActionEdits', (edit: any) => {
        console.log("Applying edits");
        console.log(edit);
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