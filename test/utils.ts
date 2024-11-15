// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import * as path from "path";
import * as vscode from "vscode";
import { ILogger } from "../src/logging";
import { IPowerShellExtensionClient } from "../src/features/ExternalApi";
import { execSync } from "child_process";

// This lets us test the rest of our path assumptions against the baseline of
// this test file existing at `<root>/test/utils.js`.
export const rootPath = path.resolve(__dirname, "../");
// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-var-requires
const packageJSON: any = require(path.resolve(rootPath, "package.json"));
export const extensionId = `${packageJSON.publisher}.${packageJSON.name}`;

export class TestLogger implements ILogger {
    logDirectoryPath: vscode.Uri = vscode.Uri.file("");
    updateLogLevel(_logLevelName: string): void {
        return;
    }
    write(_message: string, ..._additionalMessages: string[]): void {
        return;
    }
    writeAndShowInformation(_message: string, ..._additionalMessages: string[]): Promise<void> {
        return Promise.resolve();
    }
    writeTrace(_message: string, ..._additionalMessages: string[]): void {
        return;
    }
    writeDebug(_message: string, ..._additionalMessages: string[]): void {
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

/**
 * This is a workaround for sinon not being able to stub interfaces. Interfaces are a TypeScript-only concept so this effectively allows us to stub interfaces by not providing the entire implementation but only what matters for the test. "What matters" is not type checked so you must be careful to stub everything you need, otherwise you should provide a default implementation instead if you do not know.
*/
export function stubInterface<T>(object?: Partial<T>): T {
    return object ? object as T : {} as T;
}

/** Builds the sample binary module code. We need to do this because the source maps have absolute paths so they are not portable between machines, and while we could do deterministic with source maps, that's way more complicated and everywhere we build has dotnet already anyways */
export function BuildBinaryModuleMock(): void {
    const projectPath = path.resolve(`${__dirname}/../test/mocks/BinaryModule/BinaryModule.csproj`);
    try {
        execSync(`dotnet publish ${projectPath}`, {
            encoding: "utf8"
        });
    } catch (err) {
        throw new Error(`Failed to build the binary module mock. Please ensure that you have the .NET Core SDK installed: ${err}`);
    }
}

/** Waits until the registered vscode event is fired and returns the trigger result of the event.
 * @param event The event to wait for
 * @param filter An optional filter to apply to the event TResult. The filter will continue to monitor the event firings until the filter returns true.
 * @returns A promise that resolves when the specified event is fired with the TResult subject of the event. If a filter is specified, the promise will not resolve until the filter returns true.
*/
export function WaitEvent<TResult>(event: vscode.Event<TResult>, filter?: (event: TResult) => boolean | undefined): Promise<TResult> {
    return new Promise<TResult>((resolve) => {
        const listener = event((result: TResult) => {
            if (!filter || filter(result)) {
                listener.dispose();
                resolve(result);
            }
        });
    });
}
