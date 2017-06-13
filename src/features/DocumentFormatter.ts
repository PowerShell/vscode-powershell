/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as path from "path";
import vscode = require('vscode');
import {
    TextDocument,
    TextEdit,
    FormattingOptions,
    CancellationToken,
    DocumentFormattingEditProvider,
    DocumentRangeFormattingEditProvider,
    OnTypeFormattingEditProvider,
    Position,
    Range,
    TextEditor,
    TextLine
} from 'vscode';
import {
    LanguageClient,
    RequestType,
    DocumentFormattingRequest,
    DocumentRangeFormattingParams,
    DocumentRangeFormattingRequest
} from 'vscode-languageclient';
import { TextDocumentIdentifier } from "vscode-languageserver-types";
import Window = vscode.window;
import { IFeature } from '../feature';
import * as Settings from '../settings';
import * as Utils from '../utils';
import * as AnimatedStatusBar from '../controls/animatedStatusBar';

export namespace ScriptRegionRequest {
    export const type = new RequestType<any, any, void, void>("powerShell/getScriptRegion");
}

interface ScriptRegionRequestParams {
    fileUri: string;
    character: string;
    line: number;
    column: number;
}

interface ScriptRegionRequestResult {
    scriptRegion: ScriptRegion;
}

interface ScriptRegion {
    file: string;
    text: string;
    startLineNumber: number;
    startColumnNumber: number;
    startOffset: number;
    endLineNumber: number;
    endColumnNumber: number;
    endOffset: number;
}

function toRange(scriptRegion: ScriptRegion): vscode.Range {
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
    private lockedDocuments: Object;

    constructor() {
        this.lockedDocuments = new Object();
    }

    isLocked(document: TextDocument): boolean {
        return this.isLockedInternal(this.getKey(document));
    }

    lock(document: TextDocument, unlockWhenDone?: Thenable<any>): void {
        this.lockInternal(this.getKey(document), unlockWhenDone);
    }

    unlock(document: TextDocument): void {
        this.unlockInternal(this.getKey(document));
    }

    unlockAll(): void {
        Object.keys(this.lockedDocuments).slice().forEach(documentKey => this.unlockInternal(documentKey));
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
    private languageClient: LanguageClient;

    private get emptyPromise(): Promise<TextEdit[]> {
        return Promise.resolve(TextEdit[0]);
    }

    constructor() {
    }

    provideDocumentFormattingEdits(
        document: TextDocument,
        options: FormattingOptions,
        token: CancellationToken): TextEdit[] | Thenable<TextEdit[]> {
        return this.provideDocumentRangeFormattingEdits(document, null, options, token);
   }

    provideDocumentRangeFormattingEdits(
        document: TextDocument,
        range: Range,
        options: FormattingOptions,
        token: CancellationToken): TextEdit[] | Thenable<TextEdit[]> {

        let editor: TextEditor = this.getEditor(document);
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
                    character: range.start.character
                },
                end: {
                    line: range.end.line,
                    character: range.end.character
                }
            };
        };

        let requestParams: DocumentRangeFormattingParams = {
            textDocument: TextDocumentIdentifier.create(document.uri.toString()),
            range: rangeParam,
            options: this.getEditorSettings()
        };

        let textEdits = this.languageClient.sendRequest(
            DocumentRangeFormattingRequest.type,
            requestParams);
        this.lockDocument(document, textEdits);
        PSDocumentFormattingEditProvider.showStatusBar(document, textEdits);
        return textEdits;
    }

    provideOnTypeFormattingEdits(
        document: TextDocument,
        position: Position,
        ch: string,
        options: FormattingOptions,
        token: CancellationToken): TextEdit[] | Thenable<TextEdit[]> {
        return this.getScriptRegion(document, position, ch).then(scriptRegion => {
            if (scriptRegion === null) {
                return this.emptyPromise;
            }

            return this.provideDocumentRangeFormattingEdits(
                document,
                toRange(scriptRegion),
                options,
                token);
        });
    }

    setLanguageClient(languageClient: LanguageClient): void {
        this.languageClient = languageClient;

        // setLanguageClient is called while restarting a session,
        // so this makes sure we clean up the document locker and
        // any residual status bars
        PSDocumentFormattingEditProvider.documentLocker.unlockAll();
        PSDocumentFormattingEditProvider.disposeAllStatusBars();
    }

    private getScriptRegion(document: TextDocument, position: Position, ch: string): Thenable<ScriptRegion> {
        let oneBasedPosition = toOneBasedPosition(position);
        return this.languageClient.sendRequest(
            ScriptRegionRequest.type,
            {
                fileUri: document.uri.toString(),
                character: ch,
                line: oneBasedPosition.line,
                column: oneBasedPosition.character
            }).then((result: ScriptRegionRequestResult) => {
                if (result === null) {
                    return null;
                }

                return result.scriptRegion;
            });
    }

    private getEditor(document: TextDocument): TextEditor {
        return Window.visibleTextEditors.find((e, n, obj) => { return e.document === document; });
    }

    private isDocumentLocked(document: TextDocument): boolean {
        return PSDocumentFormattingEditProvider.documentLocker.isLocked(document);
    }

    private lockDocument(document: TextDocument, unlockWhenDone: Thenable<any>): void {
        PSDocumentFormattingEditProvider.documentLocker.lock(document, unlockWhenDone);
    }

    private getEditorSettings(): { insertSpaces: boolean, tabSize: number } {
        let editorConfiguration = vscode.workspace.getConfiguration("editor");
        return {
            insertSpaces: editorConfiguration.get<boolean>("insertSpaces"),
            tabSize: editorConfiguration.get<number>("tabSize")
        };
    }

    private static showStatusBar(document: TextDocument, hideWhenDone: Thenable<any>): void {
        let statusBar = AnimatedStatusBar.showAnimatedStatusBarMessage("Formatting PowerShell document", hideWhenDone);
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
}

export class DocumentFormatterFeature implements IFeature {
    private firstTriggerCharacter: string = "}";
    private moreTriggerCharacters: string[] = ["\n"];
    private formattingEditProvider: vscode.Disposable;
    private rangeFormattingEditProvider: vscode.Disposable;
    private onTypeFormattingEditProvider: vscode.Disposable;
    private languageClient: LanguageClient;
    private documentFormattingEditProvider: PSDocumentFormattingEditProvider;

    constructor() {
        this.documentFormattingEditProvider = new PSDocumentFormattingEditProvider();
        this.formattingEditProvider = vscode.languages.registerDocumentFormattingEditProvider(
            "powershell",
            this.documentFormattingEditProvider);
        this.rangeFormattingEditProvider = vscode.languages.registerDocumentRangeFormattingEditProvider(
            "powershell",
            this.documentFormattingEditProvider);
        this.onTypeFormattingEditProvider = vscode.languages.registerOnTypeFormattingEditProvider(
            "powershell",
            this.documentFormattingEditProvider,
            this.firstTriggerCharacter,
            ...this.moreTriggerCharacters);
    }

    public setLanguageClient(languageclient: LanguageClient): void {
        this.languageClient = languageclient;
        this.documentFormattingEditProvider.setLanguageClient(languageclient);
    }

    public dispose(): any {
        this.formattingEditProvider.dispose();
        this.rangeFormattingEditProvider.dispose();
        this.onTypeFormattingEditProvider.dispose();
    }
}
