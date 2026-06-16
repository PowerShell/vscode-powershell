// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { type TelemetryReporter } from "@vscode/extension-telemetry";
import * as assert from "assert";
import Sinon from "sinon";
import * as vscode from "vscode";
import type { DocumentSelector } from "vscode-languageclient";
import type { ILogger } from "../../src/logging";
import { SessionManager } from "../../src/session";
import { stubInterface, TestLogger, testLogger } from "../utils";

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

describe("SessionManager restart prompt", () => {
    afterEach(() => {
        Sinon.restore();
    });

    function createSessionManager(logger: ILogger): SessionManager {
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

        return new SessionManager(
            stubInterface<vscode.ExtensionContext>({
                globalStorageUri: vscode.Uri.file("C:/tmp"),
                extensionMode: vscode.ExtensionMode.Test,
                subscriptions: [],
                logUri: vscode.Uri.file("C:/tmp"),
            }),
            logger,
            ["powershell"] as DocumentSelector,
            "Visual Studio Code",
            "PowerShell",
            "2026.5.0",
            "ms-vscode",
            stubInterface<TelemetryReporter>(),
        );
    }

    // Invokes the private `promptForRestart` method for testing.
    function promptForRestart(
        manager: SessionManager,
        reason?: vscode.TerminalExitReason,
    ): Promise<void> {
        return (
            manager as unknown as {
                promptForRestart: (
                    reason?: vscode.TerminalExitReason,
                ) => Promise<void>;
            }
        ).promptForRestart(reason);
    }

    it("prompts to restart when the user closes the terminal", async () => {
        const logger = new TestLogger();
        const prompt = Sinon.stub(
            logger,
            "writeAndShowErrorWithActions",
        ).resolves();
        const manager = createSessionManager(logger);

        await promptForRestart(manager, vscode.TerminalExitReason.User);

        assert.ok(
            prompt.calledOnce,
            "should prompt when the terminal is closed by the user",
        );
    });

    it("does not prompt to restart while disposing (#4101)", async () => {
        const logger = new TestLogger();
        const prompt = Sinon.stub(
            logger,
            "writeAndShowErrorWithActions",
        ).resolves();
        const manager = createSessionManager(logger);
        (manager as unknown as { isDisposing: boolean }).isDisposing = true;

        await promptForRestart(manager, vscode.TerminalExitReason.User);

        assert.ok(
            prompt.notCalled,
            "should not prompt while the session manager is disposing",
        );
    });

    it("does not prompt to restart when the window is shutting down (#4101)", async () => {
        const logger = new TestLogger();
        const prompt = Sinon.stub(
            logger,
            "writeAndShowErrorWithActions",
        ).resolves();
        const manager = createSessionManager(logger);

        await promptForRestart(manager, vscode.TerminalExitReason.Shutdown);

        assert.ok(
            prompt.notCalled,
            "should not prompt when VS Code is shutting down or reloading",
        );
    });

    it("does not show a second prompt while one is open (#4145)", async () => {
        const logger = new TestLogger();
        let resolvePrompt: (() => void) | undefined;
        const prompt = Sinon.stub(
            logger,
            "writeAndShowErrorWithActions",
        ).callsFake(
            () =>
                new Promise<void>((resolve) => {
                    resolvePrompt = resolve;
                }),
        );
        const manager = createSessionManager(logger);

        const first = promptForRestart(manager, vscode.TerminalExitReason.User);
        const second = promptForRestart(
            manager,
            vscode.TerminalExitReason.User,
        );

        // Let any microtasks settle so a (buggy) second prompt would have fired.
        await Promise.resolve();
        assert.ok(
            prompt.calledOnce,
            "should not show a second prompt while one is already open",
        );

        resolvePrompt?.();
        await Promise.all([first, second]);
    });

    it("does not prompt to restart when notifications are suppressed", async () => {
        const logger = new TestLogger();
        const prompt = Sinon.stub(
            logger,
            "writeAndShowErrorWithActions",
        ).resolves();
        const manager = createSessionManager(logger);
        Sinon.stub(vscode.workspace, "getConfiguration").returns(
            stubInterface<vscode.WorkspaceConfiguration>({
                get: () => true,
            }),
        );

        await promptForRestart(manager, vscode.TerminalExitReason.User);

        assert.ok(
            prompt.notCalled,
            "should respect suppressTerminalStoppedNotification",
        );
    });
});

function disposableStub(): vscode.Disposable {
    return {
        dispose: (): void => {
            return;
        },
    };
}
