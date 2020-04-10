/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as vscode from 'vscode';
import { IFeature, LanguageClient } from '../feature';
import { EvaluateRequestType } from './Console';

export class PowerShellNotebooksFeature implements vscode.NotebookProvider, IFeature {

    private languageClient: LanguageClient;

    public dispose() {
        // asedf
    }

    public setLanguageClient(languageClient: LanguageClient) {
        this.languageClient = languageClient;
    }

    async resolveNotebook(editor: vscode.NotebookEditor): Promise<void> {
        editor.document.languages = ['powershell'];
        const uri = editor.document.uri;
        const data = (await vscode.workspace.fs.readFile(uri)).toString();
        const lines = data.split(/\r|\n|\r\n/g);

        await editor.edit(editBuilder => {
            let curr: string[] = [];
            let cellKind: vscode.CellKind | undefined;
            // tslint:disable-next-line: prefer-for-of
            for (let i = 0; i < lines.length; i++) {
                const kind = /^\#/.exec(lines[i]) === null ? vscode.CellKind.Code : vscode.CellKind.Markdown;

                if (kind === cellKind) {
                    curr.push(kind === vscode.CellKind.Markdown ? lines[i].replace(/^\#\s*/, '') : lines[i]);
                } else {
                    // new cell
                    if (cellKind !== undefined) {
                        editBuilder.insert(0, curr, cellKind === vscode.CellKind.Markdown ? 'markdown' : 'powershell', cellKind!, [], undefined)
                    }

                    curr = [];
                    cellKind = kind;
                    curr.push(kind === vscode.CellKind.Markdown ? lines[i].replace(/^\#/, '') : lines[i]);
                }
            }

            if (curr.length) {
                editBuilder.insert(0, curr, cellKind === vscode.CellKind.Markdown ? 'markdown' : 'powershell', cellKind!, [], undefined)
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
        const retArr: string[] = [];
        document.cells.forEach(cell => {
            if (cell.cellKind === vscode.CellKind.Code) {
                retArr.push(...cell.source.split(/\r|\n|\r\n/));
            } else {
                retArr.push(...cell.source.split(/\r|\n|\r\n/).map(line => `# ${line}`));
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
