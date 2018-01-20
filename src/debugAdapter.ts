/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import fs = require("fs");
import net = require("net");
import path = require("path");
import { Logger } from "./logging";
import utils = require("./utils");

// NOTE: The purpose of this file is to serve as a bridge between
// VS Code's debug adapter client (which communicates via stdio) and
// PowerShell Editor Services' debug service (which communicates via
// named pipes or a network protocol).  It is purely a naive data
// relay between the two transports.

const logBasePath = path.resolve(__dirname, "../../logs");

const debugAdapterLogWriter =
    fs.createWriteStream(
        path.resolve(
            logBasePath,
            "DebugAdapter.log"));

// Pause the stdin buffer until we're connected to the
// debug server
process.stdin.pause();

const debugSessionFilePath = utils.getDebugSessionFilePath();
debugAdapterLogWriter.write("Session file path: " + debugSessionFilePath + ", pid: " + process.pid + " \r\n");

function startDebugging() {
    // Read the details of the current session to learn
    // the connection details for the debug service
    const sessionDetails = utils.readSessionFile(debugSessionFilePath);

    // Delete the session file after it has been read so that
    // it isn't used mistakenly by another debug session
    utils.deleteSessionFile(debugSessionFilePath);

    // Establish connection before setting up the session
    debugAdapterLogWriter.write("Connecting to port: " + sessionDetails.debugServicePort + "\r\n");

    let isConnected = false;
    const debugServiceSocket = net.connect(sessionDetails.debugServicePort, "127.0.0.1");

    // Write any errors to the log file
    debugServiceSocket.on(
        "error",
        (e) => {
            debugAdapterLogWriter.write("Socket ERROR: " + e + "\r\n");
            debugAdapterLogWriter.close();
            debugServiceSocket.destroy();
            process.exit(0);
        });

    // Route any output from the socket through stdout
    debugServiceSocket.on(
        "data",
        (data: Buffer) => process.stdout.write(data));

    // Wait for the connection to complete
    debugServiceSocket.on(
        "connect",
        () => {
            isConnected = true;
            debugAdapterLogWriter.write("Connected to socket!\r\n\r\n");

            // When data comes on stdin, route it through the socket
            process.stdin.on(
                "data",
                (data: Buffer) => debugServiceSocket.write(data));

            // Resume the stdin stream
            process.stdin.resume();
        });

    // When the socket closes, end the session
    debugServiceSocket.on(
        "close",
        () => {
            debugAdapterLogWriter.write("Socket closed, shutting down.");
            debugAdapterLogWriter.close();
            isConnected = false;

            // Close after a short delay to give the client time
            // to finish up
            setTimeout(() => {
                process.exit(0);
            }, 2000);
        },
    );

    process.on(
        "exit",
        (e) => {
            if (debugAdapterLogWriter) {
                debugAdapterLogWriter.write("Debug adapter process is exiting...");
            }
        },
    );
}

function waitForSessionFile(triesRemaining: number) {

    debugAdapterLogWriter.write(`Waiting for session file, tries remaining: ${triesRemaining}...\r\n`);

    if (triesRemaining > 0) {
        if (utils.checkIfFileExists(debugSessionFilePath)) {
            debugAdapterLogWriter.write(`Session file present, connecting to debug adapter...\r\n\r\n`);
            startDebugging();
        } else {
            // Wait for a second and try again
            setTimeout(
                () => waitForSessionFile(triesRemaining - 1),
                1000);
        }
    } else {
        debugAdapterLogWriter.write(`Timed out waiting for session file!\r\n`);
        const errorJson =
            JSON.stringify({
                type: "response",
                request_seq: 1,
                command: "initialize",
                success: false,
                message: "Timed out waiting for the PowerShell extension to start.",
            });

        process.stdout.write(
            `Content-Length: ${Buffer.byteLength(errorJson, "utf8")}\r\n\r\n${errorJson}`,
            "utf8");
    }
}

// Wait for the session file to appear
waitForSessionFile(30);
