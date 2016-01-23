import vscode = require('vscode');
import { LanguageClient, RequestType, NotificationType } from 'vscode-languageclient';
import Window = vscode.window;
import QuickPickItem = vscode.QuickPickItem;

export namespace FindModuleRequest {
	export const type: RequestType<any, any, void> = { get method() { return 'powerShell/findModule'; } };
}

export function registerPowerShellFindModuleCommand(client: LanguageClient): void {
    var disposable = vscode.commands.registerCommand('PowerShell.PowerShellFindModule', () => {
        var items: QuickPickItem[] = [];

        vscode.window.setStatusBarMessage("Querying PowerShell Gallery", 1500);

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