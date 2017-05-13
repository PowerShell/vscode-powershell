/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import vscode = require("vscode");
import { IFeature } from "../feature";
import { TextDocumentChangeEvent, workspace, Disposable } from "vscode";
import { LanguageClient } from "vscode-languageclient/lib/main";

export class HelpCompletionFeature implements IFeature {
    private languageClient: LanguageClient;
    private triggerCharacters: string;
    private disposable: Disposable;
    constructor() {
        this.triggerCharacters = "#<";
        let subscriptions = [];
        workspace.onDidChangeTextDocument(this.onEvent, this, subscriptions);
        this.disposable = Disposable.from(...subscriptions);
    }

    setLanguageClient(languageclient: LanguageClient) {
        this.languageClient = languageclient;
    }

    dispose() {

    }

    onEvent(changeEvent: TextDocumentChangeEvent): void {
        console.log(`event triggered. change content: ${changeEvent.contentChanges[0].text}`);
    }
}
