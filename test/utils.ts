// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import * as path from "path";
import * as vscode from "vscode";
import { ILogger } from "../src/logging";
import { IPowerShellExtensionClient } from "../src/features/ExternalApi";

// This lets us test the rest of our path assumptions against the baseline of
// this test file existing at `<root>/out/test/utils.js`.
export const rootPath = path.resolve(__dirname, "../../");
// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-var-requires
const packageJSON: any = require(path.resolve(rootPath, "package.json"));
export const extensionId = `${packageJSON.publisher}.${packageJSON.name}`;

export class TestLogger implements ILogger {
    getLogFilePath(_baseName: string): vscode.Uri {
        return vscode.Uri.file("");
    }
    updateLogLevel(_logLevelName: string): void {
        return;
    }
    write(_message: string, ..._additionalMessages: string[]): void {
        return;
    }
    writeAndShowInformation(_message: string, ..._additionalMessages: string[]): Promise<void> {
        return Promise.resolve();
    }
    writeDiagnostic(_message: string, ..._additionalMessages: string[]): void {
        return;
    }
    writeVerbose(_message: string, ..._additionalMessages: string[]): void {
        return;
    }
    writeWarning(_message: string, ..._additionalMessages: string[]): void {
        return;
    }
    writeAndShowWarning(_message: string, ..._additionalMessages: string[]): Promise<void> {
        return Promise.resolve();
    }
    writeError(_message: string, ..._additionalMessages: string[]): void {
        return;
    }
    writeAndShowError(_message: string, ..._additionalMessages: string[]): Promise<void> {
        return Promise.resolve();
    }
    writeAndShowErrorWithActions(
        _message: string,
        _actions: { prompt: string; action: (() => Promise<void>) | undefined }[]): Promise<void> {
        return Promise.resolve();
    }
}

export const testLogger = new TestLogger();

export async function ensureExtensionIsActivated(): Promise<IPowerShellExtensionClient> {
    const extension = vscode.extensions.getExtension(extensionId);
    if (!extension!.isActive) { await extension!.activate(); }
    return extension!.exports as IPowerShellExtensionClient;
}

export async function ensureEditorServicesIsConnected(): Promise<IPowerShellExtensionClient> {
    const extension = await ensureExtensionIsActivated();
    const sessionId = extension.registerExternalExtension(extensionId);
    await extension.waitUntilStarted(sessionId);
    extension.unregisterExternalExtension(sessionId);
    return extension;
}
