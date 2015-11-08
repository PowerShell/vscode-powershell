/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

'use strict';

import WireProtocol = require('./lib/wireProtocol');

import vscode = require('vscode');
import Proto = require('./protocol');
import PowershellService = require('./powershellService');
import configuration = require('./features/configuration');

import cp = require('child_process');
import path = require('path');

var isWin = /^win/.test(process.platform);
//var isDarwin = /^darwin/.test(process.platform);
//var isLinux = /^linux/.test(process.platform);
//var arch = process.arch;

interface CallbackItem {
	c: (value: any) => void;
	e: (err: any) => void;
	start: number;
}

interface CallbackMap {
	[key:number]: CallbackItem;
}

interface RequestItem {
	request: Proto.Request;
	promise: Promise<any>;
	callbacks: CallbackItem;
}

class PowershellServiceClient implements PowershellService.IPowershellServiceClient {

	public static Trace: boolean = false;

	private host: PowershellService.IPowershellServiceClientHost;
	private pathSeparator: string;

	private lastError: Error;
	private servicePromise: Promise<cp.ChildProcess>;
	private reader: WireProtocol.Reader<Proto.Response>;
	private sequenceNumber: number;

	private requestQueue: RequestItem[];
	private pendingResponses: number;
	private callbacks: CallbackMap;

	constructor(host:PowershellService.IPowershellServiceClientHost) {
		this.host = host;
		this.pathSeparator = path.sep;

		this.servicePromise = null;
		this.lastError = null;
		this.sequenceNumber = 0;
		this.requestQueue = [];
		this.pendingResponses = 0;
		this.callbacks = Object.create(null);
		this.startService();		
	}

	public get trace(): boolean {
		return PowershellServiceClient.Trace;
	}
	
	public log(message: string): void {
		if (PowershellServiceClient.Trace) {
			console.log("POWERSHELL> " + message);
		}
	}

	private service():Promise<cp.ChildProcess> {
		if (this.servicePromise) {
			return this.servicePromise;
		}
		if (this.lastError) {
			return Promise.reject<cp.ChildProcess>(this.lastError);
		}
		this.startService();
		return this.servicePromise;
	}

	private startService(): void {
						
		this.servicePromise = new Promise<cp.ChildProcess>((resolve, reject) => {
			var config = configuration.load('PowerShell');
			var editorServicesHostPath = config.editorServicesHostPath;
			
			PowershellServiceClient.Trace = config.enableLogging;
			console.log("POWERSHELL> Logging enabled: " + PowershellServiceClient.Trace);
			
			if (config.editorServicesHostPath)
			{	
				this.log("Found Editor Services path from config: " + editorServicesHostPath);
						
				// Make the path absolute if it's not
				editorServicesHostPath =
					path.resolve(
						__dirname,
						config.editorServicesHostPath);
						
				this.log("    Resolved path to: " + editorServicesHostPath);
			}
			else
			{
				// Use the default path in the plugin's 'bin' folder
				editorServicesHostPath =
					path.join(
						__dirname,
						'..',
						'bin',
						'Microsoft.PowerShell.EditorServices.Host.exe');
						
				this.log("Using default Editor Services path: " + editorServicesHostPath);
			}

			var childProcess:cp.ChildProcess = null;
			try {
				var args: string[];
				
				if (config.waitForDebugger)
				{
					args = ['/waitForDebugger'];
					this.log("Language service will wait for debugger after launching.");
				}
				
				if (isWin) {
					childProcess = cp.spawn(editorServicesHostPath, args);

				} /*else if (isDarwin) {
					childProcess = cp.spawn(path.join(vscode.Paths.getAppRoot(), 'tools/bin/osx/node'), args);
				} else if (isLinux && arch === 'x64') {
					childProcess = cp.spawn(path.join(vscode.Paths.getAppRoot(), 'tools/bin/linux/x64/node'), args);
				}*/

				childProcess.on('error', (err:Error) => {
					this.lastError = err;
					this.serviceExited();
				});
				childProcess.on('exit', (err:Error) => {
					this.serviceExited();
				});
				this.reader = new WireProtocol.Reader<Proto.Response>(childProcess.stdout, (msg) => {
					this.dispatchMessage(msg);
				});
				
				this.log("Finished spawning language service.");
				
				resolve(childProcess);
			} catch (error) {
				this.log("Failed to launch the language service! -> " + error);
				reject(error);
			}
		});
	}

	private serviceExited(): void {
		this.log("Language service exited.");
		this.servicePromise = null;
		Object.keys(this.callbacks).forEach((key) => {
			this.callbacks[parseInt(key)].e(new Error('Service died.'));
		});
	}

