import vscode = require('vscode');
import { LanguageClient, RequestType, NotificationType } from 'vscode-languageclient';
import Window = vscode.window;
import QuickPickItem = vscode.QuickPickItem;

export namespace FindModuleRequest {
    export const type: RequestType<any, any, void> = { get method() { return 'powerShell/findModule'; } };
}

export namespace InstallModuleRequest {
    export const type: RequestType<string, void, void> = { get method() { return 'powerShell/installModule'; } };
}

function GetCurrentTime() {

    var timeNow = new Date();
    var hours   = timeNow.getHours();
    var minutes = timeNow.getMinutes();
    var seconds = timeNow.getSeconds();

    var timeString = "" + ((hours > 12) ? hours - 12 : hours);
    timeString  += ((minutes < 10) ? ":0" : ":") + minutes;
    timeString  += ((seconds < 10) ? ":0" : ":") + seconds;
    timeString  += (hours >= 12) ? " PM" : " AM";

    return timeString;
}

export function registerPowerShellFindModuleCommand(client: LanguageClient): void {
    var disposable = vscode.commands.registerCommand('PowerShell.PowerShellFindModule', () => {
        var items: QuickPickItem[] = [];

        vscode.window.setStatusBarMessage(GetCurrentTime() + " Querying PowerShell Gallery");
        client.sendRequest(FindModuleRequest.type, null).then((modules) => {
            for(var item in modules) {
                items.push({ label: modules[item].name, description: modules[item].description });
            };

            vscode.window.setStatusBarMessage("");
            Window.showQuickPick(items).then((selection) => {
            	if (!selection) { return; }
            	switch (selection.label) {
            	    default :
            	        var moduleName = selection.label;
            	        //vscode.window.setStatusBarMessage("Installing PowerShell Module " + moduleName, 1500);
            	        client.sendRequest(InstallModuleRequest.type, moduleName);
            	    }
            	});
            });
    });
}