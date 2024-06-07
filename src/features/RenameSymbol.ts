// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import vscode = require("vscode");
import { RequestType } from "vscode-languageclient";
import { LanguageClientConsumer } from "../languageClientConsumer";
import { RenameProvider, WorkspaceEdit, TextDocument, CancellationToken, Position,Uri,Range, DocumentSelector } from "vscode";
import { LanguageClient } from "vscode-languageclient/node";
import { ILogger } from "../logging";
// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface RenameSymbolOptions {
    ShouldGenerateAlias?:boolean
}
interface IRenameSymbolRequestArguments {
    FileName?:string
    Line?:number
    Column?:number
    RenameTo?:string
    Options?:RenameSymbolOptions
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

const RenameSymbolRequestType = new RequestType<IRenameSymbolRequestArguments, IRenameSymbolRequestResponse, void>("powerShell/renameSymbol");
const PrepareRenameSymbolRequestType = new RequestType<IPrepareRenameSymbolRequestArguments, IPrepareRenameSymbolRequestResponse, void>("powerShell/PrepareRenameSymbol");

export class RenameSymbolFeature extends LanguageClientConsumer implements RenameProvider {
    private languageRenameProvider:vscode.Disposable;

    constructor(documentSelector:DocumentSelector,private logger: ILogger){
        super();

        this.languageRenameProvider = vscode.languages.registerRenameProvider(documentSelector,this);
    }
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    public override onLanguageClientSet(_languageClient: LanguageClient): void {}
    public async provideRenameEdits(document: TextDocument, position: Position, newName: string, _token: CancellationToken): Promise<WorkspaceEdit | undefined> {

        const req:IRenameSymbolRequestArguments = {
            FileName : document.fileName,
            Line: position.line,
            Column : position.character,
            RenameTo : newName,
        };
        const config = vscode.workspace.getConfiguration();
        req.Options =  {
            ShouldGenerateAlias: config.get("powershell.renameSymbol.shouldGenerateAlias")
        };

        try {
            const client = await LanguageClientConsumer.getLanguageClient();
            const response = await client.sendRequest(RenameSymbolRequestType, req);

            if (!response.changes.length) {
                return undefined;
            }

            const edit = new WorkspaceEdit();
            for (const file of response.changes) {

                const uri = Uri.file(file.fileName);

                for (const change of file.changes) {
                    edit.replace(uri,
                        new Range(change.startLine, change.startColumn, change.endLine, change.endColumn),
                        change.newText);
                }
            }
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
                throw new Error("Not a valid location for renaming.");

            }
            const wordText = document.getText(wordRange);
            if (response.message) {
                throw new Error(response.message);
            }

            return {
                range: wordRange,
                placeholder: wordText
            };
        }catch (error) {
            const msg = `RenameSymbol: ${error}`;
            this.logger.writeError(msg);
            throw new Error(msg);
        }
    }
    public dispose(): void {
        this.languageRenameProvider.dispose();
    }
}
