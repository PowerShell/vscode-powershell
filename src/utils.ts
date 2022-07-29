// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

"use strict";

import fs = require("fs");
import os = require("os");
import path = require("path");
import vscode = require("vscode");

export const PowerShellLanguageId = "powershell";

// Check that the file exists in an asynchronous manner that relies solely on the VS Code API, not Node's fs library.
export async function fileExists(targetPath: string | vscode.Uri): Promise<boolean> {
    try {
            await vscode.workspace.fs.stat(
                targetPath instanceof vscode.Uri
                    ? targetPath
                    : vscode.Uri.file(targetPath));
        return true;
    } catch (e) {
        if (e instanceof vscode.FileSystemError.FileNotFound) {
            return false;
        }
        throw e;
    }

}

export function getPipePath(pipeName: string) {
    if (os.platform() === "win32") {
        return "\\\\.\\pipe\\" + pipeName;
    } else {
        // Windows uses NamedPipes where non-Windows platforms use Unix Domain Sockets.
        // This requires connecting to the pipe file in different locations on Windows vs non-Windows.
        return path.join(os.tmpdir(), `CoreFxPipe_${pipeName}`);
    }
}

export async function checkIfFileExists(filePath: vscode.Uri): Promise<boolean> {
    try {
        const stat: vscode.FileStat = await vscode.workspace.fs.stat(filePath);
        return stat.type === vscode.FileType.File;
    } catch (e) {
        return false;
    }
}

export async function checkIfDirectoryExists(directoryPath: string): Promise<boolean> {
    try {
        const stat: vscode.FileStat = await vscode.workspace.fs.stat(vscode.Uri.file(directoryPath));
        return stat.type === vscode.FileType.Directory;
    } catch (e) {
        return false;
    }
}

export function getTimestampString() {
    const time = new Date();
    return `[${time.getHours()}:${time.getMinutes()}:${time.getSeconds()}]`;
}

export function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export const isMacOS: boolean = process.platform === "darwin";
export const isWindows: boolean = process.platform === "win32";
export const isLinux: boolean = !isMacOS && !isWindows;
