/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import vscode = require("vscode");
import { LanguageClient } from "vscode-languageclient";
import Window = vscode.window;
import { IFeature } from "../feature";
import { ILogger } from "../logging";

export class CodeActionsFeature implements IFeature {
    private applyEditsCommand: vscode.Disposable;
    private showDocumentationCommand: vscode.Disposable;
    private languageClient: LanguageClient;

    constructor(private log: ILogger) {
        this.applyEditsCommand = vscode.commands.registerCommand("PowerShell.ApplyCodeActionEdits", (edit: any) => {
            Window.activeTextEditor.edit((editBuilder) => {
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
            vscode.commands.registerCommand("PowerShell.ShowCodeActionDocumentation", (ruleName: any) => {
                this.showRuleDocumentation(ruleName);
            });
    }

    public dispose() {
        this.applyEditsCommand.dispose();
        this.showDocumentationCommand.dispose();
    }

    public setLanguageClient(languageclient: LanguageClient) {
        this.languageClient = languageclient;
    }

    public showRuleDocumentation(ruleId: string) {
        const pssaDocBaseURL = "https://github.com/PowerShell/PSScriptAnalyzer/blob/master/RuleDocumentation";

        if (!ruleId) {
            this.log.writeWarning("Cannot show documentation for code action, no ruleName was supplied.");
            return;
        }

        if (ruleId.startsWith("PS")) {
            ruleId = ruleId.substr(2);
        }

        vscode.commands.executeCommand("vscode.open", vscode.Uri.parse(pssaDocBaseURL + `/${ruleId}.md`));
    }
}
