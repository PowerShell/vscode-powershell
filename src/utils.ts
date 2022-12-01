// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import os = require("os");
import path = require("path");
import vscode = require("vscode");

export const PowerShellLanguageId = "powershell";

export function escapeSingleQuotes(p: string): string {
    return p.replace(new RegExp("'", "g"), "''");
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

// Check that the file or directory exists in an asynchronous manner that relies
// solely on the VS Code API, not Node's fs library, ignoring symlinks.
async function checkIfFileOrDirectoryExists(targetPath: string | vscode.Uri, type: vscode.FileType): Promise<boolean> {
    if (targetPath === "") {
        return false;
    }
    try {
        const stat: vscode.FileStat = await vscode.workspace.fs.stat(
            targetPath instanceof vscode.Uri
                ? targetPath
                : vscode.Uri.file(targetPath));
        return (stat.type & type) !== 0;
    } catch {
        // TODO: Maybe throw if it's not a FileNotFound exception.
        return false;
    }
}

export async function checkIfFileExists(filePath: string | vscode.Uri): Promise<boolean> {
    return await checkIfFileOrDirectoryExists(filePath, vscode.FileType.File);
}

export async function checkIfDirectoryExists(directoryPath: string | vscode.Uri): Promise<boolean> {
    return await checkIfFileOrDirectoryExists(directoryPath, vscode.FileType.Directory);
}

export async function readDirectory(directoryPath: string | vscode.Uri): Promise<string[]> {
    const items = await vscode.workspace.fs.readDirectory(
        directoryPath instanceof vscode.Uri
            ? directoryPath
            : vscode.Uri.file(directoryPath));
    return items.map(([name, _type]) => name);
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
