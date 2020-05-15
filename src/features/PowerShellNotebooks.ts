/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as vscode from 'vscode';
import { CommentType } from '../settings';
import { IFeature, LanguageClient } from '../feature';
import { EvaluateRequestType } from './Console';
import Settings = require("../settings");

export class PowerShellNotebooksFeature implements vscode.NotebookContentProvider, IFeature {

    private readonly showNotebookModeCommand: vscode.Disposable;
    private readonly hideNotebookModeCommand: vscode.Disposable;
    private languageClient: LanguageClient;

    constructor() {
        const editorAssociations = vscode.workspace.getConfiguration("workbench").get<any[]>("editorAssociations");

        if(!editorAssociations.some((value) =>
            value.filenamePattern === "*.ps1" && value.viewType === "default")) {
            editorAssociations.push({
                viewType: "default",
                filenamePattern: "*.ps1"
            });
        }

        vscode.workspace.getConfiguration("workbench").update("editorAssociations", editorAssociations, true);

        this.showNotebookModeCommand = vscode.commands.registerCommand("PowerShell.ShowNotebookMode", async () => {
            await vscode.commands.executeCommand("vscode.openWith", vscode.window.activeTextEditor.document.uri, "PowerShellNotebookMode");
        });

        this.hideNotebookModeCommand = vscode.commands.registerCommand("PowerShell.HideNotebookMode", async () => {
            await vscode.commands.executeCommand("vscode.openWith", vscode.notebook.activeNotebookDocument.uri, "default");
        });
    }

    async openNotebook(uri: vscode.Uri): Promise<vscode.NotebookData> {
        const data = (await vscode.workspace.fs.readFile(uri)).toString();
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

    async saveNotebook(document: vscode.NotebookDocument, cancellation: vscode.CancellationToken): Promise<void> {
        const uri = document.uri;
        const retArr: string[] = [];
        document.cells.forEach((cell, index) => {
            if (cell.cellKind === vscode.CellKind.Code) {
                retArr.push(...cell.source.split(/\r|\n|\r\n/));
            } else {
                // First honor the comment type of the cell if it already has one.
                // If not, use the user setting.
                const commentKind = cell.metadata.custom?.commentType || Settings.load().notebooks.saveMarkdownCellsAs;

                if (commentKind === CommentType.BlockComment) {
                    retArr.push("<#");
                    retArr.push(...cell.source.split(/\r|\n|\r\n/));
                    retArr.push("#>");
                } else {
                    retArr.push(...cell.source.split(/\r|\n|\r\n/).map(line => `# ${line}`));
                }
            }
        });

        await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(retArr.join('\n')));
    }

    saveNotebookAs(targetResource: vscode.Uri, document: vscode.NotebookDocument, cancellation: vscode.CancellationToken): Promise<void> {
        throw new Error("Method not implemented.");
    }

    onDidChangeNotebook: vscode.Event<vscode.NotebookDocumentEditEvent>;
    kernel?: vscode.NotebookKernel;

    public dispose() {
        this.showNotebookModeCommand.dispose();
        this.hideNotebookModeCommand.dispose();
    }

    public setLanguageClient(languageClient: LanguageClient) {
        this.languageClient = languageClient;
    }

    async executeCell(document: vscode.NotebookDocument, cell: vscode.NotebookCell | undefined, token: vscode.CancellationToken): Promise<void> {
        await this.languageClient.sendRequest(EvaluateRequestType, {
            expression: cell.source,
        });
    }
}
