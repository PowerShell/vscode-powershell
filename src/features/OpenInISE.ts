import vscode = require('vscode'); 
import Window = vscode.window;

export function registerOpenInISECommand(): void {
    var disposable = vscode.commands.registerCommand('PowerShell.OpenInISE', () => {

		var editor    = Window.activeTextEditor;
		var document  = editor.document;		

var uri = document.uri

if (process.env.hasOwnProperty('PROCESSOR_ARCHITEW6432')) {
    
    var ISEPath = process.env.windir + '\\Sysnative\\WindowsPowerShell\\v1.0\\powershell_ise.exe';

} else
{

    var ISEPath = process.env.windir + '\\System32\\WindowsPowerShell\\v1.0\\powershell_ise.exe';

}
       
        require("child_process").exec(ISEPath + ' -File ' + uri.fsPath).unref();
        

			});
}