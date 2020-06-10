/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { window } from "vscode";
import { LanguageClient } from "vscode-languageclient";

export abstract class LanguageClientConsumer {

    abstract setLanguageClient(languageclient: LanguageClient): void;
    abstract dispose(): void;

    public get languageClient(): LanguageClient {
        if (!this.languageClient) {
            window.showInformationMessage(
                "PowerShell extension has not finished starting up yet. Please try again in a few moments.");
        }
        return this.languageClient;
    }

    public set languageClient(value: LanguageClient) {
        this.languageClient = value;
    }
}