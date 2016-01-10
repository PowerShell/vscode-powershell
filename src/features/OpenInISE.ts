import vscode = require('vscode'); 
import Window = vscode.window;
import os = require('os'); 

export function registerOpenInISECommand(): void {
    var disposable = vscode.commands.registerCommand('PowerShell.OpenInISE', () => {

		var editor    = Window.activeTextEditor;
		var document  = editor.document;		

var uri = document.uri

// For testing, to be removed
Window.showInformationMessage(uri.fsPath);
Window.showInformationMessage(uri.path);

if (os.arch()== 'x64') {
    
    var ISEPath = 'C:\\Windows\\Sysnative\\WindowsPowerShell\\v1.0\\powershell_ise.exe';

} else
{

    // Need to figure out how to check OS architecture os.arch returns process architecture
    //var ISEPath = process.env.windir + '\\System32\\WindowsPowerShell\\v1.0\\powershell_ise.exe';
    var ISEPath = 'C:\\Windows\\Sysnative\\WindowsPowerShell\\v1.0\\powershell_ise.exe';

}

// For testing, to be removed
Window.showInformationMessage(os.arch());
Window.showInformationMessage(ISEPath);
        
        require("child_process").exec(ISEPath + ' -NoProfile -File ' + uri.fsPath).unref();
        

			});
}