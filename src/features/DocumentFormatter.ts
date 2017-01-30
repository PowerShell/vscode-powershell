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
    Range,
    TextEditor
} from 'vscode';
import { LanguageClient, RequestType } from 'vscode-languageclient';
import Window = vscode.window;
import { IFeature } from '../feature';
import * as Settings from '../settings';
import * as Utils from '../utils';
import * as AnimatedStatusBar from '../controls/animatedStatusBar';

export namespace ScriptFileMarkersRequest {
    export const type: RequestType<any, any, void> = { get method(): string { return "powerShell/getScriptFileMarkers"; } };
}

// TODO move some of the common interface to a separate file?
interface ScriptFileMarkersRequestParams {
    fileUri: string;
    settings: any;
}

interface ScriptFileMarkersRequestResultParams {
    markers: ScriptFileMarker[];
}

interface ScriptFileMarker {
    message: string;
    level: ScriptFileMarkerLevel;
    scriptRegion: ScriptRegion;
    correction: MarkerCorrection;
}

enum ScriptFileMarkerLevel {
    Information = 0,
    Warning,
    Error
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

interface MarkerCorrection {
    name: string;
    edits: ScriptRegion[];
}

function editComparer(leftOperand: ScriptRegion, rightOperand: ScriptRegion): number {
    if (leftOperand.startLineNumber < rightOperand.startLineNumber) {
        return -1;
    } else if (leftOperand.startLineNumber > rightOperand.startLineNumber) {
        return 1;
    } else {
        if (leftOperand.startColumnNumber < rightOperand.startColumnNumber) {
            return -1;
        }
        else if (leftOperand.startColumnNumber > rightOperand.startColumnNumber) {
            return 1;
        }
        else {
            return 0;
        }
    }
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

class PSDocumentFormattingEditProvider implements DocumentFormattingEditProvider, DocumentRangeFormattingEditProvider {
    private static documentLocker = new DocumentLocker();
    private languageClient: LanguageClient;

    // The order in which the rules will be executed starting from the first element.
    private readonly ruleOrder: string[] = [
        "PSPlaceCloseBrace",
        "PSPlaceOpenBrace",
        "PSUseConsistentIndentation"];

    // Allows edits to be undone and redone is a single step.
    // It is usefuld to have undo stops after every edit while debugging
    // hence we keep this as an option but set it true by default.
    private aggregateUndoStop: boolean;

    private get emptyPromise(): Promise<TextEdit[]> {
        return Promise.resolve(TextEdit[0]);
    }

    constructor(aggregateUndoStop = true) {
        this.aggregateUndoStop = aggregateUndoStop;
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

        let textEdits: Thenable<TextEdit[]> = this.executeRulesInOrder(editor, range, options, 0);
        this.lockDocument(document, textEdits);

        // If the session crashes for any reason during formatting
        // then the document won't be released and hence we won't
        // be able to format it after restarting the session.
        // Similar issue with the status - the bar will keep displaying
        // the previous status even after restarting the session.
        // this.releaseDocument(document, textEdits);
        AnimatedStatusBar.showAnimatedStatusBarMessage("Formatting PowerShell document", textEdits);
        return textEdits;
    }

    getEditor(document: TextDocument): TextEditor {
        return Window.visibleTextEditors.find((e, n, obj) => { return e.document === document; });
    }

    isDocumentLocked(document: TextDocument): boolean {
        return PSDocumentFormattingEditProvider.documentLocker.isLocked(document);
    }

    lockDocument(document: TextDocument, unlockWhenDone: Thenable<any>): void {
        PSDocumentFormattingEditProvider.documentLocker.lock(document, unlockWhenDone);
    }

    executeRulesInOrder(
        editor: TextEditor,
        range: Range,
        options: FormattingOptions,
        index: number): Thenable<TextEdit[]> {
        if (this.languageClient !== null && index < this.ruleOrder.length) {
            let rule: string = this.ruleOrder[index];
            let uniqueEdits: ScriptRegion[] = [];
            let document: TextDocument = editor.document;
            let edits: ScriptRegion[];

            return this.languageClient.sendRequest(
                ScriptFileMarkersRequest.type,
                {
                    fileUri: document.uri.toString(),
                    settings: this.getSettings(rule)
                })
                .then((result: ScriptFileMarkersRequestResultParams) => {
                    edits = result.markers.map(marker => { return marker.correction.edits[0]; });

                    // sort in decending order of the edits
                    edits.sort((left: ScriptRegion, right: ScriptRegion) => {
                        return -1 * editComparer(left, right);
                    });

                    // We cannot handle multiple edits at the same point hence we
                    // filter the markers so that there is only one edit per line
                    // This ideally should not happen but it is good to have some additional safeguard
                    if (edits.length > 0) {
                        uniqueEdits.push(edits[0]);
                        for (let edit of edits.slice(1)) {
                            if (editComparer(uniqueEdits[uniqueEdits.length - 1], edit) !== 0) {
                                uniqueEdits.push(edit);
                            }
                        }
                    }

                    // we need to update the range as the edits might
                    // have changed the original layout
                    if (range !== null) {
                        let tempRange: Range = this.getSelectionRange(document);
                        if (tempRange !== null) {
                            range = tempRange;
                        }
                    }

                    // we do not return a valid array because our text edits
                    // need to be executed in a particular order and it is
                    // easier if we perform the edits ourselves
                    return this.applyEdit(editor, uniqueEdits, range, 0, index);
                })
                .then(() => {
                    // execute the same rule again if we left out violations
                    // on the same line
                    let newIndex: number = index + 1;
                    if (uniqueEdits.length !== edits.length) {
                        newIndex = index;
                    }

                    return this.executeRulesInOrder(editor, range, options, newIndex);
                });
        } else {
            return this.emptyPromise;
        }
    }

    applyEdit(
        editor: TextEditor,
        edits: ScriptRegion[],
        range: Range,
        markerIndex: number,
        ruleIndex: number): Thenable<void> {
        if (markerIndex >= edits.length) {
            return;
        }

        let undoStopAfter = !this.aggregateUndoStop || (ruleIndex === this.ruleOrder.length - 1 && markerIndex === edits.length - 1);
        let undoStopBefore = !this.aggregateUndoStop || (ruleIndex === 0 && markerIndex === 0);
        let edit: ScriptRegion = edits[markerIndex];
        let editRange: Range = new vscode.Range(
            edit.startLineNumber - 1,
            edit.startColumnNumber - 1,
            edit.endLineNumber - 1,
            edit.endColumnNumber - 1);
        if (range === null || range.contains(editRange)) {
            return editor.edit((editBuilder) => {
                editBuilder.replace(
                    editRange,
                    edit.text);
            },
                {
                    undoStopAfter: undoStopAfter,
                    undoStopBefore: undoStopBefore
                }).then((isEditApplied) => {
                    return this.applyEdit(editor, edits, range, markerIndex + 1, ruleIndex);
                }); // TODO handle rejection
        }
        else {
            return this.applyEdit(editor, edits, range, markerIndex + 1, ruleIndex);
        }
    }

    getSelectionRange(document: TextDocument): Range {
        let editor = vscode.window.visibleTextEditors.find(editor => editor.document === document);
        if (editor !== undefined) {
            return editor.selection as Range;
        }

        return null;
    }

    setLanguageClient(languageClient: LanguageClient): void {
        this.languageClient = languageClient;
        PSDocumentFormattingEditProvider.documentLocker.unlockAll();
    }

    getSettings(rule: string): any {
        let psSettings: Settings.ISettings = Settings.load(Utils.PowerShellLanguageId);
        let ruleSettings = new Object();
        ruleSettings["Enable"] = true;

        switch (rule) {
            case "PSPlaceOpenBrace":
                ruleSettings["OnSameLine"] = psSettings.codeFormatting.openBraceOnSameLine;
                ruleSettings["NewLineAfter"] = psSettings.codeFormatting.newLineAfterOpenBrace;
                break;

            case "PSUseConsistentIndentation":
                ruleSettings["IndentationSize"] = vscode.workspace.getConfiguration("editor").get<number>("tabSize");
                break;

            default:
                break;
        }

        let settings: Object = new Object();
        settings[rule] = ruleSettings;
        return settings;
    }
}

export class DocumentFormatterFeature implements IFeature {
    private formattingEditProvider: vscode.Disposable;
    private rangeFormattingEditProvider: vscode.Disposable;
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
    }

    public setLanguageClient(languageclient: LanguageClient): void {
        this.languageClient = languageclient;
        this.documentFormattingEditProvider.setLanguageClient(languageclient);
    }

    public dispose(): any {
        this.formattingEditProvider.dispose();
        this.rangeFormattingEditProvider.dispose();
    }
}