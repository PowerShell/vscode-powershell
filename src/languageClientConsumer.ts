/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { window } from "vscode";
import { LanguageClient } from "vscode-languageclient";

export abstract class LanguageClientConsumer {

    private _languageClient: LanguageClient;

    public setLanguageClient(languageClient: LanguageClient) {
        this.languageClient = languageClient;
    }

    abstract dispose(): void;

    public get languageClient(): LanguageClient {
        if (!this._languageClient) {
            window.showInformationMessage(
                "PowerShell extension has not finished starting up yet. Please try again in a few moments.");
        }
        return this._languageClient;
    }

    public set languageClient(value: LanguageClient) {
        this._languageClient = value;
    }
}
