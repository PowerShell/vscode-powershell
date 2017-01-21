/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import vscode = require('vscode');
import {
    languages,
    TextDocument,
    TextEdit,
    FormattingOptions,
    CancellationToken,
    DocumentFormattingEditProvider,
    DocumentRangeFormattingEditProvider,
    Range,
} from 'vscode';
import { LanguageClient, RequestType, NotificationType } from 'vscode-languageclient';
import Window = vscode.window;
import { IFeature } from '../feature';
import * as Settings from '../settings';
import * as Utils from '../utils';

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
    edits: ScriptRegion[]
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

class PSDocumentFormattingEditProvider implements DocumentFormattingEditProvider, DocumentRangeFormattingEditProvider {
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
        let textEdits = this.executeRulesInOrder(document, range, options, 0);
        Window.setStatusBarMessage("formatting...", textEdits);
        return textEdits;
    }

    executeRulesInOrder(
        document: TextDocument,
        range: Range,
        options: FormattingOptions,
        index: number): Thenable<TextEdit[]> {
        if (this.languageClient !== null && index < this.ruleOrder.length) {
            let rule = this.ruleOrder[index];
            let uniqueEdits: ScriptRegion[] = [];
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
                    return this.applyEdit(uniqueEdits, range, 0, index);
                })
                .then(() => {
                    // execute the same rule again if we left out violations
                    // on the same line
                    if (uniqueEdits.length !== edits.length) {
                        return this.executeRulesInOrder(document, range, options, index);
                    }
                    return this.executeRulesInOrder(document, range, options, index + 1);
                });
        } else {
            return Promise.resolve(new TextEdit[0]);
        }
    }

    applyEdit(edits: ScriptRegion[], range: Range, markerIndex: number, ruleIndex: number): Thenable<void> {
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
            return Window.activeTextEditor.edit((editBuilder) => {
                editBuilder.replace(
                    editRange,
                    edit.text);
            },
                {
                    undoStopAfter: undoStopAfter,
                    undoStopBefore: undoStopBefore
                }).then((isEditApplied) => {
                    return this.applyEdit(edits, range, markerIndex + 1, ruleIndex);
                }); // TODO handle rejection
        }
        else {
            return this.applyEdit(edits, range, markerIndex + 1, ruleIndex);
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