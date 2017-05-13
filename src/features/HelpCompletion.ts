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
}

interface CommentHelpRequestResult {
    content: string[];
}

enum SearchState { Searching, Locked, Found };

export class HelpCompletionFeature implements IFeature {
    private languageClient: LanguageClient;
    private triggerCharacters: string;
    private disposable: Disposable;
    private searchState: SearchState;
    constructor() {
        this.triggerCharacters = "#<";
        let subscriptions = [];
        workspace.onDidChangeTextDocument(this.onEvent, this, subscriptions);
        this.searchState = SearchState.Searching;
        this.disposable = Disposable.from(...subscriptions);
    }

    setLanguageClient(languageclient: LanguageClient) {
        this.languageClient = languageclient;
    }

    dispose() {
        this.disposable.dispose();
    }

    onEvent(changeEvent: TextDocumentChangeEvent): void {
        let text = changeEvent.contentChanges[0].text;
        switch (this.searchState) {
            case SearchState.Searching:
                if (text.length === 1 && text[0] === this.triggerCharacters[0]) {
                    this.searchState = SearchState.Locked;
                }
                break;

            case SearchState.Locked:
                if (text.length === 1 && text[0] === this.triggerCharacters[1]) {
                    this.searchState = SearchState.Found;
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
                        triggerPosition: triggerStartPos
                    }).then(result => {
                        let content = result.content;
                        if (content === undefined) {
                            return;
                        }

                        // todo allow "##" as trigger characters
                        // todo remove the new line after help block
                        // todo get the eol character programmatically or let the server return one whole string
                        let editor = vscode.window.activeTextEditor;
                        let replaceRange = new vscode.Range(triggerStartPos.translate(0, -1), triggerStartPos.translate(0, 1));
                        let text = content.join("\r\n");
                        editor.edit(editbuilder => editbuilder.replace(replaceRange, text));
                    });
            }
        }
    }
}
