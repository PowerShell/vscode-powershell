/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

'use strict';

import vscode = require('vscode');
import Proto = require('../protocol');
import PowershellService = require('../powershellService');

class ReferenceSupport implements vscode.Modes.IReferenceSupport {

	private client: PowershellService.IPowershellServiceClient;

	public tokens:string[] = [];

	public constructor(client: PowershellService.IPowershellServiceClient) {
		this.client = client;
	}	

	public findReferences(document: vscode.TextDocument, position: vscode.Position, includeDeclaration:boolean, token: vscode.CancellationToken): Promise<vscode.Modes.IReference[]> {
		var args: Proto.FileLocationRequestArgs = {
			file: this.client.asAbsolutePath(document.getUri()),
			//line: position.line + 1,
			//offset: position.character + 1
			line: position.line,
			offset: position.character			
		};
		if (!args.file) {
			return Promise.resolve<vscode.Modes.IReference[]>([]);
		}
		return this.client.execute('references', args, token).then((msg) => {
			var result: vscode.Modes.IReference[] = [];
			var refs = msg.body.refs;
			for (var i = 0; i < refs.length; i++) {
				var ref = refs[i];
				var url = this.client.asUrl(ref.file);
				result.push({
					resource: url,
					range: new vscode.Range(ref.start.line, ref.start.offset, ref.end.line, ref.end.offset)
				});
			}
			return result;
		}, () => {
			return [];
		});
	}
}

export = ReferenceSupport;