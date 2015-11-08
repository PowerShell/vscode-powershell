/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

'use strict';

import vscode = require('vscode');
import Proto = require('../protocol');
import PowershellService = require('../powershellService');

class ReferenceSupport implements vscode.ReferenceProvider {

	private client: PowershellService.IPowershellServiceClient;

	public tokens:string[] = [];

	public constructor(client: PowershellService.IPowershellServiceClient) {
		this.client = client;
	}	

	public provideReferences(document: vscode.TextDocument, position: vscode.Position, options: { includeDeclaration: boolean }, token: vscode.CancellationToken): Promise<vscode.Location[]> {	
		var args: Proto.FileLocationRequestArgs = {
			file: this.client.asAbsolutePath(document.uri),
			line: position.line + 1,
			offset: position.character + 1
		};
		if (!args.file) {
			return Promise.resolve<vscode.Location[]>([]);
		}
		return this.client.execute('references', args, token).then((msg) => {
			var result: vscode.Location[] = [];
			var refs = msg.body.refs;
			for (var i = 0; i < refs.length; i++) {
				var ref = refs[i];
				var url = this.client.asUrl(ref.file);
				result.push(
					new vscode.Location(
						url,
						new vscode.Range(ref.start.line - 1, ref.start.offset - 1, ref.end.line - 1, ref.end.offset - 1)));
			}
			return result;
		}, () => {
			return [];
		});
	}
}

export = ReferenceSupport;