// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import {
    Disposable, EndOfLine, Range, SnippetString,
    TextDocument, TextDocumentChangeEvent, window, workspace
} from "vscode";
import { RequestType } from "vscode-languageclient";
import { LanguageClient } from "vscode-languageclient/node";
import { Logger } from "../logging";
import Settings = require("../settings");
import { LanguageClientConsumer } from "../languageClientConsumer";

export const CommentHelpRequestType =
    new RequestType<any, any, void>("powerShell/getCommentHelp");

enum SearchState { Searching, Locked, Found }

export class HelpCompletionFeature extends LanguageClientConsumer {
    private helpCompletionProvider: HelpCompletionProvider | undefined;
    private disposable: Disposable | undefined;
    private settings: Settings.ISettings;

    constructor(private log: Logger) {
        super();
        this.settings = Settings.load();

        if (this.settings.helpCompletion !== Settings.CommentType.Disabled) {
            this.helpCompletionProvider = new HelpCompletionProvider();
            const subscriptions: Disposable[] = [];
            workspace.onDidChangeTextDocument(this.onEvent, this, subscriptions);
            this.disposable = Disposable.from(...subscriptions);
        }
    }

    public dispose() {
        this.disposable?.dispose();
    }

    public override setLanguageClient(languageClient: LanguageClient) {
        this.languageClient = languageClient;
        if (this.helpCompletionProvider) {
            this.helpCompletionProvider.languageClient = languageClient;
        }
    }

    public async onEvent(changeEvent: TextDocumentChangeEvent): Promise<void> {
        // If it's not a PowerShell script, we don't care about it.
        if (changeEvent.document.languageId !== "powershell") {
            return;
        }

        if (!(changeEvent && changeEvent.contentChanges)) {
            this.log.writeWarning(`<${HelpCompletionFeature.name}>: ` +
                `Bad TextDocumentChangeEvent message: ${JSON.stringify(changeEvent)}`);
            return;
        }

        if (changeEvent.contentChanges.length > 0) {
            this.helpCompletionProvider?.updateState(
                changeEvent.document,
                changeEvent.contentChanges[0].text,
                changeEvent.contentChanges[0].range);

            // todo raise an event when trigger is found, and attach complete() to the event.
            if (this.helpCompletionProvider?.triggerFound) {
                await this.helpCompletionProvider.complete();
                this.helpCompletionProvider.reset();
            }
        }
    }
}

class TriggerFinder {
    private state: SearchState;
    private document: TextDocument | undefined;
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
    private triggerFinderHelpComment: TriggerFinder;
    private lastChangeRange: Range | undefined;
    private lastDocument: TextDocument | undefined;
    private langClient: LanguageClient | undefined;
    private settings: Settings.ISettings;

    constructor() {
        this.triggerFinderHelpComment = new TriggerFinder("##");
        this.settings = Settings.load();
    }

    public get triggerFound(): boolean {
        return this.triggerFinderHelpComment.found;
    }

    public set languageClient(value: LanguageClient) {
        this.langClient = value;
    }

    public updateState(document: TextDocument, changeText: string, changeRange: Range): void {
        this.lastDocument = document;
        this.lastChangeRange = changeRange;
        this.triggerFinderHelpComment.updateState(document, changeText);
    }

    public reset(): void {
        this.triggerFinderHelpComment.reset();
    }

    public async complete(): Promise<void> {
        if (this.langClient === undefined || this.lastChangeRange === undefined || this.lastDocument === undefined) {
            return;
        }

        const triggerStartPos = this.lastChangeRange.start;
        const doc = this.lastDocument;

        const result = await this.langClient.sendRequest(CommentHelpRequestType, {
            documentUri: doc.uri.toString(),
            triggerPosition: triggerStartPos,
            blockComment: this.settings.helpCompletion === Settings.CommentType.BlockComment,
        });

        if (!(result && result.content)) {
            return;
        }

        const replaceRange = new Range(triggerStartPos.translate(0, -1), triggerStartPos.translate(0, 1));

        // TODO add indentation level to the help content
        // Trim leading whitespace (used by the rule for indentation) as VSCode takes care of the indentation.
        // Trim the last empty line and join the strings.
        const lines: string[] = result.content;
        const text = lines
            .map((x) => (x as any).trimLeft())
            .join(this.getEOL(doc.eol));

        const snippetString = new SnippetString(text);

        window.activeTextEditor?.insertSnippet(snippetString, replaceRange);
    }

    private getEOL(eol: EndOfLine): string {
        // there are only two type of EndOfLine types.
        if (eol === EndOfLine.CRLF) {
            return "\r\n";
        }

        return "\n";
    }
}
