/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import os = require('os');
import path = require('path');
import vscode = require('vscode');
import { IFeature } from '../feature';
import { LanguageClient, RequestType, NotificationType, TextDocumentIdentifier } from 'vscode-languageclient';

// NOTE: The following two DidSaveTextDocument* types will
// be removed when #593 gets fixed.

export interface DidSaveTextDocumentParams {
	/**
	 * The document that was closed.
	 */
	textDocument: TextDocumentIdentifier;
}

export namespace DidSaveTextDocumentNotification {
    export const type: NotificationType<DidSaveTextDocumentParams> =
        { get method() { return 'textDocument/didSave'; } }
}

export class RemoteFilesFeature implements IFeature {

    private tempSessionPathPrefix: string;
    private languageClient: LanguageClient;

    constructor() {
        // Get the common PowerShell Editor Services temporary file path
        // so that remote files from previous sessions can be closed.
        this.tempSessionPathPrefix =
            path.join(os.tmpdir(), 'PSES-')
                .toLowerCase();

        // At startup, close any lingering temporary remote files
        this.closeRemoteFiles();

        vscode.workspace.onDidSaveTextDocument(doc => {
            if (this.languageClient && this.isDocumentRemote(doc)) {
                this.languageClient.sendNotification(
                    DidSaveTextDocumentNotification.type,
                    {
                        textDocument: TextDocumentIdentifier.create(doc.uri.toString())
                    });
            }
        })
    }

    public setLanguageClient(languageclient: LanguageClient) {
        this.languageClient = languageclient;
    }

    public dispose() {
        // Close any leftover remote files before exiting
        this.closeRemoteFiles();
    }

    private isDocumentRemote(doc: vscode.TextDocument) {
        return doc.languageId === "powershell" &&
               doc.fileName.toLowerCase().startsWith(this.tempSessionPathPrefix);
    }

    private closeRemoteFiles() {
        var remoteDocuments =
            vscode.workspace.textDocuments.filter(
                doc => this.isDocumentRemote(doc));

        function innerCloseFiles(): Thenable<{}> {
            if (remoteDocuments.length > 0) {
                var doc = remoteDocuments.pop();

                return vscode.window
                    .showTextDocument(doc)
                    .then(editor => vscode.commands.executeCommand("workbench.action.closeActiveEditor"))
                    .then(_ => innerCloseFiles());
            }
        };

        innerCloseFiles();
    }
}
