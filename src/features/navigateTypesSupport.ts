/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

'use strict';

import vscode = require('vscode');
import Proto = require('../protocol');
import PowershellService = require('../powershellService');

class NavigateTypeSupport implements vscode.WorkspaceSymbolProvider {
	
	private client: PowershellService.IPowershellServiceClient;
	private modeId: string
	
	public constructor(client: PowershellService.IPowershellServiceClient, modeId: string) {
		this.client = client;
		this.modeId = modeId;
	}
	
	public provideWorkspaceSymbols(search:string, token:vscode.CancellationToken): Promise<vscode.SymbolInformation[]> {

		// Get all PowerShell files in the workspace
		let uri: vscode.Uri;
		let documents = vscode.workspace.textDocuments;
		for (let document of documents) {
			if (document.languageId === this.modeId) {
				uri = document.uri;
				break;
			}
		}

		if (!uri) {
			return Promise.resolve<vscode.SymbolInformation[]>([]);
		}

		var args:Proto.NavtoRequestArgs = {
			file: this.client.asAbsolutePath(uri),
			searchValue: search
		};
		if (!args.file) {
			return Promise.resolve<vscode.SymbolInformation[]>([]);
		}
		return this.client.execute('navto', args, token).then((response):vscode.SymbolInformation[] => {
			var data = response.body;
			if (data) {
				return data.map((item) => {
					let range = new vscode.Range(item.start.line - 1, item.start.offset - 1, item.end.line - 1, item.end.offset - 1);
					let label = item.name;
					if (item.kind === 'method' || item.kind === 'function') {
						label += '()';
					}
					return new vscode.SymbolInformation(label, _kindMapping[item.kind], range,
						this.client.asUrl(item.file), item.containerName);
				});
			} else {
				return [];
			}

		}, (err) => {
			return [];
		});
	}
}

var _kindMapping: { [kind: string]: vscode.SymbolKind } = Object.create(null);
_kindMapping['method'] = vscode.SymbolKind.Method;
_kindMapping['enum'] = vscode.SymbolKind.Enum;
_kindMapping['function'] = vscode.SymbolKind.Function;
_kindMapping['class'] = vscode.SymbolKind.Class;
_kindMapping['interface'] = vscode.SymbolKind.Interface;
_kindMapping['var'] = vscode.SymbolKind.Variable;

export = NavigateTypeSupport;