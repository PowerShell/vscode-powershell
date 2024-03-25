// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import vscode = require("vscode");
import { RequestType } from "vscode-languageclient";
import { LanguageClientConsumer } from "../languageClientConsumer";
import { RenameProvider, WorkspaceEdit, TextDocument, CancellationToken, Position,Uri,Range } from "vscode";
import type { LanguageClient } from "vscode-languageclient/node";
// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface IRenameSymbolRequestArguments {
    FileName?:string
    Line?:number
    Column?:number
    RenameTo?:string
}
interface IPrepareRenameSymbolRequestArguments {
    FileName?:string
    Line?:number
    Column?:number
    RenameTo?:string
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface TextChange {

    newText: string;
    startLine: number;
    startColumn: number;
    endLine: number;
    endColumn: number;
}
interface ModifiedFileResponse{
    fileName: string;
    changes : TextChange[]
}

interface IRenameSymbolRequestResponse {
    changes : ModifiedFileResponse[]
}

interface IPrepareRenameSymbolRequestResponse {
    message : string
}

export const RenameSymbolRequestType = new RequestType<IRenameSymbolRequestArguments, IRenameSymbolRequestResponse, void>("powerShell/renameSymbol");
export const PrepareRenameSymbolRequestType = new RequestType<IPrepareRenameSymbolRequestArguments, IPrepareRenameSymbolRequestResponse, void>("powerShell/PrepareRenameSymbol");

export class RenameSymbolFeature extends LanguageClientConsumer implements RenameProvider {
    public override onLanguageClientSet(_languageClient: LanguageClient): void {
        throw new Error("Method not implemented.");
    }
    private command: vscode.Disposable;

    constructor() {
        super();
        this.command = vscode.commands.registerCommand("PowerShell.RenameSymbol", () => {
            throw new Error("Not implemented");

        });
    }
    public dispose() :void{
        this.command.dispose();
    }
    public async provideRenameEdits(document: TextDocument, position: Position, newName: string, _token: CancellationToken): Promise<WorkspaceEdit | undefined> {

        const req:IRenameSymbolRequestArguments = {
            FileName : document.fileName,
            Line: position.line,
            Column : position.character,
            RenameTo : newName,
        };

        try {
            const client = await LanguageClientConsumer.getLanguageClient();
            const response = await client.sendRequest(RenameSymbolRequestType, req);

            if (!response.changes.length) {
                return undefined;
            }

            const edit = new WorkspaceEdit();
            response.changes.forEach(change => {
                const uri = Uri.file(change.fileName);

                change.changes.forEach(change => {
                    edit.replace(uri,
                        new Range(change.startLine, change.startColumn, change.endLine, change.endColumn),
                        change.newText);
                });
            });
            return edit;
        }catch (error) {
            return undefined;
        }
    }
    public async prepareRename(document: vscode.TextDocument, position: vscode.Position, _token: vscode.CancellationToken): Promise<vscode.Range | {
        range: vscode.Range; placeholder: string;} | null> {

        const req:IRenameSymbolRequestArguments = {
            FileName : document.fileName,
            Line: position.line,
            Column : position.character,
        };

        try {
            const client = await LanguageClientConsumer.getLanguageClient();
            const response = await client.sendRequest(PrepareRenameSymbolRequestType, req);

            if (!response.message) {
                return null;
            }
            const wordRange = document.getWordRangeAtPosition(position);
            if (!wordRange) {
                return Promise.reject("Not a valid location for renaming.");

            }
            const wordText = document.getText(wordRange);
            if (response.message) {
                return Promise.reject(response.message);

            }

            return {
                range: wordRange,
                placeholder: wordText
            };
        }catch (error) {
            return null;
        }
    }

}