	public asAbsolutePath(resource: vscode.Uri): string {
		if (resource.scheme !== 'file') {
			return null;
		}
		var result = resource.fsPath;
		//var absolutePath = vscode.Paths.toAbsoluteFilePath(resource);
		// Both \ and / must be escaped in regular expressions
		return result ? result.replace(new RegExp('\\' + this.pathSeparator, 'g'), '/') : null;
	}

	public asUrl(filepath: string): vscode.Uri {
		return vscode.Uri.file(filepath);
	}

	public execute(command: string, args: any, expectsResultOrToken?: boolean|vscode.CancellationToken, token?: vscode.CancellationToken): Promise<any> {

        var expectsResult = true;
        if (typeof expectsResultOrToken === 'boolean') {
            expectsResult = expectsResultOrToken;
        } else {
            token = expectsResultOrToken;
        }

		var request:Proto.Request = {
			seq: this.sequenceNumber++,
			type: 'request',
			command: command,
			arguments: args
		};
		var requestInfo: RequestItem = {
			request: request,
			promise: null,
			callbacks: null
		};
		var result: Promise<any> = null;
        if (expectsResult) {
            result = new Promise<any>((resolve, reject) => {

                requestInfo.callbacks = { c: resolve, e: reject, start: Date.now() };

                if (token) {
                    token.onCancellationRequested(() => {
                        this.tryCancelRequest(request.seq);
                        let err = new Error('Canceled');
                        err.message = 'Canceled';
                        reject(err);
                    });
                }
            });
		}
		requestInfo.promise = result;
		this.requestQueue.push(requestInfo);
		this.sendNextRequests();

		return result;
	}

	private sendNextRequests(): void {
		while(this.pendingResponses === 0 && this.requestQueue.length > 0) {
			this.sendRequest(this.requestQueue.shift());
		}
	}

	private sendRequest(requestItem: RequestItem): void {
		var serverRequest = requestItem.request;
		this.log('Sending request ' + serverRequest.command + '(' + serverRequest.seq + '). Response expected: ' + (requestItem.callbacks ? 'yes' : 'no')+ '. Current queue length: ' + this.requestQueue.length);
		this.log("    Args: " + JSON.stringify(requestItem.request.arguments));

		if (requestItem.callbacks) {
			this.callbacks[serverRequest.seq] = requestItem.callbacks;
			this.pendingResponses++;
		}
		this.service().then((childProcess) => {
			var message = JSON.stringify(serverRequest);
			childProcess.stdin.write(
				'Content-Length: ' + Buffer.byteLength(message, 'utf8') + '\r\n\r\n',
				'ascii');
			childProcess.stdin.write(
				message,
				'utf8');
		}).catch(err => {
			var callback = this.callbacks[serverRequest.seq];
			if (callback) {
				callback.e(err);
				delete this.callbacks[serverRequest.seq];
				this.pendingResponses--;
			}
		});
	}

	private tryCancelRequest(seq: number): boolean {
		for (var i = 0; i < this.requestQueue.length; i++) {
			if (this.requestQueue[i].request.seq === seq) {
				this.requestQueue.splice(i, 1);
				
				this.log('Canceled request with sequence number ' + seq);
				
				return true;
			}
		}

		this.log('Tried to cancel request with sequence number ' + seq + '. But request got already delivered.');

		return false;
	}

	private dispatchMessage(message:Proto.Message):void {
		try {
			this.log("Received message: " + JSON.stringify(message));
			
			if (message.type === 'response') {
				var response:Proto.Response = <Proto.Response>message;
				var p = this.callbacks[response.request_seq];
				if (p) {
					this.log('Request ' + response.command + '(' + response.request_seq + ') took ' + (Date.now() - p.start) + 'ms. Success: ' + response.success);

					delete this.callbacks[response.request_seq];
					this.pendingResponses--;
					if (response.success) {
						p.c(response);
					} else {
						p.e(response);
					}
				}
			} else if (message.type === 'event') {
				var event:Proto.Event = <Proto.Event>message;
				if (event.event === 'syntaxDiag') {
					this.host.syntaxDiagnosticsReceived(event);
				}
				if (event.event === 'semanticDiag') {
					this.host.semanticDiagnosticsReceived(event);
				}
			} else {
				throw new Error('Unknown message type ' + message.type + ' recevied');
			}
		} finally {
			this.sendNextRequests();
		}
	}
}

export = PowershellServiceClient;