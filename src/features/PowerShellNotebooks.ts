/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as vscode from 'vscode';
import { CommentType } from '../settings';
import { IFeature, LanguageClient } from '../feature';
import { EvaluateRequestType } from './Console';
import Settings = require("../settings");

export class PowerShellNotebooksFeature implements vscode.NotebookContentProvider, vscode.NotebookKernel, IFeature {

    private readonly showNotebookModeCommand: vscode.Disposable;
    private readonly hideNotebookModeCommand: vscode.Disposable;
    private languageClient: LanguageClient;

    private _onDidChangeNotebook = new vscode.EventEmitter<vscode.NotebookDocumentEditEvent>();
    onDidChangeNotebook: vscode.Event<vscode.NotebookDocumentEditEvent> = this._onDidChangeNotebook.event;
    kernel?: vscode.NotebookKernel;

    constructor() {
        this.kernel = this;
        this.showNotebookModeCommand = vscode.commands.registerCommand("PowerShell.ShowNotebookMode", async () => {
            const uri = vscode.window.activeTextEditor.document.uri;
            await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
            await vscode.commands.executeCommand("vscode.openWith", uri, "PowerShellNotebookMode");
        });

        this.hideNotebookModeCommand = vscode.commands.registerCommand("PowerShell.HideNotebookMode", async () => {
            const uri = vscode.notebook.activeNotebookEditor.document.uri;
            await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
            await vscode.commands.executeCommand("vscode.openWith", uri, "default");
        });
    }

    label: string = 'PowerShell';
    preloads?: vscode.Uri[];

