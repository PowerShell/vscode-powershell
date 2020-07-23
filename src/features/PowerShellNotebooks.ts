/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as vscode from "vscode";
import { CommentType } from "../settings";
import { EvaluateRequestType } from "./Console";
import { LanguageClientConsumer } from "../languageClientConsumer";
import Settings = require("../settings");
import { ILogger } from "../logging";

export class PowerShellNotebooksFeature extends LanguageClientConsumer implements vscode.NotebookContentProvider, vscode.NotebookKernel {

    private readonly showNotebookModeCommand: vscode.Disposable;
    private readonly hideNotebookModeCommand: vscode.Disposable;

    private _onDidChangeNotebook = new vscode.EventEmitter<vscode.NotebookDocumentEditEvent>();
    public onDidChangeNotebook: vscode.Event<vscode.NotebookDocumentEditEvent> = this._onDidChangeNotebook.event;
    public kernel?: vscode.NotebookKernel;

    public label: string = "PowerShell";
    public preloads?: vscode.Uri[];

    public constructor(private logger: ILogger, skipRegisteringCommands?: boolean) {
        super();
        // VS Code Notebook API uses this property for handling cell execution.
        this.kernel = this;

        if(!skipRegisteringCommands) {
            this.showNotebookModeCommand = vscode.commands.registerCommand(
                "PowerShell.ShowNotebookMode",
                PowerShellNotebooksFeature.showNotebookMode);

            this.hideNotebookModeCommand = vscode.commands.registerCommand(
                "PowerShell.HideNotebookMode",
                PowerShellNotebooksFeature.hideNotebookMode);
        }
    }

