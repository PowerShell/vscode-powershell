/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import os = require('os');
import path = require('path');
import vscode = require('vscode');
import { IFeature } from '../feature';
import { LanguageClient, RequestType, NotificationType } from 'vscode-languageclient';

export class RemoteFilesFeature implements IFeature {

    private tempSessionPathPrefix: string;

    constructor() {
        // Get the common PowerShell Editor Services temporary file path
        // so that remote files from previous sessions can be closed.
        this.tempSessionPathPrefix =
            path.join(os.tmpdir(), 'PSES-')
                .toLowerCase();

        // At startup, close any lingering temporary remote files
        this.closeRemoteFiles();

        // TEMPORARY: Register for the onDidSave event so that we can alert
        // the user when they attempt to save a remote file.  We don't
        // currently propagate saved content back to the remote session.
        vscode.workspace.onDidSaveTextDocument(doc => {
            if (this.isDocumentRemote(doc)) {
                vscode.window.showWarningMessage(
                    "Changes to remote files are not yet saved back in the remote session, coming in 0.10.0.");
            }
        })
    }

    public setLanguageClient(languageclient: LanguageClient) {
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
