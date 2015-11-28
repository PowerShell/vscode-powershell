import vscode = require('vscode');
import { LanguageClient } from 'vscode-languageclient';
import { RequestType, NotificationType, ResponseError } from 'vscode-jsonrpc';
import Window = vscode.window;
import QuickPickItem = vscode.QuickPickItem;

export namespace FindModuleRequest {
	export const type: RequestType<string, any, void> = { get method() { return 'powerShell/findModule'; } };
}

export function registerFindModuleCommand(client: LanguageClient): void {
    var disposable = vscode.commands.registerCommand('PowerShell.FindModule', () => {

    	var items: QuickPickItem[] = [];		
		
		Window.showInformationMessage("Querying PowerShell Gallery...");
		
		client.sendRequest(FindModuleRequest.type, null).then((modules) => {			
			for(var i=0 ; i < modules.moduleList.length; i++) {
				var module = modules.moduleList[i];
				items.push({ label: module.name, description: module.description });
			}
			
			Window.showQuickPick(items).then((selection) => {
				switch (selection.label) {
					default :
						Window.showInformationMessage("Installing PowerShell Module " + selection.label);			
				}				 
			});			
		});		
	
    });
}