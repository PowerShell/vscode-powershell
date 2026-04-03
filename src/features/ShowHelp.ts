// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import vscode = require("vscode");
import type { LanguageClient } from "vscode-languageclient/node";
import { LanguageClientConsumer } from "../languageClientConsumer";
import { PowerShellIntegratedConsole } from "../powerShellIntegratedConsole";

export class ShowHelpFeature extends LanguageClientConsumer {
    private command: vscode.Disposable;

    constructor() {
        super();
        this.command = vscode.commands.registerCommand(
            "PowerShell.ShowHelp",
            async (item?) => {
                let text: string | undefined;
                if (item?.Name) {
                    text = item.Name;
                } else {
                    const editor = vscode.window.activeTextEditor;
                    if (editor === undefined) {
                        return;
                    }
                    const selection = editor.selection;
                    const doc = editor.document;
                    const cwr = doc.getWordRangeAtPosition(selection.active);
                    text = doc.getText(cwr);
                }

                if (!text) {
                    return;
                }

                // We need to escape single quotes for the PowerShell command.
                const escapedText = text.replace(/'/g, "''");
                const psCommand =
                    `try { ` +
                        `$help = (Get-Help '${escapedText}' -ErrorAction Stop)[0]; ` +
                        `$uri = $help.RelatedLinks.NavigationLink[0].Uri; ` +
                        `if ($null -ne $uri) { Start-Process $uri } ` +
                    `} catch { ` +
                        `# This fails silently, which is similar to the old behavior where no browser ` +
                        `# would be opened if help is not found. ` +
                    `}`;

                // We don't want to focus the terminal, and we don't want this to show up in history.
                await PowerShellIntegratedConsole.instance.executeCommand(psCommand, false, false);
            },
        );
    }

    public override onLanguageClientSet(
        _languageClient: LanguageClient,
        // eslint-disable-next-line @typescript-eslint/no-empty-function
    ): void {}

    public dispose(): void {
        this.command.dispose();
    }
}
