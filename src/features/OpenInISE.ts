import vscode = require('vscode');
import { LanguageClient } from 'vscode-languageclient';
import { RequestType, NotificationType, ResponseError } from 'vscode-jsonrpc';
import Window = vscode.window;


export function registerOpenInISECommand(client: LanguageClient): void {
    var disposable = vscode.commands.registerCommand('PowerShell.OpenInISE', () => {

		var editor    = Window.activeTextEditor;
		var document  = editor.document;		

			});
}