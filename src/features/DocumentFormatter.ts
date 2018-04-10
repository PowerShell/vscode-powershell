/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as path from "path";
import vscode = require("vscode");
import {
    CancellationToken,
    DocumentFormattingEditProvider,
    DocumentRangeFormattingEditProvider,
    FormattingOptions,
    OnTypeFormattingEditProvider,
    Position,
    Range,
    TextDocument,
    TextEdit,
    TextEditor,
    TextLine,
} from "vscode";
import {
    DocumentFormattingRequest,
    DocumentRangeFormattingParams,
    DocumentRangeFormattingRequest,
    DocumentSelector,
    LanguageClient,
    RequestType,
} from "vscode-languageclient";
import { TextDocumentIdentifier } from "vscode-languageserver-types";
import Window = vscode.window;
import * as AnimatedStatusBar from "../controls/animatedStatusBar";
import { IFeature } from "../feature";
import { Logger } from "../logging";
import * as Settings from "../settings";
import * as Utils from "../utils";

export const ScriptRegionRequestType = new RequestType<any, any, void, void>("powerShell/getScriptRegion");

interface IScriptRegionRequestParams {
    fileUri: string;
    character: string;
    line: number;
    column: number;
}

interface IScriptRegionRequestResult {
    scriptRegion: IScriptRegion;
}

interface IScriptRegion {
    file: string;
    text: string;
    startLineNumber: number;
    startColumnNumber: number;
    startOffset: number;
    endLineNumber: number;
    endColumnNumber: number;
    endOffset: number;
}

function toRange(scriptRegion: IScriptRegion): vscode.Range {
    return new vscode.Range(
        scriptRegion.startLineNumber - 1,
        scriptRegion.startColumnNumber - 1,
        scriptRegion.endLineNumber - 1,
        scriptRegion.endColumnNumber - 1);
}

function toOneBasedPosition(position: Position): Position {
    return position.translate({ lineDelta: 1, characterDelta: 1 });
}

class DocumentLocker {
    // tslint:disable-next-line:ban-types
    private lockedDocuments: Object;

    constructor() {
        this.lockedDocuments = new Object();
    }

    public isLocked(document: TextDocument): boolean {
        return this.isLockedInternal(this.getKey(document));
    }

    public lock(document: TextDocument, unlockWhenDone?: Thenable<any>): void {
        this.lockInternal(this.getKey(document), unlockWhenDone);
    }

    public unlock(document: TextDocument): void {
        this.unlockInternal(this.getKey(document));
    }

    public unlockAll(): void {
        Object.keys(this.lockedDocuments).slice().forEach((documentKey) => this.unlockInternal(documentKey));
    }

    private getKey(document: TextDocument): string {
        return document.uri.toString();
    }

    private lockInternal(documentKey: string, unlockWhenDone?: Thenable<any>): void {
        if (!this.isLockedInternal(documentKey)) {
            this.lockedDocuments[documentKey] = true;
        }

        if (unlockWhenDone !== undefined) {
            unlockWhenDone.then(() => this.unlockInternal(documentKey));
        }
    }

    private unlockInternal(documentKey: string): void {
        if (this.isLockedInternal(documentKey)) {
            delete this.lockedDocuments[documentKey];
        }
    }

    private isLockedInternal(documentKey: string): boolean {
        return this.lockedDocuments.hasOwnProperty(documentKey);
    }
}

