// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import os = require("os");
import vscode = require("vscode");
import { SessionManager } from "../session";
import Settings = require("../settings");

const queryStringPrefix: string = "?";

const settings = Settings.load();
const project = settings.bugReporting.project;
const issuesUrl: string = `${project}/issues/new`;

const extensions =
    vscode.extensions.all.filter((element) => element.packageJSON.isBuiltin === false)
        .sort((leftside, rightside): number => {
            if (leftside.packageJSON.name.toLowerCase() < rightside.packageJSON.name.toLowerCase()) {
                return -1;
            }
            if (leftside.packageJSON.name.toLowerCase() > rightside.packageJSON.name.toLowerCase()) {
                return 1;
            }
            return 0;
        });

export class GenerateBugReportFeature implements vscode.Disposable {

    private command: vscode.Disposable;

    constructor(private sessionManager: SessionManager) {
        this.command = vscode.commands.registerCommand("PowerShell.GenerateBugReport", () => {

            const body = `Issue Description
=====

I am experiencing a problem with...

Attached Logs
=====

Follow the instructions in the [README](https://github.com/PowerShell/vscode-powershell/blob/main/docs/troubleshooting.md) about
capturing and sending logs.

Environment Information
=====

Visual Studio Code
-----

| Name | Version |
| --- | --- |
| Operating System | ${os.type()} ${os.arch()} ${os.release()} |
| VSCode | ${vscode.version}|
| PowerShell Extension Version | ${sessionManager.HostVersion} |

PowerShell Information
-----

${this.getRuntimeInfo()}

Visual Studio Code Extensions
-----

<details><summary>Visual Studio Code Extensions(Click to Expand)</summary>

${this.generateExtensionTable(extensions)}
</details>

`;

            const encodedBody = encodeURIComponent(body);
            const fullUrl = `${issuesUrl}${queryStringPrefix}body=${encodedBody}`;
            vscode.commands.executeCommand("vscode.open", vscode.Uri.parse(fullUrl));
        });
    }

    public dispose() {
        this.command.dispose();
    }

    private generateExtensionTable(installedExtensions): string {
        if (!installedExtensions.length) {
            return "none";
        }

        const tableHeader = `|Extension|Author|Version|\n|---|---|---|`;
        const table = installedExtensions.map((e) => {
            if (e.packageJSON.isBuiltin === false) {
                return `|${e.packageJSON.name}|${e.packageJSON.publisher}|${e.packageJSON.version}|`;
            }
        }).join("\n");

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

        const powerShellExePath = this.sessionManager.PowerShellExeDetails.exePath;
        const powerShellArgs = [
            "-NoProfile",
            "-Command",
            '$PSVersionString = "|Name|Value|\n"; $PSVersionString += "|---|---|\n"; $PSVersionTable.keys | ' +
            'ForEach-Object { $PSVersionString += "|$_|$($PSVersionTable.Item($_))|\n" }; $PSVersionString',
        ];

        const spawn = require("child_process").spawnSync;
        const child = spawn(powerShellExePath, powerShellArgs);
        return child.stdout.toString().replace(";", ",");
    }
}
