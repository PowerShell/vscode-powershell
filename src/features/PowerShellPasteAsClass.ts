import * as vscode from 'vscode';
import * as clipboard from 'copy-paste';
import { LanguageClient, RequestType, NotificationType } from 'vscode-languageclient';
import Window = vscode.window;

export function registerPowerShellPasteAsClass(client: LanguageClient): void {
    var disposable = vscode.commands.registerCommand('PowerShell.PowerShellPasteAsClass', () => {
        Window.showInformationMessage(clipboard.paste());
    });
}