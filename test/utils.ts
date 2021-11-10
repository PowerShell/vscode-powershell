// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

"use strict";

import * as path from "path";
import * as vscode from "vscode";
import { IPowerShellExtensionClient } from "../src/features/ExternalApi";

// This lets us test the rest of our path assumptions against the baseline of
// this test file existing at `<root>/out/test/utils.js`.
export const rootPath = path.resolve(__dirname, "../../")
// tslint:disable-next-line: no-var-requires
const packageJSON: any = require(path.resolve(rootPath, "package.json"));
export const extensionId = `${packageJSON.publisher}.${packageJSON.name}`;

export async function ensureExtensionIsActivated(): Promise<vscode.Extension<any>> {
    const extension = vscode.extensions.getExtension(extensionId);
    if (!extension.isActive) { await extension.activate(); }
    return extension;
}

export async function ensureEditorServicesIsConnected(): Promise<void> {
    const powershellExtension = await ensureExtensionIsActivated();
    const client = powershellExtension!.exports as IPowerShellExtensionClient;
    const sessionId = client.registerExternalExtension(extensionId);
    await client.waitUntilStarted(sessionId);
    client.unregisterExternalExtension(sessionId);
}
