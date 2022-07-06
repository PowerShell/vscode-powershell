// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

"use strict";

import fs = require("fs");
import os = require("os");
import path = require("path");
import vscode = require("vscode");

export const PowerShellLanguageId = "powershell";

export function ensurePathExists(targetPath: string): void {
    // Ensure that the path exists
    try {
        // TODO: Use vscode.workspace.fs
        fs.mkdirSync(targetPath);
    } catch (e) {
        // If the exception isn't to indicate that the folder exists already, rethrow it.
        if (e.code !== "EEXIST") {
            throw e;
        }
    }
}

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

export interface IEditorServicesSessionDetails {
    status: string;
    reason: string;
    detail: string;
    powerShellVersion: string;
    channel: string;
    languageServicePort: number;
    debugServicePort: number;
    languageServicePipeName: string;
    debugServicePipeName: string;
}

export type IReadSessionFileCallback = (details: IEditorServicesSessionDetails) => void;

const sessionsFolder = path.resolve(__dirname, "../sessions");
const sessionFilePathPrefix = path.resolve(sessionsFolder, "PSES-VSCode-" + process.env.VSCODE_PID);

// Create the sessions path if it doesn't exist already
ensurePathExists(sessionsFolder);

export function getSessionFilePath(uniqueId: number) {
    return `${sessionFilePathPrefix}-${uniqueId}`;
}

export function getDebugSessionFilePath() {
    return `${sessionFilePathPrefix}-Debug`;
}

export function writeSessionFile(sessionFilePath: string, sessionDetails: IEditorServicesSessionDetails) {
    ensurePathExists(sessionsFolder);

    const writeStream = fs.createWriteStream(sessionFilePath);
    writeStream.write(JSON.stringify(sessionDetails));
    writeStream.close();
}


export function readSessionFile(sessionFilePath: string): IEditorServicesSessionDetails {
    const fileContents = fs.readFileSync(sessionFilePath, "utf-8");
    return JSON.parse(fileContents);
}

export function deleteSessionFile(sessionFilePath: string) {
    try {
        fs.unlinkSync(sessionFilePath);
    } catch (e) {
        // TODO: Be more specific about what we're catching
    }
}

export function checkIfFileExists(filePath: string): boolean {
    try {
        fs.accessSync(filePath, fs.constants.R_OK);
        return true;
    } catch (e) {
        return false;
    }
}

export function checkIfDirectoryExists(directoryPath: string): boolean {
    try {
        // tslint:disable-next-line:no-bitwise
        fs.accessSync(directoryPath, fs.constants.R_OK | fs.constants.O_DIRECTORY);
        return true;
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
