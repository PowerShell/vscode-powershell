import vscode = require('vscode');
import { LanguageClient } from 'vscode-languageclient';
import { RequestType, NotificationType, ResponseError } from 'vscode-jsonrpc';

export namespace ShowOnlineHelpRequest {
    export const type: RequestType<string, void, void> = { get method() { return 'powerShell/showOnlineHelp'; } };
}

export function registerShowHelpCommand(client: LanguageClient): void {
    var disposable = vscode.commands.registerCommand('PowerShell.OnlineHelp', () => {

        const editor = vscode.window.activeTextEditor;

        var selection = editor.selection;
        var doc = editor.document;
        var cwr = doc.getWordRangeAtPosition(selection.active)
        var text = doc.getText(cwr);

        client.sendRequest(ShowOnlineHelpRequest.type, text);
    });
}