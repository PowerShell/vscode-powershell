/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { Disposable, EndOfLine, Position, Range, SnippetString,
    TextDocument, TextDocumentChangeEvent, window, workspace } from "vscode";
import { LanguageClient, RequestType } from "vscode-languageclient";
import { IFeature } from "../feature";

export const CommentHelpRequestType =
    new RequestType<any, any, void, void>("powerShell/getCommentHelp");

interface ICommentHelpRequestParams {
    documentUri: string;
    triggerPosition: Position;
    blockComment: boolean;
}

interface ICommentHelpRequestResult {
    content: string[];
}

enum SearchState { Searching, Locked, Found }

export class HelpCompletionFeature implements IFeature {
    private helpCompletionProvider: HelpCompletionProvider;
    private languageClient: LanguageClient;
    private disposable: Disposable;

    constructor() {
        this.helpCompletionProvider = new HelpCompletionProvider();
        const subscriptions = [];
        workspace.onDidChangeTextDocument(this.onEvent, this, subscriptions);
        this.disposable = Disposable.from(...subscriptions);
    }

    public dispose() {
        this.disposable.dispose();
    }

    public setLanguageClient(languageClient: LanguageClient) {
        this.languageClient = languageClient;
        this.helpCompletionProvider.languageClient = languageClient;
    }

    public onEvent(changeEvent: TextDocumentChangeEvent): void {
        if (!changeEvent) {
            return;
        }

        this.helpCompletionProvider.updateState(
            changeEvent.document,
            changeEvent.contentChanges[0].text,
            changeEvent.contentChanges[0].range);

        // todo raise an event when trigger is found, and attach complete() to the event.
        if (this.helpCompletionProvider.triggerFound) {
            this.helpCompletionProvider.complete().then(() => this.helpCompletionProvider.reset());
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
                if (document === this.document &&
                        changeText.length === 1 &&
                        changeText[0] === this.triggerCharacters[this.count]) {
                    this.count++;
                    if (this.count === this.triggerCharacters.length) {
                        this.state = SearchState.Found;
                    }
                } else {
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

        const change = this.lastChangeText;
        const triggerStartPos = this.lastChangeRange.start;
        const triggerEndPos = this.lastChangeRange.end;
        const doc = this.lastDocument;

        return this.langClient.sendRequest(
            CommentHelpRequestType,
            {
                documentUri: doc.uri.toString(),
                triggerPosition: triggerStartPos,
                blockComment: this.triggerFinderBlockComment.found,
            }).then((result) => {
                if (result == null || result.content == null) {
                    return;
                }

                // todo add indentation level to the help content
                const editor = window.activeTextEditor;
                const replaceRange = new Range(triggerStartPos.translate(0, -1), triggerStartPos.translate(0, 1));

                // Trim leading whitespace (used by the rule for indentation) as VSCode takes care of the indentation.
                // Trim the last empty line and join the strings.
                const text = result.content.map((x) => x.trimLeft()).slice(0, -1).join(this.getEOL(doc.eol));
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
