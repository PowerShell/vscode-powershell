// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import vscode = require("vscode");
import child_process = require("child_process");
import { SessionManager } from "../session";

const issuesUrl = "https://github.com/PowerShell/vscode-powershell/issues/new?";

export class GenerateBugReportFeature implements vscode.Disposable {

    private command: vscode.Disposable;

    constructor(private sessionManager: SessionManager) {
        this.command = vscode.commands.registerCommand("PowerShell.GenerateBugReport", async () => {
            const params = [
                "labels=Issue-Bug",
                "template=bug-report.yml",
                "powershell-version=" + this.getRuntimeInfo(),
                "vscode-version=" + vscode.version + "\n" + process.arch,
                "extension-version=" + sessionManager.Publisher + "." + sessionManager.HostName + "@" + sessionManager.HostVersion,
            ];
            const url = vscode.Uri.parse(issuesUrl + encodeURIComponent(params.join("&")));
            await vscode.env.openExternal(url);
        });
    }

    public dispose() {
        this.command.dispose();
    }

    private getRuntimeInfo(): string {
        if (this.sessionManager.PowerShellExeDetails === undefined) {
            return "Session's PowerShell details are unknown!";
        }

        const powerShellExePath = this.sessionManager.PowerShellExeDetails.exePath;
        const powerShellArgs = [ "-NoProfile", "-Command", "$PSVersionTable | Out-String" ];
        const child = child_process.spawnSync(powerShellExePath, powerShellArgs);
        // Replace semicolons as they'll cause the URI component to truncate
        return child.stdout.toString().trim().replace(";", ",");
    }
}