    public async openNotebook(uri: vscode.Uri, context: vscode.NotebookDocumentOpenContext): Promise<vscode.NotebookData> {
        // load from backup if needed.
        const actualUri = context.backupId ? vscode.Uri.parse(context.backupId) : uri;
        this.logger.writeDiagnostic(`Opening Notebook: ${uri.toString()}`);

        const data = (await vscode.workspace.fs.readFile(actualUri)).toString();
        const lines = data.split(/\r\n|\r|\n/g);

        const notebookData: vscode.NotebookData = {
            languages: ["powershell"],
            cells: [],
            metadata: {}
        };

        let currentCellSource: string[] = [];
        let cellKind: vscode.CellKind | undefined;
        let insideBlockComment: boolean = false;

        // Iterate through all lines in a document (aka ps1 file) and group the lines
        // into cells (markdown or code) that will be rendered in Notebook mode.
        // tslint:disable-next-line: prefer-for-of
        for (let i = 0; i < lines.length; i++) {
            // Handle block comments
            if (insideBlockComment) {
                if (lines[i] === "#>") {
                    // We've reached the end of a block comment,
                    // push a markdown cell.
                    insideBlockComment = false;

                    notebookData.cells.push({
                        cellKind: vscode.CellKind.Markdown,
                        language: "markdown",
                        outputs: [],
                        source: currentCellSource.join("\n"),
                        metadata: {
                            custom: {
                                commentType: CommentType.BlockComment
                            }
                        }
                    });

                    currentCellSource = [];
                    cellKind = null;
                    continue;
                }

                // If we're still in a block comment, push the line and continue.
                currentCellSource.push(lines[i]);
                continue;
            } else if (lines[i] === "<#") {
                // If we found the start of a block comment,
                // insert what we saw leading up to this.
                // If cellKind is null/undefined, that means we
                // are starting the file with a BlockComment.
                if (cellKind) {
                    notebookData.cells.push({
                        cellKind,
                        language: cellKind === vscode.CellKind.Markdown ? "markdown" : "powershell",
                        outputs: [],
                        source: currentCellSource.join("\n"),
                        metadata: {
                            custom: {
                                commentType: cellKind === vscode.CellKind.Markdown ? CommentType.LineComment : CommentType.Disabled,
                            }
                        }
                    });
                }

                // reset state because we're starting a new Markdown cell.
                currentCellSource = [];
                cellKind = vscode.CellKind.Markdown;
                insideBlockComment = true;
                continue;
            }

            // Handle everything else (regular comments and code)
            // If a line starts with # it's a comment
            const kind: vscode.CellKind = lines[i].startsWith("#") ? vscode.CellKind.Markdown : vscode.CellKind.Code;

            // If this line is a continuation of the previous cell type, then add this line to the current cell source.
            if (kind === cellKind) {
                currentCellSource.push(kind === vscode.CellKind.Markdown && !insideBlockComment ? lines[i].replace(/^\#\s*/, "") : lines[i]);
            } else {
                // If cellKind has a value, then we can add the cell we've just computed.
                if (cellKind) {
                    notebookData.cells.push({
                        cellKind: cellKind!,
                        language: cellKind === vscode.CellKind.Markdown ? "markdown" : "powershell",
                        outputs: [],
                        source: currentCellSource.join("\n"),
                        metadata: {
                            custom: {
                                commentType: cellKind === vscode.CellKind.Markdown ? CommentType.LineComment : CommentType.Disabled,
                            }
                        }
                    });
                }

                // set initial new cell state
                currentCellSource = [];
                cellKind = kind;
                currentCellSource.push(kind === vscode.CellKind.Markdown ? lines[i].replace(/^\#\s*/, "") : lines[i]);
            }
        }

        // If we have some leftover lines that have not been added (for example,
        // when there is only the _start_ of a block comment but not an _end_.)
        // add the appropriate cell.
        if (currentCellSource.length) {
            notebookData.cells.push({
                cellKind: cellKind!,
                language: cellKind === vscode.CellKind.Markdown ? "markdown" : "powershell",
                outputs: [],
                source: currentCellSource.join("\n"),
                metadata: {
                    custom: {
                        commentType: cellKind === vscode.CellKind.Markdown ? CommentType.LineComment : CommentType.Disabled,
                    }
                }
            });
        }

        return notebookData;
    }

    public resolveNotebook(document: vscode.NotebookDocument, webview: { readonly onDidReceiveMessage: vscode.Event<any>; postMessage(message: any): Thenable<boolean>; asWebviewUri(localResource: vscode.Uri): vscode.Uri; }): Promise<void> {
        // We don't need to do anything here because our Notebooks are backed by files.
        return;
    }

    public saveNotebook(document: vscode.NotebookDocument, cancellation: vscode.CancellationToken): Promise<void> {
        return this._save(document, document.uri, cancellation);
    }

    public saveNotebookAs(targetResource: vscode.Uri, document: vscode.NotebookDocument, cancellation: vscode.CancellationToken): Promise<void> {
        return this._save(document, targetResource, cancellation);
    }

    public async backupNotebook(document: vscode.NotebookDocument, context: vscode.NotebookDocumentBackupContext, cancellation: vscode.CancellationToken): Promise<vscode.NotebookDocumentBackup> {
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

    private async _save(document: vscode.NotebookDocument, targetResource: vscode.Uri, _token: vscode.CancellationToken): Promise<void> {
        this.logger.writeDiagnostic(`Saving Notebook: ${targetResource.toString()}`);

        const retArr: string[] = [];
        for (const cell of document.cells) {
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
                    retArr.push(...cell.document.getText().split(/\r|\n|\r\n/).map((line) => `# ${line}`));
                }
            }
        }

        await vscode.workspace.fs.writeFile(targetResource, new TextEncoder().encode(retArr.join("\n")));
    }

    private static async showNotebookMode() {
        const uri = vscode.window.activeTextEditor.document.uri;
        await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
        await vscode.commands.executeCommand("vscode.openWith", uri, "PowerShellNotebookMode");
    }

    private static async hideNotebookMode() {
        const uri = vscode.notebook.activeNotebookEditor.document.uri;
        await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
        await vscode.commands.executeCommand("vscode.openWith", uri, "default");
    }

    /*
        `vscode.NotebookKernel` implementations
    */
    public async executeAllCells(document: vscode.NotebookDocument, token: vscode.CancellationToken): Promise<void> {
        for (const cell of document.cells) {
            await this.executeCell(document, cell, token);
        }
    }

    public async executeCell(document: vscode.NotebookDocument, cell: vscode.NotebookCell | undefined, token: vscode.CancellationToken): Promise<void> {
        if (token.isCancellationRequested) {
            return;
        }

        await this.languageClient.sendRequest(EvaluateRequestType, {
            expression: cell.document.getText(),
        });
    }
}
