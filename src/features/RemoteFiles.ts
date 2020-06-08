/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import os = require("os");
import path = require("path");
import vscode = require("vscode");
import { LanguageClient, NotificationType, TextDocumentIdentifier } from "vscode-languageclient";
import { IFeature } from "../feature";
import { LanguageClientConsumer } from "../languageClientConsumer";

// NOTE: The following two DidSaveTextDocument* types will
// be removed when #593 gets fixed.

export interface IDidSaveTextDocumentParams {
    /**
     * The document that was closed.
     */
    textDocument: TextDocumentIdentifier;
}

export const DidSaveTextDocumentNotificationType =
    new NotificationType<IDidSaveTextDocumentParams, void>(
        "textDocument/didSave");

export class RemoteFilesFeature extends LanguageClientConsumer implements IFeature {

    private tempSessionPathPrefix: string;

    constructor() {
        super();
        // Get the common PowerShell Editor Services temporary file path
        // so that remote files from previous sessions can be closed.
        this.tempSessionPathPrefix =
            path.join(os.tmpdir(), "PSES-")
                .toLowerCase();

        // At startup, close any lingering temporary remote files
        this.closeRemoteFiles();

        vscode.workspace.onDidSaveTextDocument((doc) => {
            if (this.languageClient && this.isDocumentRemote(doc)) {
                this.languageClient.sendNotification(
                    DidSaveTextDocumentNotificationType,
                    {
                        textDocument: TextDocumentIdentifier.create(doc.uri.toString()),
                    });
            }
        });
    }

    public dispose() {
        // Close any leftover remote files before exiting
        this.closeRemoteFiles();
    }

    public setLanguageClient(languageclient: LanguageClient) {
        this.languageClient = languageclient;
    }

    private isDocumentRemote(doc: vscode.TextDocument) {
        return doc.fileName.toLowerCase().startsWith(this.tempSessionPathPrefix);
    }

    private closeRemoteFiles() {
        const remoteDocuments =
            vscode.workspace.textDocuments.filter((doc) => this.isDocumentRemote(doc));

        function innerCloseFiles(): Thenable<{}> {
            if (remoteDocuments.length > 0) {
                const doc = remoteDocuments.pop();

                return vscode.window
                    .showTextDocument(doc)
                    .then((editor) => vscode.commands.executeCommand("workbench.action.closeActiveEditor"))
                    .then((_) => innerCloseFiles());
            }
        }

        innerCloseFiles();
    }
}
