/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import vscode = require("vscode");
import { IFeature } from "../feature";
import { TextDocumentChangeEvent, workspace, Disposable, Position } from "vscode";
import { LanguageClient, RequestType } from "vscode-languageclient";

export namespace CommentHelpRequest {
    export const type = new RequestType<any, any, void, void>("powerShell/getCommentHelp");
}

interface CommentHelpRequestParams {
    documentUri: string;
    triggerPosition: Position;
    blockComment: boolean;
}

interface CommentHelpRequestResult {
    content: string[];
}

enum SearchState { Searching, Locked, Found };

export class HelpCompletionFeature implements IFeature {
    private readonly triggerCharactersBlockComment: string;
    private readonly triggerCharactersLineComment: string;
    private triggerCharactersFound: string;
    private languageClient: LanguageClient;
    private disposable: Disposable;
    private searchState: SearchState;
    private get isBlockComment(): boolean {
        return this.triggerCharactersFound !== undefined &&
            this.triggerCharactersFound === this.triggerCharactersBlockComment;
    }

    constructor() {
        this.triggerCharactersBlockComment = "<#";
        this.triggerCharactersLineComment = "##";
        let subscriptions = [];
        workspace.onDidChangeTextDocument(this.onEvent, this, subscriptions);
        this.searchState = SearchState.Searching;
        this.disposable = Disposable.from(...subscriptions);
    }

    setLanguageClient(languageClient: LanguageClient) {
        this.languageClient = languageClient;
    }

    dispose() {
        this.disposable.dispose();
    }

    onEvent(changeEvent: TextDocumentChangeEvent): void {
        let text = changeEvent.contentChanges[0].text;
        switch (this.searchState) {
            case SearchState.Searching:
                if (text.length === 1) {
                    if (text[0] === this.triggerCharactersBlockComment[0]) {
                        this.searchState = SearchState.Locked;
                        this.triggerCharactersFound = this.triggerCharactersBlockComment;
                    }
                    else if (text[0] === this.triggerCharactersLineComment[0]) {
                        this.searchState = SearchState.Locked;
                        this.triggerCharactersFound = this.triggerCharactersLineComment;
                    }
                }
                break;

            case SearchState.Locked:
                if (text.length === 1 && text[0] === this.triggerCharactersFound[1]) {
                    this.searchState = SearchState.Found;
                }
                else {
                    this.searchState = SearchState.Searching;
                }
                break;
        }

        let r = changeEvent.contentChanges[0].range;
        console.log(`Search State: ${this.searchState.toString()}; Range: (${r.start.line}, ${r.start.character}), (${r.end.line}, ${r.end.character})`);
        if (this.searchState === SearchState.Found) {
            this.searchState = SearchState.Searching;
            if (this.languageClient) {
                let change = changeEvent.contentChanges[0];
                let triggerStartPos = change.range.start;
                let triggerEndPos = change.range.end;
                let doc = changeEvent.document;
                this.languageClient.sendRequest(
                    CommentHelpRequest.type,
                    {
                        documentUri: changeEvent.document.uri.toString(),
                        triggerPosition: triggerStartPos,
                        blockComment: this.isBlockComment
                    }).then(result => {
                        if (result === undefined) {
                            return;
                        }

                        let content = result.content;
                        if (content === undefined) {
                            return;
                        }

                        // todo remove the new line after help block
                        // todo get the eol character programmatically or let the server return one whole string
                        // todo add indentation level to the help content
                        let editor = vscode.window.activeTextEditor;
                        let replaceRange = new vscode.Range(triggerStartPos.translate(0, -1), triggerStartPos.translate(0, 1));
                        let text = content.join("\r\n");
                        editor.edit(editBuilder => editBuilder.replace(replaceRange, text));
                    });
            }
        }
    }
}