class PSDocumentFormattingEditProvider implements
    DocumentFormattingEditProvider,
    DocumentRangeFormattingEditProvider,
    OnTypeFormattingEditProvider {

    private static documentLocker = new DocumentLocker();
    private static statusBarTracker = new Object();

    private static showStatusBar(document: TextDocument, hideWhenDone: Thenable<any>): void {
        const statusBar =
            AnimatedStatusBar.showAnimatedStatusBarMessage("Formatting PowerShell document", hideWhenDone);
        this.statusBarTracker[document.uri.toString()] = statusBar;
        hideWhenDone.then(() => {
            this.disposeStatusBar(document.uri.toString());
        });
    }

    private static disposeStatusBar(documentUri: string) {
        if (this.statusBarTracker.hasOwnProperty(documentUri)) {
            this.statusBarTracker[documentUri].dispose();
            delete this.statusBarTracker[documentUri];
        }
    }

    private static disposeAllStatusBars() {
        Object.keys(this.statusBarTracker).slice().forEach((key) => this.disposeStatusBar(key));
    }

    private languageClient: LanguageClient;

    private get emptyPromise(): Promise<TextEdit[]> {
        return Promise.resolve(TextEdit[0]);
    }

    constructor(private logger: Logger) {
    }

    public setLanguageClient(languageClient: LanguageClient): void {
        this.languageClient = languageClient;

        // setLanguageClient is called while restarting a session,
        // so this makes sure we clean up the document locker and
        // any residual status bars
        PSDocumentFormattingEditProvider.documentLocker.unlockAll();
        PSDocumentFormattingEditProvider.disposeAllStatusBars();
    }

    public provideDocumentFormattingEdits(
        document: TextDocument,
        options: FormattingOptions,
        token: CancellationToken): TextEdit[] | Thenable<TextEdit[]> {

        this.logger.writeVerbose(`Formatting entire document - ${document.uri}...`);
        return this.sendDocumentFormatRequest(document, null, options, token);
    }

    public provideDocumentRangeFormattingEdits(
        document: TextDocument,
        range: Range,
        options: FormattingOptions,
        token: CancellationToken): TextEdit[] | Thenable<TextEdit[]> {

        this.logger.writeVerbose(`Formatting document range ${JSON.stringify(range)} - ${document.uri}...`);
        return this.sendDocumentFormatRequest(document, range, options, token);
    }

    public provideOnTypeFormattingEdits(
        document: TextDocument,
        position: Position,
        ch: string,
        options: FormattingOptions,
        token: CancellationToken): TextEdit[] | Thenable<TextEdit[]> {

        this.logger.writeVerbose(`Formatting on type at position ${JSON.stringify(position)} - ${document.uri}...`);

        return this.getScriptRegion(document, position, ch).then((scriptRegion) => {
            if (scriptRegion === null) {
                this.logger.writeVerbose("No formattable range returned.");
                return this.emptyPromise;
            }

            return this.sendDocumentFormatRequest(
                document,
                toRange(scriptRegion),
                options,
                token);
            },
            (err) => {
                this.logger.writeVerbose(`Error while requesting script region for formatting: ${err}`);
            });
    }

    private sendDocumentFormatRequest(
        document: TextDocument,
        range: Range,
        options: FormattingOptions,
        token: CancellationToken): TextEdit[] | Thenable<TextEdit[]> {

        const editor: TextEditor = this.getEditor(document);
        if (editor === undefined) {
            return this.emptyPromise;
        }

        // Check if the document is already being formatted.
        // If so, then ignore the formatting request.
        if (this.isDocumentLocked(document)) {
            return this.emptyPromise;
        }

        // somehow range object gets serialized to an array of Position objects,
        // so we need to use the object literal syntax to initialize it.
        let rangeParam = null;
        if (range != null) {
            rangeParam = {
                start: {
                    line: range.start.line,
                    character: range.start.character,
                },
                end: {
                    line: range.end.line,
                    character: range.end.character,
                },
            };
        }

        const requestParams: DocumentRangeFormattingParams = {
            textDocument: TextDocumentIdentifier.create(document.uri.toString()),
            range: rangeParam,
            options: this.getEditorSettings(),
        };

        const formattingStartTime = new Date().valueOf();
        function getFormattingDuration() {
            return ((new Date().valueOf()) - formattingStartTime) / 1000;
        }

        const textEdits = this.languageClient.sendRequest(
            DocumentRangeFormattingRequest.type,
            requestParams);
        this.lockDocument(document, textEdits);
        PSDocumentFormattingEditProvider.showStatusBar(document, textEdits);

        return textEdits.then(
            (edits) => {
                this.logger.writeVerbose(`Document formatting finished in ${getFormattingDuration()}s`);
                return edits;
            },
            (err) => {
                this.logger.writeVerbose(`Document formatting failed in ${getFormattingDuration()}: ${err}`);
            });
    }

    private getScriptRegion(document: TextDocument, position: Position, ch: string): Thenable<IScriptRegion> {
        const oneBasedPosition = toOneBasedPosition(position);
        return this.languageClient.sendRequest(
            ScriptRegionRequestType,
            {
                fileUri: document.uri.toString(),
                character: ch,
                line: oneBasedPosition.line,
                column: oneBasedPosition.character,
            }).then((result: IScriptRegionRequestResult) => {
                if (result === null) {
                    return null;
                }

                return result.scriptRegion;
            });
    }

    private getEditor(document: TextDocument): TextEditor {
        return Window.visibleTextEditors.find((e, n, obj) => e.document === document);
    }

    private isDocumentLocked(document: TextDocument): boolean {
        return PSDocumentFormattingEditProvider.documentLocker.isLocked(document);
    }

    private lockDocument(document: TextDocument, unlockWhenDone: Thenable<any>): void {
        PSDocumentFormattingEditProvider.documentLocker.lock(document, unlockWhenDone);
    }

    private getEditorSettings(): { insertSpaces: boolean, tabSize: number } {
        const editorConfiguration = vscode.workspace.getConfiguration("editor");
        return {
            insertSpaces: editorConfiguration.get<boolean>("insertSpaces"),
            tabSize: editorConfiguration.get<number>("tabSize"),
        };
    }
}

export class DocumentFormatterFeature implements IFeature {
    private firstTriggerCharacter: string = "}";
    private moreTriggerCharacters: string[] = ["\n"];
    private formattingEditProvider: vscode.Disposable;
    private rangeFormattingEditProvider: vscode.Disposable;
    private onTypeFormattingEditProvider: vscode.Disposable;
    private languageClient: LanguageClient;
    private documentFormattingEditProvider: PSDocumentFormattingEditProvider;

    constructor(private logger: Logger, documentSelector: DocumentSelector) {
        this.documentFormattingEditProvider = new PSDocumentFormattingEditProvider(logger);
        this.formattingEditProvider = vscode.languages.registerDocumentFormattingEditProvider(
            documentSelector,
            this.documentFormattingEditProvider);
        this.rangeFormattingEditProvider = vscode.languages.registerDocumentRangeFormattingEditProvider(
            documentSelector,
            this.documentFormattingEditProvider);
        this.onTypeFormattingEditProvider = vscode.languages.registerOnTypeFormattingEditProvider(
            documentSelector,
            this.documentFormattingEditProvider,
            this.firstTriggerCharacter,
            ...this.moreTriggerCharacters);
    }

    public dispose(): any {
        this.formattingEditProvider.dispose();
        this.rangeFormattingEditProvider.dispose();
        this.onTypeFormattingEditProvider.dispose();
    }

    public setLanguageClient(languageclient: LanguageClient): void {
        this.languageClient = languageclient;
        this.documentFormattingEditProvider.setLanguageClient(languageclient);
    }
}
