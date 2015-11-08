/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

'use strict';

import vscode = require('vscode');
import Proto = require('../protocol');
import PowershellService = require('../powershellService');
import Previewer = require('./previewer');

class ParameterHintsSupport implements vscode.SignatureHelpProvider {

	public triggerCharacters:string[] = ['(', ',','"','-'];
	public excludeTokens:string[] = ['string'];

	private client: PowershellService.IPowershellServiceClient;
	
	public constructor(client: PowershellService.IPowershellServiceClient) {
		this.client = client;
	}
	
	public provideSignatureHelp(document:vscode.TextDocument, position:vscode.Position, token: vscode.CancellationToken):Promise<vscode.SignatureHelp> {
		var args:Proto.SignatureHelpRequestArgs = {
			file: this.client.asAbsolutePath(document.uri),
			line: position.line + 1,
			offset: position.character + 1						
		};
		if (!args.file) {
			return Promise.resolve<vscode.SignatureHelp>(null);
		}
		return this.client.execute('signatureHelp', args).then((response) => {
			var info = response.body;
			if (!info) {
				return null;
			}
			
			var result = new vscode.SignatureHelp();
			result.activeSignature = info.selectedItemIndex;
			result.activeParameter = info.argumentIndex;
			
			info.items.forEach(item => {
				var signature = new vscode.SignatureInformation('');
				signature.label += info.commandName + ' ';
		
				var paramlabel = item.signatureText;
				var parameter = new vscode.ParameterInformation(item.signatureText, '');
				
				signature.label += paramlabel;
				signature.parameters.push(parameter);

				result.signatures.push(signature);
			});
			
			return result;
		}, (err: any) => {
			return null;
		});
	}
}

export = ParameterHintsSupport;