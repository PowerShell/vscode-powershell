/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as vscode from 'vscode';
import { CommentType } from '../settings';
import { IFeature, LanguageClient } from '../feature';
import { EvaluateRequestType } from './Console';
import Settings = require("../settings");

export class PowerShellNotebooksFeature implements vscode.NotebookProvider, IFeature {

    private readonly showNotebookModeCommand: vscode.Disposable;
    private readonly hideNotebookModeCommand: vscode.Disposable;
    private languageClient: LanguageClient;
    private cellCommentTypes: Map<vscode.Uri, Map<number, CommentType>> = new Map<vscode.Uri, Map<number, CommentType>>();

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

    public dispose() {
        this.showNotebookModeCommand.dispose();
        this.hideNotebookModeCommand.dispose();
    }

    public setLanguageClient(languageClient: LanguageClient) {
        this.languageClient = languageClient;
    }

    async resolveNotebook(editor: vscode.NotebookEditor): Promise<void> {
        editor.document.languages = ['powershell'];
        const uri = editor.document.uri;

        if (!this.cellCommentTypes.has(uri)) {
            this.cellCommentTypes.set(uri, new Map<number, CommentType>());
        }
        const notebookCommentTypes = this.cellCommentTypes.get(uri);


        const data = (await vscode.workspace.fs.readFile(uri)).toString();
        const lines = data.split(/\r|\n|\r\n/g);

        await editor.edit(editBuilder => {
            let curr: string[] = [];
            let currentCellIndex: number = 0;
            let cellKind: vscode.CellKind | undefined;
            let insideBlockComment: boolean = false;

            // tslint:disable-next-line: prefer-for-of
            for (let i = 0; i < lines.length; i++) {
                // Handle block comments
                if (insideBlockComment) {
                    if (lines[i] === "#>") {
                        insideBlockComment = false;
                        editBuilder.insert(0, curr, 'markdown', vscode.CellKind.Markdown, [], undefined)
                        notebookCommentTypes.set(currentCellIndex, CommentType.BlockComment);
                        currentCellIndex++;
                        curr = [];
                        cellKind = undefined;
                        continue;
                    } else {
                        curr.push(lines[i]);
                        continue;
                    }
                } else if (lines[i] === "<#") {
                    // Insert what we saw leading up to this.
                    editBuilder.insert(0, curr, cellKind === vscode.CellKind.Markdown ? 'markdown' : 'powershell', cellKind!, [], undefined)
                    if (cellKind === vscode.CellKind.Markdown) {
                        notebookCommentTypes.set(currentCellIndex, CommentType.LineComment);
                    }
                    currentCellIndex++;

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
                        editBuilder.insert(0, curr, cellKind === vscode.CellKind.Markdown ? 'markdown' : 'powershell', cellKind!, [], undefined)
                        if (cellKind === vscode.CellKind.Markdown) {
                            notebookCommentTypes.set(currentCellIndex, CommentType.LineComment);
                        }
                        currentCellIndex++;
                    }

                    // set initial new cell state
                    curr = [];
                    cellKind = kind;
                    curr.push(kind === vscode.CellKind.Markdown ? lines[i].replace(/^\#\s*/, '') : lines[i]);
                }
            }

            if (curr.length) {
                editBuilder.insert(0, curr, cellKind === vscode.CellKind.Markdown ? 'markdown' : 'powershell', cellKind!, [], undefined)
                if (cellKind === vscode.CellKind.Markdown) {
                    notebookCommentTypes.set(currentCellIndex, insideBlockComment ? CommentType.BlockComment : CommentType.LineComment);
                }
                currentCellIndex++;
            }
        });
        return;
    }

    async executeCell(document: vscode.NotebookDocument, cell: vscode.NotebookCell | undefined, token: vscode.CancellationToken): Promise<void> {
        await this.languageClient.sendRequest(EvaluateRequestType, {
            expression: cell.source,
        });
    }

    async save(document: vscode.NotebookDocument): Promise<boolean> {
        const uri = document.uri;
        const notebookCommentTypes = this.cellCommentTypes.get(uri);
        const retArr: string[] = [];
        document.cells.forEach((cell, index) => {
            if (cell.cellKind === vscode.CellKind.Code) {
                retArr.push(...cell.source.split(/\r|\n|\r\n/));
            } else {
                // First honor the comment type of the cell if it already has one.
                // If not, use the user setting.
                let commentKind: CommentType;
                if (notebookCommentTypes.has(index)) {
                    commentKind = notebookCommentTypes.get(index);
                } else {
                    commentKind = Settings.load().notebooks.saveMarkdownCellsAs;
                    // We need to update the metadata for new cells.
                    notebookCommentTypes.set(index, commentKind);
                }

                if (commentKind === CommentType.BlockComment) {
                    retArr.push("<#");
                    retArr.push(...cell.source.split(/\r|\n|\r\n/));
                    retArr.push("#>");
                } else {
                    retArr.push(...cell.source.split(/\r|\n|\r\n/).map(line => `# ${line}`));
                }
            }
        });

        try {
            await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(retArr.join('\n')))
        } catch (e) {
            return false;
        }

        return true;
    }
}
