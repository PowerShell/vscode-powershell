import vscode = require('vscode');
import { LanguageClient } from 'vscode-languageclient';
import { RequestType, NotificationType, ResponseError } from 'vscode-jsonrpc';
import Window = vscode.window;
import QuickPickItem = vscode.QuickPickItem;

export namespace GetInstalledModuleRequest {
	export const type: RequestType<string, any, void> = { get method() { return 'powerShell/getInstalledModule'; } };
}

export function registerGetInstalledModuleCommand(client: LanguageClient): void {
    var disposable = vscode.commands.registerCommand('PowerShell.GetInstalledModule', () => {

    	var items: QuickPickItem[] = [];	
		
		Window.showInformationMessage("Searching local PowerShell modules...");
		
		client.sendRequest(GetInstalledModuleRequest.type, null).then((modules) => {			
			console.log(modules.moduleList.length);
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