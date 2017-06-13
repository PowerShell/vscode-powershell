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
import { LanguageClient, RequestType, DocumentFormattingRequest } from 'vscode-languageclient';
import { TextDocumentIdentifier } from "vscode-languageserver-types";
import Window = vscode.window;
import { IFeature } from '../feature';
import * as Settings from '../settings';
import * as Utils from '../utils';
import * as AnimatedStatusBar from '../controls/animatedStatusBar';

export namespace ScriptFileMarkersRequest {
    export const type = new RequestType<any, any, void, void>("powerShell/getScriptFileMarkers");
}

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

class PSDocumentFormattingEditProvider implements
        DocumentFormattingEditProvider,
        DocumentRangeFormattingEditProvider,
        OnTypeFormattingEditProvider {
    private static documentLocker = new DocumentLocker();
    private static statusBarTracker = new Object();
    private languageClient: LanguageClient;
    private lineDiff: number;

    // The order in which the rules will be executed starting from the first element.
    private readonly ruleOrder: string[] = [
        "PSPlaceCloseBrace",
        "PSPlaceOpenBrace",
        "PSUseConsistentWhitespace",
        "PSUseConsistentIndentation",
        "PSAlignAssignmentStatement"]

    // Allows edits to be undone and redone is a single step.
    // It is usefuld to have undo stops after every edit while debugging
    // hence we keep this as an option but set it true by default.
    private aggregateUndoStop: boolean;

    private get emptyPromise(): Promise<TextEdit[]> {
        return Promise.resolve(TextEdit[0]);
    }

    constructor(aggregateUndoStop = true) {
        this.aggregateUndoStop = aggregateUndoStop;
        this.lineDiff = 0;
    }

    provideDocumentFormattingEdits(
        document: TextDocument,
        options: FormattingOptions,
        token: CancellationToken): TextEdit[] | Thenable<TextEdit[]> {
        return this.languageClient.sendRequest(
            DocumentFormattingRequest.type,
            {
                textDocument: TextDocumentIdentifier.create(document.uri.toString()),
                options: {
                    insertSpaces: true,
                    tabSize: 4
                }
            });
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

    private snapRangeToEdges(range: Range, document: TextDocument): Range {
        return range.with({
            start: range.start.with({ character: 0 }),
            end: document.lineAt(range.end.line).range.end });
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

    private executeRulesInOrder(
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


                    // we need to update the range as the edits might
                    // have changed the original layout
                    if (range !== null) {
                        if (this.lineDiff !== 0) {
                            range = range.with({ end: range.end.translate({ lineDelta: this.lineDiff }) });
                        }

                        // extend the range such that it starts at the first character of the
                        // start line of the range.
                        range = this.snapRangeToEdges(range, document);

                        // filter edits that are contained in the input range
                        edits = edits.filter(edit => range.contains(toRange(edit).start));
                    }

                    // We cannot handle multiple edits at the same point hence we
                    // filter the markers so that there is only one edit per region
                    if (edits.length > 0) {
                        uniqueEdits.push(edits[0]);
                        for (let edit of edits.slice(1)) {
                            let lastEdit: ScriptRegion = uniqueEdits[uniqueEdits.length - 1];
                            if (lastEdit.startLineNumber !== edit.startLineNumber
                                || (edit.startColumnNumber + edit.text.length) < lastEdit.startColumnNumber) {
                                uniqueEdits.push(edit);
                            }
                        }
                    }

                    // reset line difference to 0
                    this.lineDiff = 0;

                    // we do not return a valid array because our text edits
                    // need to be executed in a particular order and it is
                    // easier if we perform the edits ourselves
                    return this.applyEdit(editor, uniqueEdits, 0, index);
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

    private applyEdit(
        editor: TextEditor,
        edits: ScriptRegion[],
        markerIndex: number,
        ruleIndex: number): Thenable<void> {
        if (markerIndex >= edits.length) {
            return;
        }

        let undoStopAfter = !this.aggregateUndoStop || (ruleIndex === this.ruleOrder.length - 1 && markerIndex === edits.length - 1);
        let undoStopBefore = !this.aggregateUndoStop || (ruleIndex === 0 && markerIndex === 0);
        let edit: ScriptRegion = edits[markerIndex];
        let editRange: Range = toRange(edit);


        // accumulate the changes in number of lines
        // get the difference between the number of lines in the replacement text and
        // that of the original text
        this.lineDiff += this.getNumLines(edit.text) - (editRange.end.line - editRange.start.line + 1);
        return editor.edit((editBuilder) => {
            editBuilder.replace(
                editRange,
                edit.text);
        },
            {
                undoStopAfter: undoStopAfter,
                undoStopBefore: undoStopBefore
            }).then((isEditApplied) => {
                return this.applyEdit(editor, edits, markerIndex + 1, ruleIndex);
            }); // TODO handle rejection
    }

    private getNumLines(text: string): number {
        return text.split(/\r?\n/).length;
    }

    private getSettings(rule: string): any {
        let psSettings: Settings.ISettings = Settings.load(Utils.PowerShellLanguageId);
        let ruleSettings = new Object();
        ruleSettings["Enable"] = true;

        switch (rule) {
            case "PSPlaceOpenBrace":
                ruleSettings["OnSameLine"] = psSettings.codeFormatting.openBraceOnSameLine;
                ruleSettings["NewLineAfter"] = psSettings.codeFormatting.newLineAfterOpenBrace;
                ruleSettings["IgnoreOneLineBlock"] = psSettings.codeFormatting.ignoreOneLineBlock;
                break;

            case "PSPlaceCloseBrace":
                ruleSettings["IgnoreOneLineBlock"] = psSettings.codeFormatting.ignoreOneLineBlock;
                ruleSettings["NewLineAfter"] = psSettings.codeFormatting.newLineAfterCloseBrace;
                break;

            case "PSUseConsistentIndentation":
                ruleSettings["IndentationSize"] = vscode.workspace.getConfiguration("editor").get<number>("tabSize");
                break;

            case "PSUseConsistentWhitespace":
                ruleSettings["CheckOpenBrace"] = psSettings.codeFormatting.whitespaceBeforeOpenBrace;
                ruleSettings["CheckOpenParen"] = psSettings.codeFormatting.whitespaceBeforeOpenParen;
                ruleSettings["CheckOperator"] = psSettings.codeFormatting.whitespaceAroundOperator;
                ruleSettings["CheckSeparator"] = psSettings.codeFormatting.whitespaceAfterSeparator;
                break;

            case "PSAlignAssignmentStatement":
                ruleSettings["CheckHashtable"] = psSettings.codeFormatting.alignPropertyValuePairs;
                break;

            default:
                break;
        }

        let settings: Object = new Object();
        settings[rule] = ruleSettings;
        return settings;
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
