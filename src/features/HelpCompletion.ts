/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { IFeature } from "../feature";
import { TextDocumentChangeEvent, workspace, Disposable, Position, window, Range, EndOfLine, SnippetString, TextDocument } from "vscode";
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
    private helpCompletionProvider: HelpCompletionProvider;
    private languageClient: LanguageClient;
    private disposable: Disposable;

    constructor() {
        this.helpCompletionProvider = new HelpCompletionProvider();
        let subscriptions = [];
        workspace.onDidChangeTextDocument(this.onEvent, this, subscriptions);
        this.disposable = Disposable.from(...subscriptions);
    }

    setLanguageClient(languageClient: LanguageClient) {
        this.languageClient = languageClient;
        this.helpCompletionProvider.languageClient = languageClient;
    }

    dispose() {
        this.disposable.dispose();
    }

    onEvent(changeEvent: TextDocumentChangeEvent): void {
        this.helpCompletionProvider.updateState(
            changeEvent.document,
            changeEvent.contentChanges[0].text,
            changeEvent.contentChanges[0].range);

        // todo raise an event when trigger is found, and attach complete() to the event.
        if (this.helpCompletionProvider.triggerFound) {
            this.helpCompletionProvider.reset();
            this.helpCompletionProvider.complete();
        }

    }
}

class TriggerFinder {
    private state: SearchState;
    private document: TextDocument;
    private count: number;
    constructor(private triggerCharacters: string) {
        this.state = SearchState.Searching;
        this.count = 0;
    }

    public get found(): boolean {
        return this.state === SearchState.Found;
    }

    public updateState(document: TextDocument, changeText: string): void {
        switch (this.state) {
            case SearchState.Searching:
                if (changeText.length === 1 && changeText[0] === this.triggerCharacters[this.count]) {
                    this.state = SearchState.Locked;
                    this.document = document;
                    this.count++;
                }
                break;

            case SearchState.Locked:
                if (changeText.length === 1 && changeText[0] === this.triggerCharacters[this.count] && document === this.document) {
                    this.count++;
                    if (this.count === this.triggerCharacters.length) {
                        this.state = SearchState.Found;
                    }
                }
                else {
                    this.reset();
                }
                break;

            default:
                this.reset();
                break;
        }
    }

    public reset(): void {
        this.state = SearchState.Searching;
        this.count = 0;
    }
}

class HelpCompletionProvider {
    private triggerFinderBlockComment: TriggerFinder;
    private triggerFinderLineComment: TriggerFinder;
    private lastChangeText: string;
    private lastChangeRange: Range;
    private lastDocument: TextDocument;
    private langClient: LanguageClient;

    constructor() {
        this.triggerFinderBlockComment = new TriggerFinder("<#");
        this.triggerFinderLineComment = new TriggerFinder("##");
    }

    public get triggerFound(): boolean {
        return this.triggerFinderBlockComment.found || this.triggerFinderLineComment.found;
    }

    public set languageClient(value: LanguageClient) {
        this.langClient = value;
    }

    public updateState(document: TextDocument, changeText: string, changeRange: Range): void {
        this.lastDocument = document;
        this.lastChangeText = changeText;
        this.lastChangeRange = changeRange;
        this.triggerFinderBlockComment.updateState(document, changeText);
        this.triggerFinderLineComment.updateState(document, changeText);
    }

    public reset(): void {
        this.triggerFinderBlockComment.reset();
        this.triggerFinderLineComment.reset();
    }

    public complete(): Thenable<void> {
        if (this.langClient === undefined) {
            return;
        }

        let change = this.lastChangeText;
        let triggerStartPos = this.lastChangeRange.start;
        let triggerEndPos = this.lastChangeRange.end;
        let doc = this.lastDocument;
        this.langClient.sendRequest(
            CommentHelpRequest.type,
            {
                documentUri: doc.uri.toString(),
                triggerPosition: triggerStartPos,
                blockComment: this.triggerFinderBlockComment.found
            }).then(result => {
                if (result === undefined) {
                    return;
                }

                let content = result.content;
                if (content === undefined) {
                    return;
                }

                // todo add indentation level to the help content
                let editor = window.activeTextEditor;
                let replaceRange = new Range(triggerStartPos.translate(0, -1), triggerStartPos.translate(0, 1));

                // Trim the last empty line and join the strings.
                let text = content.slice(0, -1).join(this.getEOL(doc.eol));
                editor.insertSnippet(new SnippetString(text), replaceRange);
            });
    }

    private getEOL(eol: EndOfLine): string {
        // there are only two type of EndOfLine types.
        if (eol === EndOfLine.CRLF) {
            return "\r\n";
        }

        return "\n";
    }
}
