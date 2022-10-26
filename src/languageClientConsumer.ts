// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { window } from "vscode";
import { LanguageClient } from "vscode-languageclient/node";

export abstract class LanguageClientConsumer {

    private _languageClient: LanguageClient | undefined;

    public setLanguageClient(languageClient: LanguageClient) {
        this.languageClient = languageClient;
    }

    abstract dispose(): void;

    public get languageClient(): LanguageClient | undefined {
        if (!this._languageClient) {
            // TODO: Plumb through the logger.
            void window.showInformationMessage("PowerShell extension has not finished starting up yet. Please try again in a few moments.");
        }
        return this._languageClient;
    }

    public set languageClient(value: LanguageClient | undefined) {
        this._languageClient = value;
    }
}
