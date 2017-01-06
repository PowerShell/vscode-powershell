import vscode = require('vscode');
import { languages, TextDocument, TextEdit, FormattingOptions, CancellationToken } from 'vscode'
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
    filePath: string;
    rules: string[];
    settings: string;
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

class PSDocumentFormattingEditProvider implements vscode.DocumentFormattingEditProvider {
    private languageClient: LanguageClient;
    private readonly ruleOrder: string[] = [
        "PSPlaceCloseBrace",
        "PSPlaceOpenBrace",
        "PSUseConsistentIndentation"];

    provideDocumentFormattingEdits(
        document: TextDocument,
        options: FormattingOptions,
        token: CancellationToken): TextEdit[] | Thenable<TextEdit[]> {

        // we need to order the edits such that edit i should not invalidate
        // the edits in edit j s.t i < j (seems like a hard problem)
        // or
        // peform edits ourself and return an empty textedit array
        return this.executeRulesInOrder(document, options, 0);
    }

    executeRulesInOrder(
        document: TextDocument,
        options: FormattingOptions,
        index: number): Thenable<TextEdit[]> | TextEdit[] {
        if (this.languageClient !== null && index < this.ruleOrder.length) {
            let rule = this.ruleOrder[index];
            return this.languageClient.sendRequest(
                ScriptFileMarkersRequest.type,
                {
                    filePath: document.fileName,
                    rules: [rule],
                    settings: this.getSettings(rule)
                })
                .then((result: ScriptFileMarkersRequestResultParams) => {

                    // TODO modify undo stops to make sure all the edits
                    // can be undone and redone in a single step

                    // sort in decending order of the edits
                    result.markers.sort(function(a: ScriptFileMarker, b: ScriptFileMarker): number {
                        let leftOperand: number = a.correction.edits[0].startLineNumber,
                            rightOperand: number = b.correction.edits[0].startLineNumber;
                        if (leftOperand < rightOperand) {
                            return 1;
                        } else if (leftOperand > rightOperand) {
                            return -1;
                        } else {
                            return 0;
                        }
                    });
                    return this.applyEdits(result.markers, 0);

                    // we do not return a valid array because our text edits
                    // need to be executed in a particular order and it is
                    // easier if we perform the edits ourselves
                })
                .then(() => {
                    return this.executeRulesInOrder(document, options, index + 1);
                });
        } else {
            return TextEdit[0];
        }
    }

    applyEdits(markers: ScriptFileMarker[], index: number): Thenable<void> {
        if (index >= markers.length) {
            return;
        }

        let edit: ScriptRegion = markers[index].correction.edits[0];
        return Window.activeTextEditor.edit((editBuilder) => {
            editBuilder.replace(
                new vscode.Range(
                    edit.startLineNumber - 1,
                    edit.startColumnNumber - 1,
                    edit.endLineNumber - 1,
                    edit.endColumnNumber - 1),
                edit.text);
        }).then((isEditApplied) => {
            return this.applyEdits(markers, index + 1);
        }); // TODO handle rejection
    }

    setLanguageClient(languageClient: LanguageClient): void {
        this.languageClient = languageClient;
    }

    getSettings(rule: string): string {
        let settings: Settings.ISettings = Settings.load(Utils.PowerShellLanguageId);
        return `@{
    IncludeRules = @('${rule}')
    Rules = @{
                PSPlaceOpenBrace = @{
                    OnSameLine = \$${settings.codeformatting.openBraceOnSameLine}
        }
    }
}`;
    }
}

export class DocumentFormatterFeature implements IFeature {
    private disposable: vscode.Disposable;
    private languageClient: LanguageClient;
    private documentFormattingEditProvider: PSDocumentFormattingEditProvider;

    constructor() {
        this.documentFormattingEditProvider = new PSDocumentFormattingEditProvider();
        this.disposable = vscode.languages.registerDocumentFormattingEditProvider(
            "powershell",
            this.documentFormattingEditProvider);
    }

    public setLanguageClient(languageclient: LanguageClient): void {
        this.languageClient = languageclient;
        this.documentFormattingEditProvider.setLanguageClient(languageclient);
    }

    public dispose(): any {
        this.disposable.dispose();
    }
}