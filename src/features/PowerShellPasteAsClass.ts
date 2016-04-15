import * as vscode from 'vscode';
import * as clipboard from 'copy-paste';
import { LanguageClient, RequestType, NotificationType } from 'vscode-languageclient';
import Window = vscode.window;

export namespace ConvertToCSharpClassRequest {
    export const type: RequestType<string, any, void> = { get method() { return 'powerShell/convertToCSharpClass'; } };
}

export namespace ConvertToPowerShellClassRequest {
    export const type: RequestType<string, any, void> = { get method() { return 'powerShell/convertToPowerShellClass'; } };
}

export function registerPowerShellPasteAsClass(client: LanguageClient): void {
    var disposable = vscode.commands.registerCommand('PowerShell.PowerShellPasteAsClass', () => {
        let items: vscode.QuickPickItem[] = [];
        items.push({ label: 'PowerShell',  description: 'Paste from clipboard as a PowerShell class'  });
        items.push({ label: 'C#', description: 'Paste from clipboard as a C# class' });

        vscode.window.showQuickPick(items).then((qpSelection) => {
            if (!qpSelection) {
                return;
            }

            var targetRequest = ConvertToPowerShellClassRequest.type;
            if(qpSelection.label == 'C#') {
                targetRequest = ConvertToCSharpClassRequest.type;
            }

            client.sendRequest(targetRequest, clipboard.paste()).then((result) => {
                var editor = Window.activeTextEditor;
                var selection = editor.selection;
                editor.edit((editBuilder) => {
                    editBuilder.insert(new vscode.Position(selection.start.line, 0), result)
                });
            });
        });
    });
}