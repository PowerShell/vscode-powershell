// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import vscode = require("vscode");
import {  RequestType } from "vscode-languageclient";
import { LanguageClientConsumer } from "../languageClientConsumer";
import { RenameProvider, WorkspaceEdit, TextDocument, CancellationToken, Position,Uri,Range } from "vscode";
// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface IRenameSymbolRequestArguments {
    FileName?:string
    Line?:number
    Column?:number
    RenameTo:string
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

export const RenameSymbolRequestType = new RequestType<IRenameSymbolRequestArguments, IRenameSymbolRequestResponse, void>("powerShell/renameSymbol");

export class RenameSymbolFeature extends LanguageClientConsumer implements RenameProvider {
    private command: vscode.Disposable;

    constructor() {
        super();
        this.command = vscode.commands.registerCommand("PowerShell.RenameSymbol", () => {
            throw new Error("Not implemented");

        });
    }
    public dispose() {
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
            const response = await this.languageClient?.sendRequest(RenameSymbolRequestType, req);

            if (!response) {
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

}
