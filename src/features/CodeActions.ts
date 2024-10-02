// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import vscode = require("vscode");
import { ILogger } from "../logging";

export class CodeActionsFeature implements vscode.Disposable {
    private command: vscode.Disposable;

    constructor(private log: ILogger) {
        // NOTE: While not exposed to the user via package.json, this is
        // required as the server's code action sends across a command name.
        //
        // TODO: In the far future with LSP 3.19 the server can just set a URL
        // and this can go away. See https://github.com/microsoft/language-server-protocol/issues/1548
        this.command =
            vscode.commands.registerCommand("PowerShell.ShowCodeActionDocumentation", async (ruleName: string) => {
                await this.showRuleDocumentation(ruleName);
            });
    }

    public dispose(): void {
        this.command.dispose();
    }

    private async showRuleDocumentation(ruleId: string): Promise<void> {
        const pssaDocBaseURL = "https://docs.microsoft.com/powershell/utility-modules/psscriptanalyzer/rules/";

        if (!ruleId) {
            this.log.writeWarning("Cannot show documentation for code action, no ruleName was supplied.");
            return;
        }

        if (ruleId.startsWith("PS")) {
            ruleId = ruleId.substring(2);
        }

        await vscode.commands.executeCommand("vscode.open", vscode.Uri.parse(pssaDocBaseURL + ruleId));
    }
}
