// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import vscode = require("vscode");
import { RequestType } from "vscode-languageclient";
import type { LanguageClient } from "vscode-languageclient/node";
import { LanguageClientConsumer } from "../languageClientConsumer";

export interface IShowHelpArguments {
    text: string;
}

export interface IShowHelpResult {
    helpText: string;
}

export const ShowHelpRequestType = new RequestType<
    IShowHelpArguments,
    IShowHelpResult,
    void
>("powerShell/showHelp");

// Serves Get-Help output as read-only virtual documents (scheme "powershell-help"),
// so help opens in an editor pane that is searchable and copyable but never marked
// dirty (no save/discard prompt). The command name is carried in the URI path.
class ShowHelpContentProvider implements vscode.TextDocumentContentProvider {
    private readonly onDidChangeEmitter = new vscode.EventEmitter<vscode.Uri>();
    public readonly onDidChange = this.onDidChangeEmitter.event;

    public refresh(uri: vscode.Uri): void {
        this.onDidChangeEmitter.fire(uri);
    }

    public async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
        const commandName = uri.path;
        const client = await LanguageClientConsumer.getLanguageClient();
        const result = await client.sendRequest(ShowHelpRequestType, {
            text: commandName,
        });
        return result.helpText || `No help found for '${commandName}'.`;
    }

    public dispose(): void {
        this.onDidChangeEmitter.dispose();
    }
}

export class ShowHelpFeature extends LanguageClientConsumer {
    public static readonly scheme = "powershell-help";

    private command: vscode.Disposable;
    private contentProvider: ShowHelpContentProvider;
    private providerRegistration: vscode.Disposable;

    constructor() {
        super();
        this.contentProvider = new ShowHelpContentProvider();
        this.providerRegistration =
            vscode.workspace.registerTextDocumentContentProvider(
                ShowHelpFeature.scheme,
                this.contentProvider,
            );

        this.command = vscode.commands.registerCommand(
            "PowerShell.ShowHelp",
            async (item?) => {
                const text = ShowHelpFeature.resolveCommandName(item);
                if (text === undefined) {
                    return;
                }

                await this.showHelp(text);
            },
        );
    }

    // Determines the command to show help for: an explicit item, the current
    // selection, or the word under the cursor. Returns undefined (and surfaces a
    // hint) when there's nothing to look up, rather than falling back to the
    // entire document.
    private static resolveCommandName(item?: {
        Name?: string;
    }): string | undefined {
        if (item?.Name) {
            return item.Name;
        }

        const editor = vscode.window.activeTextEditor;
        if (editor === undefined) {
            return undefined;
        }

        const document = editor.document;
        const selection = editor.selection;

        if (!selection.isEmpty) {
            return document.getText(selection);
        }

        const wordRange = document.getWordRangeAtPosition(selection.active);
        if (wordRange === undefined) {
            void vscode.window.showInformationMessage(
                "Place the cursor on a PowerShell command to show its help.",
            );
            return undefined;
        }

        return document.getText(wordRange);
    }

    private async showHelp(commandName: string): Promise<void> {
        const uri = vscode.Uri.from({
            scheme: ShowHelpFeature.scheme,
            path: commandName,
        });

        // Re-fetch in case the help changed since this document was last opened.
        this.contentProvider.refresh(uri);

        // If this command's help is already open, reuse that editor's column so
        // repeated clicks focus the existing pane instead of stacking duplicates.
        const existingColumn = vscode.window.tabGroups.all
            .flatMap((group) => group.tabs)
            .find(
                (tab) =>
                    tab.input instanceof vscode.TabInputText &&
                    tab.input.uri.toString() === uri.toString(),
            )?.group.viewColumn;

        const document = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(document, {
            preview: true,
            viewColumn: existingColumn ?? vscode.ViewColumn.Beside,
        });
    }

    public override onLanguageClientSet(
        _languageClient: LanguageClient,
        // eslint-disable-next-line @typescript-eslint/no-empty-function
    ): void {}

    public dispose(): void {
        this.command.dispose();
        this.providerRegistration.dispose();
        this.contentProvider.dispose();
    }
}
