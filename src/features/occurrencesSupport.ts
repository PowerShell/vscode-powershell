/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

'use strict';

import vscode = require('vscode');
import Proto = require('../protocol');
import PowershellService = require('../powershellService');

class OccurrencesSupport implements vscode.Modes.IOccurrencesSupport {
	
	private client: PowershellService.IPowershellServiceClient;
	
	public constructor(client: PowershellService.IPowershellServiceClient) {
		this.client = client;
	}

	public findOccurrences(resource:vscode.TextDocument, position:vscode.Position, token: vscode.CancellationToken): Promise<vscode.Modes.IOccurrence[]> {
		var args:Proto.FileLocationRequestArgs = {
			file: this.client.asAbsolutePath(resource.getUri()),
			//line: position.line + 1,
			//offset: position.character + 1
			line: position.line,
			offset: position.character			
		};
		if (!args.file) {
			return Promise.resolve<vscode.Modes.IOccurrence[]>([]);
		}
		return this.client.execute('occurrences', args, token).then((response):vscode.Modes.IOccurrence[] => {
			var data = response.body;
			if (data) {
				return data.map((item) => {
					return {
						kind: item.isWriteAccess ? 'write' : null,
						range: new vscode.Range(item.start.line, item.start.offset, item.end.line, item.end.offset)
					};
				});
			}
		}, (err) => {
			return [];
		});
	}
}

export = OccurrencesSupport;