import fs = require('fs');
import path = require('path');
import net = require('net');
import logging = require('./logging');

// NOTE: The purpose of this file is to serve as a bridge between
// VS Code's debug adapter client (which communicates via stdio) and
// PowerShell Editor Services' debug service (which communicates via
// named pipes or a network protocol).  It is purely a naive data
// relay between the two transports.

var logBasePath = path.resolve(__dirname, "../logs");
logging.ensurePathExists(logBasePath);

var debugAdapterLogWriter =
    fs.createWriteStream(
        path.resolve(
            logBasePath,
            logging.getLogName("DebugAdapterClient")));

// Pause the stdin buffer until we're connected to the
// debug server
process.stdin.pause();

// Establish connection before setting up the session
let pipeName = "\\\\.\\pipe\\PSES-VSCode-DebugService-" + process.env.VSCODE_PID;
debugAdapterLogWriter.write("Connecting to named pipe: " + pipeName + "\r\n");
let debugServiceSocket = net.connect(pipeName);

// Write any errors to the log file
debugServiceSocket.on(
    'error',
    (e) => debugAdapterLogWriter.write("Named pipe ERROR: " + e + "\r\n"));

// Route any output from the socket through stdout
debugServiceSocket.on(
    'data',
    (data: Buffer) => process.stdout.write(data));

// Wait for the connection to complete
debugServiceSocket.on(
    'connect',
    () => {
        debugAdapterLogWriter.write("Connected to named pipe: " + pipeName + "\r\n");

        // When data comes on stdin, route it through the socket
        process.stdin.on(
            'data',
            (data: Buffer) => debugServiceSocket.write(data));

        // Resume the stdin stream
        process.stdin.resume();
    });
