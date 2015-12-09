import vscode = require('vscode');
import { LanguageClient } from 'vscode-languageclient';
import { RequestType, NotificationType, ResponseError } from 'vscode-jsonrpc';

export namespace EvaluateRequest {
	export const type: RequestType<EvaluateRequestArguments, void, void> = 
		{ get method() { return 'evaluate'; } };
}

export interface EvaluateRequestArguments {
	expression: string;
}

export namespace OutputNotification {
	export const type: NotificationType<OutputNotificationBody> = 
		{ get method() { return 'output'; } };
}

export interface OutputNotificationBody {
	category: string;
	output: string;
}

export function registerConsoleCommands(client: LanguageClient): void {
	
	vscode.commands.registerCommand('PowerShell.RunSelection', () => {
		var editor = vscode.window.activeTextEditor;
		var start = editor.selection.start;
        	var end = editor.selection.end;
        	if(editor.selection.isEmpty){
	            start = new vscode.Position(start.line, 0)
	        }
        	client.sendRequest(EvaluateRequest.type, {
			expression: 
				editor.document.getText(
					new vscode.Range(start, end))
		});		
	});
	
	var consoleChannel = vscode.window.createOutputChannel("PowerShell Output");
	client.onNotification(OutputNotification.type, (output) => {
		var outputEditorExist = vscode.window.visibleTextEditors.some((editor) => {
	           return editor.document.languageId == 'Log'  
	        });
	        if(!outputEditorExist)
			consoleChannel.show(vscode.ViewColumn.Three);		
		consoleChannel.append(output.output);
	});
}
