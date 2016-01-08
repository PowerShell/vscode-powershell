import vscode = require('vscode'); 
import Window = vscode.window;

function convertUriToPath(Uri) {
  
  var result = Uri.replace("file://","")
  var result = result.replace("/","\")
  var driveletter = result.substring(0)
  var result =   driveletter + ":" + result.substring(1,-1)
  
}

export function registerOpenInISECommand(): void {
    var disposable = vscode.commands.registerCommand('PowerShell.OpenInISE', () => {

		var editor    = Window.activeTextEditor;
		var document  = editor.document;		
        
        process = require('child_process');
        var filePath = convertUriToPath(editor.document.uri);
        process.exec("powershell_ise.exe -NoProfile -File " + filePath);

			});
}