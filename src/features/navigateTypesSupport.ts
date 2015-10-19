/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

'use strict';

import vscode = require('vscode');
import Proto = require('../protocol');
import PowershellService = require('../powershellService');

class NavigateTypeSupport implements vscode.Modes.INavigateTypesSupport {
	
	private client: PowershellService.IPowershellServiceClient;
	private modeId: string
	
	public constructor(client: PowershellService.IPowershellServiceClient, modeId: string) {
		this.client = client;
		this.modeId = modeId;
	}
	
	public getNavigateToItems(search:string, token:vscode.CancellationToken): Promise<vscode.Modes.ITypeBearing[]> {

		// Get all PowerShell files in the workspace
		let uri: vscode.Uri;
		let documents = vscode.workspace.getTextDocuments();
		for (let document of documents) {
			if (document.getLanguageId() === this.modeId) {
				uri = document.getUri();
				break;
			}
		}

		if (!uri) {
			return Promise.resolve<vscode.Modes.ITypeBearing[]>([]);
		}

		var args:Proto.NavtoRequestArgs = {
			file: this.client.asAbsolutePath(uri),
			searchValue: search
		};
		if (!args.file) {
			return Promise.resolve<vscode.Modes.ITypeBearing[]>([]);
		}
		return this.client.execute('navto', args, token).then((response):vscode.Modes.ITypeBearing[] => {
			var data = response.body;
			if (data) {
				return data.map((item) => {
					return {
						containerName: item.containerName,
						name: item.name,
						parameters: (item.kind === 'method' || item.kind === 'function') ? '()' : '',
						type: item.kind,
						range: new vscode.Range(item.start.line, item.start.offset, item.end.line, item.end.offset),
						resourceUri: this.client.asUrl(item.file)
					};
				});
			} else {
				return [];
			}

		}, (err) => {
			return [];
		});
	}
}

export = NavigateTypeSupport;