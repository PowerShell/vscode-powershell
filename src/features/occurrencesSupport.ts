/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

'use strict';

import vscode = require('vscode');
import Proto = require('../protocol');
import PowershellService = require('../powershellService');

class OccurrencesSupport implements vscode.DocumentHighlightProvider {
	
	private client: PowershellService.IPowershellServiceClient;
	
	public constructor(client: PowershellService.IPowershellServiceClient) {
		this.client = client;
	}

	public provideDocumentHighlights(resource:vscode.TextDocument, position:vscode.Position, token: vscode.CancellationToken): Promise<vscode.DocumentHighlight[]> {
		var args:Proto.FileLocationRequestArgs = {
			file: this.client.asAbsolutePath(resource.uri),
			line: position.line + 1,
			offset: position.character + 1
		};
		if (!args.file) {
			return Promise.resolve<vscode.DocumentHighlight[]>([]);
		}
		return this.client.execute('occurrences', args, token).then((response):vscode.DocumentHighlight[] => {
			var data = response.body;
			if (data) {
				return data.map((item) => {
					return new vscode.DocumentHighlight(
						new vscode.Range(item.start.line - 1, item.start.offset - 1, item.end.line - 1, item.end.offset - 1),
						item.isWriteAccess ? vscode.DocumentHighlightKind.Write : vscode.DocumentHighlightKind.Read);
				});
			}
		}, (err) => {
			return [];
		});
	}
}

export = OccurrencesSupport;