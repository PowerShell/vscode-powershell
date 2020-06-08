/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { LanguageClient, IFeature } from "./feature";
import { window } from "vscode";

export class LanguageClientConsumer {
    private _languageClient: LanguageClient;

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