/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

'use strict';

import vscode = require('vscode');
import Proto = require('../protocol');
import PowershellService = require('../powershellService');
//import async = require('../lib/delayer');

interface IDiagnosticRequestor {
	requestDiagnostic(filepath:string): void;
}

class SyncedBuffer {

	private document: vscode.TextDocument;
	private filepath: string;
	private diagnosticRequestor: IDiagnosticRequestor;
	private client: PowershellService.IPowershellServiceClient;

	constructor(document: vscode.TextDocument, filepath: string, diagnosticRequestor: IDiagnosticRequestor, client: PowershellService.IPowershellServiceClient) {
		this.document = document;
		this.filepath = filepath;
		this.diagnosticRequestor = diagnosticRequestor;
		this.client = client;
	}

	public open(): void {
		var args:Proto.OpenRequestArgs = {
			file: this.filepath
		};
		this.client.execute('open', args, false);
	}

	public close(): void {
		var args:Proto.FileRequestArgs = {
			file: this.filepath
		};
		this.client.execute('close', args, false);
	}

	onContentChanged(events: vscode.TextDocumentContentChangeEvent[]): void {
		var filePath = this.client.asAbsolutePath(this.document.uri);
		if (!filePath) {
			return;
		}

		for (var i = 0; i < events.length; i++) {
			var event = events[i];
			var range = event.range;
			var text = event.text;
			var args:Proto.ChangeRequestArgs = {
				file: filePath,
				line: range.start.line + 1,
				offset: range.start.character + 1,
				endLine: range.end.line + 1,
				endOffset: range.end.character + 1,
				insertString: text
			};
			this.client.execute('change', args, false);
		}
		this.diagnosticRequestor.requestDiagnostic(filePath);
	}
}

class BufferSyncSupport {

	private client: PowershellService.IPowershellServiceClient;

	private modeId: string;
	private disposables: vscode.Disposable[] = [];
	private syncedBuffers: {[key:string]: SyncedBuffer};

	private pendingDiagnostics: { [key:string]:number; };
	private diagnosticTimer: NodeJS.Timer = undefined;

	constructor(client: PowershellService.IPowershellServiceClient, modeId: string) {
		this.client = client;
		this.modeId = modeId;

		this.pendingDiagnostics = Object.create(null);

		this.syncedBuffers = Object.create(null);
		vscode.workspace.onDidOpenTextDocument(this.onDidAddDocument, this, this.disposables);
		vscode.workspace.onDidCloseTextDocument(this.onDidRemoveDocument, this, this.disposables);
		vscode.workspace.onDidChangeTextDocument(this.onDidChangeDocument, this, this.disposables);
		vscode.workspace.textDocuments.forEach(this.onDidAddDocument, this);
	}

	public dispose(): void {
		while (this.disposables.length) {
			this.disposables.pop().dispose();
		}
	}

	private onDidAddDocument(document: vscode.TextDocument): void {
	
		if (document.languageId !== this.modeId) {
			return;
		}
		if (document.isUntitled) {
			return;
		}
		var resource = document.uri;
		var filepath = this.client.asAbsolutePath(resource);
		if (!filepath) {
			return;
		}
		var syncedBuffer = new SyncedBuffer(document, filepath, this, this.client);
		this.syncedBuffers[filepath] = syncedBuffer;
		syncedBuffer.open();
		this.requestDiagnostic(filepath);
		
		this.client.log("Added new document: " + document.uri);		
	}

	private onDidRemoveDocument(document: vscode.TextDocument): void {
		var filepath:string = this.client.asAbsolutePath(document.uri);
		if (!filepath) {
			return;
		}
		var syncedBuffer = this.syncedBuffers[filepath];
		if (!syncedBuffer) {
			return;
		}
		delete this.syncedBuffers[filepath];
		syncedBuffer.close();
	}

	private onDidChangeDocument(e: vscode.TextDocumentChangeEvent): void {
		var filepath:string = this.client.asAbsolutePath(e.document.uri);
		if (!filepath) {
			return;
		}
		var syncedBuffer = this.syncedBuffers[filepath];
		if (!syncedBuffer) {
			return;
		}
		syncedBuffer.onContentChanged(e.contentChanges);
	}


	public requestAllDiagnostics() {
		Object.keys(this.syncedBuffers).forEach(filePath => this.pendingDiagnostics[filePath] = Date.now());
		this.delaySendPendingDiagnostics();
	}

	public requestDiagnostic(file: string):void {
		this.pendingDiagnostics[file] = Date.now();
		this.delaySendPendingDiagnostics();
	}
	
	public delaySendPendingDiagnostics(): void {
		if (this.diagnosticTimer !== undefined) {
			clearTimeout(this.diagnosticTimer);
		}
		
		this.diagnosticTimer = setTimeout(() => { this.sendPendingDiagnostics() }, 100);
	}

	private sendPendingDiagnostics():void {
		var files =  Object.keys(this.pendingDiagnostics).map((key) => {
			return {
				file: key,
				time: this.pendingDiagnostics[key]
			};
		}).sort((a, b) => {
			return a.time - b.time;
		}).map((value) => {
			return value.file;
		});

		// Add all open TS buffers to the geterr request. They might be visible
		Object.keys(this.syncedBuffers).forEach((file) => {
			if (!this.pendingDiagnostics[file]) {
				files.push(file);
			}
		});

		var args: Proto.GeterrRequestArgs = {
			delay: 750,
			files: files
		};
		this.client.execute('geterr', args, false);
		this.pendingDiagnostics = Object.create(null);
	}
}

export = BufferSyncSupport;