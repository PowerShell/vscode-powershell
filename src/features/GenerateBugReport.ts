import vscode = require('vscode');
import { SessionManager } from '../session';
import cp = require('child_process');
import Settings = require('../settings');

import window = vscode.window;
const os = require("os");

import { IFeature, LanguageClient } from '../feature';
// import { IExtensionManagementService, LocalExtensionType, ILocalExtension } from 'vs/platform/extensionManagement/common/extensionManagement';

const extensionId: string = 'ms-vscode.PowerShell';
const extensionVersion: string = vscode.extensions.getExtension(extensionId).packageJSON.version;

const queryStringPrefix: string = '?'

var settings = Settings.load();
let project = settings.bugReporting.project;

const issuesUrl: string = `${project}/issues/new`

var extensions = vscode.extensions.all.filter(element => element.packageJSON.isBuiltin == false).sort((leftside, rightside): number => {
    if (leftside.packageJSON.name.toLowerCase() < rightside.packageJSON.name.toLowerCase()) return -1;
    if (leftside.packageJSON.name.toLowerCase() > rightside.packageJSON.name.toLowerCase()) return 1;
    return 0;
})

export class GenerateBugReportFeature implements IFeature {

    private command: vscode.Disposable;
    private powerShellProcess: cp.ChildProcess;

    constructor(private sessionManager: SessionManager) {
        this.command = vscode.commands.registerCommand('PowerShell.GenerateBugReport', () => {


            var OutputChannel = window.createOutputChannel('Debug');
            OutputChannel.show();

            OutputChannel.appendLine('Starting Bug Report');

            var body = encodeURIComponent(`## Issue Description ##

I am experiencing a problem with...

## Attached Logs ##

Follow the instructions in the [README](https://github.com/PowerShell/vscode-powershell#reporting-problems) about capturing and sending logs.

## Environment Information ##

### Visual Studio Code ###

| Name | Version |
| --- | --- |
| Operating System | ${os.type() + ' ' + os.arch() + ' ' + os.release()} |
| VSCode | ${vscode.version}|
| PowerShell Extension Version | ${extensionVersion} |
| PSES | |

### PowerShell Information ###

${this.getRuntimeInfo()}

### Visual Studio Code Extensions ###

<details><summary>Visual Studio Code Extensions(Click to Expand)</summary>

${this.generateExtensionTable(extensions)}
</details>

`);

            var encodedBody = encodeURIComponent(body);
            var fullUrl = `${issuesUrl}${queryStringPrefix}body=${encodedBody}`;
            vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(fullUrl));

        });

    }


    public setLanguageClient(LanguageClient: LanguageClient) {
        // Not needed for this feature.
    }

    public dispose() {
        this.command.dispose();
    }


    private generateExtensionTable(extensions): string {
        if (!extensions.length) {
            return 'none';
        }

        let tableHeader = `|Extension|Author|Version|\n|---|---|---|`;
        const table = extensions.map(e => {

            if (e.packageJSON.isBuiltin == false) {
                return `|${e.packageJSON.name}|${e.packageJSON.publisher}|${e.packageJSON.version}|`;
            }
        }).join('\n');

        const extensionTable = `
${tableHeader}\n${table};
`;
        // 2000 chars is browsers de-facto limit for URLs, 400 chars are allowed for other string parts of the issue URL
        // http://stackoverflow.com/questions/417142/what-is-the-maximum-length-of-a-url-in-different-browsers
        // if (encodeURIComponent(extensionTable).length > 1600) {
        //     return 'the listing length exceeds browsers\' URL characters limit';
        // }

        return extensionTable;
    }

    private getRuntimeInfo() {

        var psOutput;
        var powerShellExePath = this.sessionManager.getPowerShellExePath();
        var powerShellArgs = [
            "-NoProfile",

            "-Command",
            '$PSVersionString = "|Name|Value|\n"; $PSVersionString += "|---|---|\n"; $PSVersionTable.keys | ForEach-Object { $PSVersionString += "|$_|$($PSVersionTable.Item($_))|\n" }; $PSVersionString'
        ]

        var spawn = require('child_process').spawnSync;
        var child = spawn(powerShellExePath, powerShellArgs);
        return child.stdout.toString().replace(';', ',');

    }

}

