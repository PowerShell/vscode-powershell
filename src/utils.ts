/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

"use strict";

import fs = require("fs");
import os = require("os");
import path = require("path");

export const PowerShellLanguageId = "powershell";

export function ensurePathExists(targetPath: string) {
    // Ensure that the path exists
    try {
        fs.mkdirSync(targetPath);
    } catch (e) {
        // If the exception isn't to indicate that the folder exists already, rethrow it.
        if (e.code !== "EEXIST") {
            throw e;
        }
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
export type IWaitForSessionFileCallback = (details: IEditorServicesSessionDetails, error: string) => void;

const sessionsFolder = path.resolve(__dirname, "..", "..", "sessions/");
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

export function waitForSessionFile(sessionFilePath: string, callback: IWaitForSessionFileCallback) {

    function innerTryFunc(remainingTries: number, delayMilliseconds: number) {
        if (remainingTries === 0) {
            callback(undefined, "Timed out waiting for session file to appear.");
        } else if (!checkIfFileExists(sessionFilePath)) {
            // Wait a bit and try again
            setTimeout(
                () => { innerTryFunc(remainingTries - 1, delayMilliseconds); },
                delayMilliseconds);
        } else {
            // Session file was found, load and return it
            callback(readSessionFile(sessionFilePath), undefined);
        }
    }

    // Try once every 2 seconds, 60 times - making two full minutes
    innerTryFunc(60, 2000);
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

export function getTimestampString() {
    const time = new Date();
    return `[${time.getHours()}:${time.getMinutes()}:${time.getSeconds()}]`;
}

export const isMacOS: boolean = process.platform === "darwin";
export const isWindows: boolean = process.platform === "win32";
export const isLinux: boolean = !isMacOS && !isWindows;