    async openNotebook(uri: vscode.Uri, context: vscode.NotebookDocumentOpenContext): Promise<vscode.NotebookData> {
        // load from backup if needed.
        const actualUri = context.backupId ? vscode.Uri.parse(context.backupId) : uri;

        const data = (await vscode.workspace.fs.readFile(actualUri)).toString();
        const lines = data.split(/\r|\n|\r\n/g);

        const notebookData: vscode.NotebookData = {
            languages: ["powershell"],
            cells: [],
            metadata: {}
        }

        let curr: string[] = [];
        let cellKind: vscode.CellKind | undefined;
        let insideBlockComment: boolean = false;

        // tslint:disable-next-line: prefer-for-of
        for (let i = 0; i < lines.length; i++) {
            // Handle block comments
            if (insideBlockComment) {
                if (lines[i] === "#>") {
                    insideBlockComment = false;

                    notebookData.cells.push({
                        cellKind: vscode.CellKind.Markdown,
                        language: "markdown",
                        outputs: [],
                        source: curr.join("\n"),
                        metadata: {
                            custom: {
                                commentType: CommentType.BlockComment
                            }
                        }
                    });

                    curr = [];
                    cellKind = undefined;
                    continue;
                } else {
                    curr.push(lines[i]);
                    continue;
                }
            } else if (lines[i] === "<#") {
                // Insert what we saw leading up to this.
                notebookData.cells.push({
                    cellKind: cellKind!,
                    language: cellKind === vscode.CellKind.Markdown ? 'markdown' : 'powershell',
                    outputs: [],
                    source: curr.join("\n"),
                    metadata: {
                        custom: {
                            commentType: cellKind === vscode.CellKind.Markdown ? CommentType.LineComment : CommentType.Disabled,
                        }
                    }
                });

                // reset state because we're starting a new Markdown cell.
                curr = [];
                cellKind = vscode.CellKind.Markdown;
                insideBlockComment = true;
                continue;
            }

            // Handle everything else (regular comments and code)
            // If a line starts with # it's a comment
            const kind: vscode.CellKind = lines[i].startsWith("#") ? vscode.CellKind.Markdown : vscode.CellKind.Code;

            // If this line is a continuation of the previous cell type, then add this line to curr.
            if (kind === cellKind) {
                curr.push(kind === vscode.CellKind.Markdown && !insideBlockComment ? lines[i].replace(/^\#\s*/, '') : lines[i]);
            } else {
                // If cellKind is not undifined, then we can add the cell we've just computed to the editBuilder.
                if (cellKind !== undefined) {
                    notebookData.cells.push({
                        cellKind: cellKind!,
                        language: cellKind === vscode.CellKind.Markdown ? 'markdown' : 'powershell',
                        outputs: [],
                        source: curr.join("\n"),
                        metadata: {
                            custom: {
                                commentType: cellKind === vscode.CellKind.Markdown ? CommentType.LineComment : CommentType.Disabled,
                            }
                        }
                    });
                }

                // set initial new cell state
                curr = [];
                cellKind = kind;
                curr.push(kind === vscode.CellKind.Markdown ? lines[i].replace(/^\#\s*/, '') : lines[i]);
            }
        }

        if (curr.length) {
            notebookData.cells.push({
                cellKind: cellKind!,
                language: cellKind === vscode.CellKind.Markdown ? 'markdown' : 'powershell',
                outputs: [],
                source: curr.join("\n"),
                metadata: {
                    custom: {
                        commentType: cellKind === vscode.CellKind.Markdown ? CommentType.LineComment : CommentType.Disabled,
                    }
                }
            });
        }

        return notebookData;
    }

    resolveNotebook(document: vscode.NotebookDocument, webview: { readonly onDidReceiveMessage: vscode.Event<any>; postMessage(message: any): Thenable<boolean>; asWebviewUri(localResource: vscode.Uri): vscode.Uri; }): Promise<void> {
        return;
    }

    saveNotebook(document: vscode.NotebookDocument, cancellation: vscode.CancellationToken): Promise<void> {
        return this._save(document, document.uri, cancellation);
    }

    saveNotebookAs(targetResource: vscode.Uri, document: vscode.NotebookDocument, cancellation: vscode.CancellationToken): Promise<void> {
        return this._save(document, targetResource, cancellation);
    }

    async backupNotebook(document: vscode.NotebookDocument, context: vscode.NotebookDocumentBackupContext, cancellation: vscode.CancellationToken): Promise<vscode.NotebookDocumentBackup> {
        await this._save(document, context.destination, cancellation);

        return {
            id: context.destination.toString(),
            delete: () => {
                vscode.workspace.fs.delete(context.destination);
            }
        };
    }

    public dispose() {
        this.showNotebookModeCommand.dispose();
        this.hideNotebookModeCommand.dispose();
    }

    public setLanguageClient(languageClient: LanguageClient) {
        this.languageClient = languageClient;
    }

    async _save(document: vscode.NotebookDocument, targetResource: vscode.Uri, _token: vscode.CancellationToken): Promise<void> {
        const retArr: string[] = [];
        document.cells.forEach((cell, index) => {
            if (cell.cellKind === vscode.CellKind.Code) {
                retArr.push(...cell.document.getText().split(/\r|\n|\r\n/));
            } else {
                // First honor the comment type of the cell if it already has one.
                // If not, use the user setting.
                const commentKind = cell.metadata.custom?.commentType || Settings.load().notebooks.saveMarkdownCellsAs;

                if (commentKind === CommentType.BlockComment) {
                    retArr.push("<#");
                    retArr.push(...cell.document.getText().split(/\r|\n|\r\n/));
                    retArr.push("#>");
                } else {
                    retArr.push(...cell.document.getText().split(/\r|\n|\r\n/).map(line => `# ${line}`));
                }
            }
        });

        await vscode.workspace.fs.writeFile(targetResource, new TextEncoder().encode(retArr.join('\n')));
    }

    async executeAllCells(document: vscode.NotebookDocument, token: vscode.CancellationToken): Promise<void> {
        for (const cell of document.cells) {
            await this.executeCell(document, cell, token);
        }
    }

    async executeCell(document: vscode.NotebookDocument, cell: vscode.NotebookCell | undefined, token: vscode.CancellationToken): Promise<void> {
        if (token.isCancellationRequested) {
            return;
        }

        await this.languageClient.sendRequest(EvaluateRequestType, {
            expression: cell.document.getText(),
        });
    }
}
