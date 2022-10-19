// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import vscode = require("vscode");
import Window = vscode.window;
import { ILogger } from "../logging";

export class CodeActionsFeature implements vscode.Disposable {
    private applyEditsCommand: vscode.Disposable;
    private showDocumentationCommand: vscode.Disposable;

    constructor(private log: ILogger) {
        // TODO: What type is `edit`, what uses this, and is it working?
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.applyEditsCommand = vscode.commands.registerCommand("PowerShell.ApplyCodeActionEdits", async (edit: any) => {
            await Window.activeTextEditor?.edit((editBuilder) => {
                editBuilder.replace(
                    new vscode.Range(
                        edit.StartLineNumber - 1,
                        edit.StartColumnNumber - 1,
                        edit.EndLineNumber - 1,
                        edit.EndColumnNumber - 1),
                    edit.Text);
            });
        });

        this.showDocumentationCommand =
            vscode.commands.registerCommand("PowerShell.ShowCodeActionDocumentation", async (ruleName: string) => {
                await this.showRuleDocumentation(ruleName);
            });
    }

    public dispose() {
        this.applyEditsCommand.dispose();
        this.showDocumentationCommand.dispose();
    }

    public async showRuleDocumentation(ruleId: string) {
        const pssaDocBaseURL = "https://docs.microsoft.com/powershell/utility-modules/psscriptanalyzer/rules/";

        if (!ruleId) {
            this.log.writeWarning("Cannot show documentation for code action, no ruleName was supplied.");
            return;
        }

        if (ruleId.startsWith("PS")) {
            ruleId = ruleId.substr(2);
        }

        await vscode.commands.executeCommand("vscode.open", vscode.Uri.parse(pssaDocBaseURL + `${ruleId}`));
    }
}
