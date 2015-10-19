/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

'use strict';

import vscode = require('vscode');
import Proto = require('../protocol');
import PowershellService = require('../powershellService');
import Previewer = require('./previewer');

class ParameterHintsSupport implements vscode.Modes.IParameterHintsSupport {

	public triggerCharacters:string[] = ['(', ',','"','-'];
	public excludeTokens:string[] = ['string'];

	private client: PowershellService.IPowershellServiceClient;
	
	public constructor(client: PowershellService.IPowershellServiceClient) {
		this.client = client;
	}
	
	public getParameterHints(document:vscode.TextDocument, position:vscode.Position, token: vscode.CancellationToken): Promise<vscode.Modes.IParameterHints> {
		var args:Proto.SignatureHelpRequestArgs = {
			file: this.client.asAbsolutePath(document.getUri()),
			//line: position.line + 1,
			//offset: position.character + 1
			line: position.line,
			offset: position.character						
		};
		if (!args.file) {
			return Promise.resolve<vscode.Modes.IParameterHints>(null);
		}
		return this.client.execute('signatureHelp', args).then((response) => {
			var info = response.body;
			if (!info) {
				return null;
			}
			var result = <vscode.Modes.IParameterHints> {
				currentSignature: 0,
				currentParameter: 0,
				signatures: []
			};
			info.items.forEach(item => {
				var signature = <vscode.Modes.ISignature> {
					label: info.commandName += ' ',
					documentation: null,
					parameters: []
				};
		
				var paramlabel = item.signatureText;
				var parameter = <vscode.Modes.IParameter> {
					label: paramlabel,
					documentation: null,
					signatureLabelOffset: signature.label.length,
					signatureLabelEnd: signature.label.length + paramlabel.length
				};
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