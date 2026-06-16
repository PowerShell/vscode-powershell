// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { type TelemetryReporter } from "@vscode/extension-telemetry";
import * as assert from "assert";
import Sinon from "sinon";
import * as vscode from "vscode";
import type { DocumentSelector } from "vscode-languageclient";
import {
    type IPowerShellVersionDetails,
    SessionManager,
} from "../../src/session";
import { stubInterface, testLogger } from "../utils";

describe("SessionManager middleware", () => {
    afterEach(() => {
        Sinon.restore();
    });

    it("delays didOpen until session initialization completes", async () => {
        const registerCommandStub = Sinon.stub(
            vscode.commands,
            "registerCommand",
        ).returns(disposableStub());
        const onDidChangeConfigurationStub = Sinon.stub(
            vscode.workspace,
            "onDidChangeConfiguration",
        ).returns(disposableStub());

        Sinon.stub(vscode.languages, "createLanguageStatusItem").returns(
            stubInterface<vscode.LanguageStatusItem>({
                text: "",
                detail: "",
                busy: false,
                severity: vscode.LanguageStatusSeverity.Information,
                dispose: () => {
                    return;
                },
            }),
        );

        const manager = new SessionManager(
            stubInterface<vscode.ExtensionContext>({
                globalStorageUri: vscode.Uri.file("C:/tmp"),
                extensionMode: vscode.ExtensionMode.Test,
                subscriptions: [],
                logUri: vscode.Uri.file("C:/tmp"),
            }),
            testLogger,
            ["powershell"] as DocumentSelector,
            "Visual Studio Code",
            "PowerShell",
            "2026.5.0",
            "ms-vscode",
            stubInterface<TelemetryReporter>(),
        );

        const document = stubInterface<vscode.TextDocument>();
        let nextCalled = false;
        const next = Sinon.spy(
            (_document: vscode.TextDocument): Promise<void> => {
                nextCalled = true;
                return Promise.resolve();
            },
        );

        const didOpen = manager.didOpen;
        const didOpenPromise = didOpen(document, next);

        await Promise.resolve();
        assert.equal(
            nextCalled,
            false,
            "didOpen should wait for initialization",
        );

        (
            manager as unknown as {
                started: PromiseWithResolvers<undefined>;
            }
        ).started.resolve(undefined);

        await didOpenPromise;
        assert.equal(
            nextCalled,
            true,
            "didOpen should run after initialization",
        );
        assert.ok(
            registerCommandStub.calledThrice,
            "SessionManager should register its commands in constructor",
        );
        assert.ok(
            onDidChangeConfigurationStub.calledOnce,
            "SessionManager should register configuration listener in constructor",
        );
    });

    it("delays didChange until session initialization completes", async () => {
        Sinon.stub(vscode.commands, "registerCommand").returns(
            disposableStub(),
        );
        Sinon.stub(vscode.workspace, "onDidChangeConfiguration").returns(
            disposableStub(),
        );

        Sinon.stub(vscode.languages, "createLanguageStatusItem").returns(
            stubInterface<vscode.LanguageStatusItem>({
                text: "",
                detail: "",
                busy: false,
                severity: vscode.LanguageStatusSeverity.Information,
                dispose: () => {
                    return;
                },
            }),
        );

        const manager = new SessionManager(
            stubInterface<vscode.ExtensionContext>({
                globalStorageUri: vscode.Uri.file("C:/tmp"),
                extensionMode: vscode.ExtensionMode.Test,
                subscriptions: [],
                logUri: vscode.Uri.file("C:/tmp"),
            }),
            testLogger,
            ["powershell"] as DocumentSelector,
            "Visual Studio Code",
            "PowerShell",
            "2026.5.0",
            "ms-vscode",
            stubInterface<TelemetryReporter>(),
        );

        const changeEvent = stubInterface<vscode.TextDocumentChangeEvent>();
        let nextCalled = false;
        const next = Sinon.spy(
            (_event: vscode.TextDocumentChangeEvent): Promise<void> => {
                nextCalled = true;
                return Promise.resolve();
            },
        );

        const didChange = manager.didChange;
        const didChangePromise = didChange(changeEvent, next);

        await Promise.resolve();
        assert.equal(
            nextCalled,
            false,
            "didChange should wait for initialization",
        );

        (
            manager as unknown as {
                started: PromiseWithResolvers<undefined>;
            }
        ).started.resolve(undefined);

        await didChangePromise;
        assert.equal(
            nextCalled,
            true,
            "didChange should run after initialization",
        );
    });
});

describe("SessionManager.getVersionDetails", () => {
    afterEach(() => {
        Sinon.restore();
    });

    it("returns undefined instead of throwing when the request rejects", async () => {
        const manager = makeManager();
        // Simulate the request rejecting, as it does when our timeout cancels
        // the token. This must not throw out of getVersionDetails().
        setSendRequest(manager, () => Promise.reject(new Error("Canceled")));

        const result = await getVersionDetails(manager);
        assert.strictEqual(
            result,
            undefined,
            "a rejected (e.g. timed-out/cancelled) request should resolve to undefined",
        );
    });

    it("returns the details on the normal fast path", async () => {
        const manager = makeManager();
        const details: IPowerShellVersionDetails = {
            version: "7.4.0",
            edition: "Core",
            commit: "7.4.0",
            architecture: "X64",
        };
        setSendRequest(manager, () => Promise.resolve(details));

        const result = await getVersionDetails(manager);
        assert.strictEqual(result, details);
    });
});

function makeManager(): SessionManager {
    Sinon.stub(vscode.commands, "registerCommand").returns(disposableStub());
    Sinon.stub(vscode.workspace, "onDidChangeConfiguration").returns(
        disposableStub(),
    );
    Sinon.stub(vscode.languages, "createLanguageStatusItem").returns(
        stubInterface<vscode.LanguageStatusItem>({
            text: "",
            detail: "",
            busy: false,
            severity: vscode.LanguageStatusSeverity.Information,
            dispose: () => {
                return;
            },
        }),
    );

    return new SessionManager(
        stubInterface<vscode.ExtensionContext>({
            globalStorageUri: vscode.Uri.file("C:/tmp"),
            extensionMode: vscode.ExtensionMode.Test,
            subscriptions: [],
            logUri: vscode.Uri.file("C:/tmp"),
        }),
        testLogger,
        ["powershell"] as DocumentSelector,
        "Visual Studio Code",
        "PowerShell",
        "2026.5.0",
        "ms-vscode",
        stubInterface<TelemetryReporter>(),
    );
}

function setSendRequest(
    manager: SessionManager,
    sendRequest: () => Promise<IPowerShellVersionDetails | undefined>,
): void {
    (
        manager as unknown as {
            languageClient: {
                sendRequest: () => Promise<
                    IPowerShellVersionDetails | undefined
                >;
            };
        }
    ).languageClient = { sendRequest };
}

function getVersionDetails(
    manager: SessionManager,
): Promise<IPowerShellVersionDetails | undefined> {
    return (
        manager as unknown as {
            getVersionDetails(): Promise<IPowerShellVersionDetails | undefined>;
        }
    ).getVersionDetails();
}

function disposableStub(): vscode.Disposable {
    return {
        dispose: (): void => {
            return;
        },
    };
}
