/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

'use strict';

import vscode = require('vscode');
import Proto = require('../protocol');
import PowershellService = require('../powershellService');

class DeclarationSupport implements vscode.Modes.IDeclarationSupport {

	private client: PowershellService.IPowershellServiceClient;

	public tokens:string[] = [];

	constructor(client: PowershellService.IPowershellServiceClient) {
		this.client = client;
	}
	
	public findDeclaration(document: vscode.TextDocument, position:vscode.Position, token: vscode.CancellationToken): Promise<vscode.Modes.IReference> {
		var args:Proto.FileLocationRequestArgs = {
			file: this.client.asAbsolutePath(document.getUri()),
			//line: position.line + 1,
			//offset: position.character + 1
			line: position.line,
			offset: position.character						
		};
		if (!args.file) {
			return Promise.resolve<vscode.Modes.IReference>(null);
		}
		return this.client.execute('definition', args).then((response) => {
			var locations:Proto.FileSpan[] = response.body;
			if (!locations || locations.length === 0) {
				return null;
			}
			var location = locations[0];
			var resource = this.client.asUrl(location.file);
			// if (resource === null) {
			// 	return null;
			// }
			// 		
			// return locations.map(location => {
			// 	var resource = this.client.asUrl(location.file);
			// 	if (resource === null) {
			// 		return null;
			// 	} else {
			// 		return {
			// 			resource: resource,
			// 			range: new vscode.Range(location.start.line, location.start.offset, location.end.line, location.end.offset)
			// 		}
			// 	}
			// });
			if (resource === null) {
				return null;
			} else {
				return {
					resource: resource,
					range: new vscode.Range(location.start.line, location.start.offset, location.end.line, location.end.offset)
				};
			}			
		}, () => {
			return null;
		});
	}
}

export = DeclarationSupport;