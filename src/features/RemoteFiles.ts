// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import os = require("os");
import path = require("path");
import vscode = require("vscode");
import { NotificationType, TextDocumentIdentifier } from "vscode-languageclient";
import { LanguageClientConsumer } from "../languageClientConsumer";
import type { LanguageClient } from "vscode-languageclient/node";

// NOTE: The following two DidSaveTextDocument* types will
// be removed when #593 gets fixed.

export interface IDidSaveTextDocumentParams {
    /**
     * The document that was closed.
     */
    textDocument: TextDocumentIdentifier;
}

export const DidSaveTextDocumentNotificationType =
    new NotificationType<IDidSaveTextDocumentParams>(
        "textDocument/didSave");

export class RemoteFilesFeature extends LanguageClientConsumer {
    private command: vscode.Disposable;
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

        this.command = vscode.workspace.onDidSaveTextDocument(async (doc) => {
            if (this.isDocumentRemote(doc)) {
                const client = await LanguageClientConsumer.getLanguageClient();
                await client.sendNotification(
                    DidSaveTextDocumentNotificationType,
                    {
                        textDocument: TextDocumentIdentifier.create(doc.uri.toString()),
                    });
            }
        });
    }

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    public override onLanguageClientSet(_languageClient: LanguageClient): void {}

    public dispose(): void {
        this.command.dispose();
        // Close any leftover remote files before exiting
        this.closeRemoteFiles();
    }

    private isDocumentRemote(doc: vscode.TextDocument): boolean {
        return doc.fileName.toLowerCase().startsWith(this.tempSessionPathPrefix);
    }

    private closeRemoteFiles(): void {
        const remoteDocuments =
            vscode.workspace.textDocuments.filter((doc) => this.isDocumentRemote(doc));

        async function innerCloseFiles(): Promise<void> {
            const doc = remoteDocuments.pop();
            if (doc === undefined) {
                return;
            }

            await vscode.window.showTextDocument(doc);
            await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
            await innerCloseFiles();
        }

        void innerCloseFiles();
    }
}
