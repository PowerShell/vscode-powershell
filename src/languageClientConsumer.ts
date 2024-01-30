// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { ProgressLocation, window } from "vscode";
import { LanguageClient } from "vscode-languageclient/node";

export abstract class LanguageClientConsumer {
    private static languageClientPromise?: Promise<LanguageClient>;
    private static getLanguageClientResolve?: (value: LanguageClient) => void;

    // Implementations of this class must override this method to register their
    // handlers, as its called whenever the client is restarted / replaced.
    public abstract onLanguageClientSet(languageClient: LanguageClient): void;

    // This is called in the session manager when the client is started (so we
    // can wait for that). It's what actually resolves the promise.
    public static onLanguageClientStarted(languageClient: LanguageClient): void {
        // It should have been created earlier, but if not, create and resolve it.
        this.languageClientPromise ??= Promise.resolve(languageClient);
        this.getLanguageClientResolve?.(languageClient);
    }

    // This is called in the session manager when the client exits so we can
    // make a new promise.
    public static onLanguageClientExited(): void {
        this.languageClientPromise = undefined;
        this.getLanguageClientResolve = undefined;
    }

    // We should have a promise as defined in resetLanguageClient, but if we
    // don't, create it.
    public static async getLanguageClient(): Promise<LanguageClient> {
        // If it hasn't been created or was rejected, recreate it.
        LanguageClientConsumer.languageClientPromise?.catch(() => {
            LanguageClientConsumer.languageClientPromise = undefined;
        });
        LanguageClientConsumer.languageClientPromise ??= LanguageClientConsumer.createLanguageClientPromise();
        return LanguageClientConsumer.languageClientPromise;
    }

    // This waits for the language client to start and shows a cancellable
    // loading message. (It just wrap the static method below.)
    private static async createLanguageClientPromise(): Promise<LanguageClient> {
        return window.withProgress<LanguageClient>(
            {
                location: ProgressLocation.Notification,
                title: "Please wait, starting PowerShell Extension Terminal...",
                cancellable: true
            },
            (_progress, token) => {
                token.onCancellationRequested(() => {
                    void window.showErrorMessage("Cancelled PowerShell Extension Terminal start-up.");
                });

                // The real promise!
                return new Promise<LanguageClient>(
                    (resolve, reject) => {
                        // Store the resolve function to be called in resetLanguageClient.
                        LanguageClientConsumer.getLanguageClientResolve = resolve;
                        // Reject the promise if the operation is cancelled.
                        token.onCancellationRequested(() => { reject(new Error("Cancelled PowerShell Extension Terminal start-up.")); });
                    }
                );
            });
    }
}
