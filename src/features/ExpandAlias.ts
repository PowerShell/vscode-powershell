import vscode = require('vscode');
import { LanguageClient } from 'vscode-languageclient';
import { RequestType, NotificationType, ResponseError } from 'vscode-jsonrpc';
import Window = vscode.window;

export namespace ExpandAliasRequest {
	export const type: RequestType<string, any, void> = { get method() { return 'powerShell/expandAlias'; } };
}

export function registerExpandAliasCommand(client: LanguageClient): void {
    var disposable = vscode.commands.registerCommand('PowerShell.ExpandAlias', () => {

		var editor    = Window.activeTextEditor;
		var document  = editor.document;		
		var selection = editor.selection;		
		var text      = document.getText(selection);
		var range=new vscode.Range(selection.start.line, selection.start.character, selection.end.line, selection.end.character);
				
		client.sendRequest(ExpandAliasRequest.type, text).then((result) => {		
			editor.edit((editBuilder) => {				
				editBuilder.replace(range, result);
			});
		});	
    });
}