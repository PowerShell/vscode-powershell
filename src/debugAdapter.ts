/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { connect, Socket } from "net";
import { DebugAdapter, Event, DebugProtocolMessage, EventEmitter } from "vscode";
import { Logger } from "./logging";

export class NamedPipeDebugAdapter implements DebugAdapter {
    private static readonly TWO_CRLF = '\r\n\r\n';
    private static readonly HEADER_LINESEPARATOR = /\r?\n/;	// allow for non-RFC 2822 conforming line separators
    private static readonly HEADER_FIELDSEPARATOR = /: */;

    private readonly _logger: Logger;
    private readonly _namedPipe: string;

    private _rawData = Buffer.allocUnsafe(0);
    private _contentLength = -1;
    private _isConnected: boolean = false;
    private _debugMessageQueue: DebugProtocolMessage[] = [];

    private _debugServiceSocket: Socket;

    // The event that VS Code-proper will listen for.
    private _sendMessage: EventEmitter<DebugProtocolMessage> = new EventEmitter<DebugProtocolMessage>();
    onDidSendMessage: Event<DebugProtocolMessage> = this._sendMessage.event;

    constructor(namedPipe: string, logger: Logger) {
        this._namedPipe = namedPipe;
        this._logger = logger;
    }

    public start(): void {
        this._debugServiceSocket = connect(this._namedPipe);

        this._debugServiceSocket.on("error", (e) => {
            this._logger.writeError("Error on Debug Adapter: " + e);
            this.dispose();
        });

        // Route any output from the socket through to VS Code.
        this._debugServiceSocket.on("data", (data: Buffer) => this.handleData(data));

        // Wait for the connection to complete.
        this._debugServiceSocket.on("connect", () => {
            while(this._debugMessageQueue.length) {
                this.writeMessageToDebugAdapter(this._debugMessageQueue.shift());
            }

            this._isConnected = true;
            this._logger.writeVerbose("Connected to socket!");
        });

        // When the socket closes, end the session.
        this._debugServiceSocket.on("close", () => { this.dispose(); });
        this._debugServiceSocket.on("end", () => { this.dispose(); });
    }

    public handleMessage(message: DebugProtocolMessage): void {
        if (!this._isConnected) {
            this._debugMessageQueue.push(message);
            return;
        }

        this.writeMessageToDebugAdapter(message);
    }

    public dispose() {
        this._debugServiceSocket.destroy();
        this._sendMessage.fire({ type: 'event', event: 'terminated' });
        this._sendMessage.dispose();
    }

    private writeMessageToDebugAdapter(message: DebugProtocolMessage): void {
        const msg = JSON.stringify(message);
        const messageWrapped = `Content-Length: ${Buffer.byteLength(msg, "utf8")}${NamedPipeDebugAdapter.TWO_CRLF}${msg}`;
        this._logger.writeDiagnostic(`SENDING TO DEBUG ADAPTER: ${messageWrapped}`);
        this._debugServiceSocket.write(messageWrapped, "utf8");
    }

    // Shamelessly stolen from VS Code's implementation with slight modification by using public types and our logger:
    // https://github.com/microsoft/vscode/blob/ff1b513fbca1acad4467dfd768997e9e0b9c5735/src/vs/workbench/contrib/debug/node/debugAdapter.ts#L55-L92
    private handleData(data: Buffer): void {
        this._rawData = Buffer.concat([this._rawData, data]);

        while (true) {
            if (this._contentLength >= 0) {
                if (this._rawData.length >= this._contentLength) {
                    const message = this._rawData.toString('utf8', 0, this._contentLength);
                    this._rawData = this._rawData.slice(this._contentLength);
                    this._contentLength = -1;
                    if (message.length > 0) {
                        try {
                            this._logger.writeDiagnostic(`RECEIVED FROM DEBUG ADAPTER: ${message}`);
                            this._sendMessage.fire(JSON.parse(message) as DebugProtocolMessage);
                        } catch (e) {
                             this._logger.writeError("Error firing event in VS Code: ", (e.message || e), message);
                        }
                    }
                    continue; // there may be more complete messages to process
                }
            } else {
                const idx = this._rawData.indexOf(NamedPipeDebugAdapter.TWO_CRLF);
                if (idx !== -1) {
                    const header = this._rawData.toString('utf8', 0, idx);
                    const lines = header.split(NamedPipeDebugAdapter.HEADER_LINESEPARATOR);
                    for (const h of lines) {
                        const kvPair = h.split(NamedPipeDebugAdapter.HEADER_FIELDSEPARATOR);
                        if (kvPair[0] === 'Content-Length') {
                            this._contentLength = Number(kvPair[1]);
                        }
                    }
                    this._rawData = this._rawData.slice(idx + NamedPipeDebugAdapter.TWO_CRLF.length);
                    continue;
                }
            }
            break;
        }
    }
}
