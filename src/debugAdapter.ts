/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import fs = require('fs');
import path = require('path');
import net = require('net');
import utils = require('./utils');
import { Logger } from './logging';

// NOTE: The purpose of this file is to serve as a bridge between
// VS Code's debug adapter client (which communicates via stdio) and
// PowerShell Editor Services' debug service (which communicates via
// named pipes or a network protocol).  It is purely a naive data
// relay between the two transports.

var logBasePath = path.resolve(__dirname, "../logs");

var debugAdapterLogWriter =
    fs.createWriteStream(
        path.resolve(
            logBasePath,
            "DebugAdapter.log"));

// Pause the stdin buffer until we're connected to the
// debug server
process.stdin.pause();

// Read the details of the current session to learn
// the connection details for the debug service
let sessionDetails = utils.readSessionFile();

// Establish connection before setting up the session
debugAdapterLogWriter.write("Connecting to port: " + sessionDetails.debugServicePort + "\r\n");
let debugServiceSocket = net.connect(sessionDetails.debugServicePort);

// Write any errors to the log file
debugServiceSocket.on(
    'error',
    (e) => debugAdapterLogWriter.write("Socket connect ERROR: " + e + "\r\n"));

// Route any output from the socket through stdout
debugServiceSocket.on(
    'data',
    (data: Buffer) => process.stdout.write(data));

// Wait for the connection to complete
debugServiceSocket.on(
    'connect',
    () => {
        debugAdapterLogWriter.write("Connected to socket!\r\n\r\n");

        // When data comes on stdin, route it through the socket
        process.stdin.on(
            'data',
            (data: Buffer) => debugServiceSocket.write(data));

        // Resume the stdin stream
        process.stdin.resume();
    });

// When the socket closes, end the session
debugServiceSocket.on(
    'close',
    () => {
        debugAdapterLogWriter.write("Socket closed, shutting down.");

        // Close after a short delay to give the client time
        // to finish up
        setTimeout(() => {
            process.exit(0);
        }, 1000);
    }
)