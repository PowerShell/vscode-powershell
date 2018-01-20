/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

"use strict";

import fs = require("fs");
import os = require("os");
import path = require("path");

export let PowerShellLanguageId = "powershell";

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
        // On UNIX platforms the pipe will live under the temp path
        // For details on how this path is computed, see the corefx
        // source for System.IO.Pipes.PipeStream:
        // tslint:disable-next-line:max-line-length
        // https://github.com/dotnet/corefx/blob/d0dc5fc099946adc1035b34a8b1f6042eddb0c75/src/System.IO.Pipes/src/System/IO/Pipes/PipeStream.Unix.cs#L340
        return path.resolve(
            os.tmpdir(),
            ".dotnet", "corefx", "pipe",
            pipeName);
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

    // Try once per second for 60 seconds, one full minute
    innerTryFunc(60, 1000);
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

export function isWindowsOS(): boolean {
    return os.platform() === "win32";
}
