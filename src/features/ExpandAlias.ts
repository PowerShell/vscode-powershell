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
		var text, range;
		
		var sls = selection.start;
		var sle = selection.end;
		
		if(
			(sls.character === sle.character ) &&
			(sls.line === sle.line)
		) {
			text  = document.getText();		
			range = new vscode.Range(0, 0, document.lineCount, text.length);		
		} else {
			text  = document.getText(selection);		
			range = new vscode.Range(sls.line, sls.character, sle.line, sle.character);		
		}
						
		client.sendRequest(ExpandAliasRequest.type, text).then((result) => {		
			editor.edit((editBuilder) => {				
				editBuilder.replace(range, result);
			});
		});	
    });
}