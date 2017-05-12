/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import vscode = require('vscode');
import path = require('path');
import { IFeature } from '../feature';
import { LanguageClient } from 'vscode-languageclient';

export class ExamplesFeature implements IFeature {
    private command: vscode.Disposable;
    private examplesPath: string;

    constructor() {
        this.examplesPath = path.resolve(__dirname, "../../examples");
        this.command = vscode.commands.registerCommand('PowerShell.OpenExamplesFolder', () => {
            vscode.commands.executeCommand(
                "vscode.openFolder",
                vscode.Uri.file(this.examplesPath),
                true);
        });
    }

    public setLanguageClient(languageclient: LanguageClient) {
    }

    public dispose() {
        this.command.dispose();
    }
}