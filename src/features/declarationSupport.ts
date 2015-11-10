/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

'use strict';

import vscode = require('vscode');
import Proto = require('../protocol');
import PowershellService = require('../powershellService');

class DeclarationSupport implements vscode.DefinitionProvider {

	private client: PowershellService.IPowershellServiceClient;

	public tokens:string[] = [];

	constructor(client: PowershellService.IPowershellServiceClient) {
		this.client = client;
	}
	
	public provideDefinition(document: vscode.TextDocument, position:vscode.Position, token: vscode.CancellationToken): Promise<vscode.Location> {
		var args:Proto.FileLocationRequestArgs = {
			file: this.client.asAbsolutePath(document.uri),
			line: position.line + 1,
			offset: position.character + 1						
		};
		if (!args.file) {
			return Promise.resolve<vscode.Location>(null);
		}
		return this.client.execute('definition', args).then((response) => {
			var locations:Proto.FileSpan[] = response.body;
			if (!locations || locations.length === 0) {
				vscode.window.showWarningMessage("The selected symbol's definition could not be found.");					
				return null;
			}

			return locations.map(location => {
				var resource = this.client.asUrl(location.file);
				if (resource === null) {
					return null;
				} else {
					// TODO: Strangely, this doesn't work if I return the Location directly,
					// only works if I assign to a variable first.  Not sure what is going on yet.
					var loc = 
						new vscode.Location(
							resource, 
							new vscode.Range(
								location.start.line - 1,
								location.start.offset - 1,
								location.end.line - 1,
								location.end.offset - 1
							));
					return loc;
				}
			});	
		}, () => {
			return null;
		});
	}
}

export = DeclarationSupport;