/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

'use strict';

import vscode = require('vscode');

import Previewer = require('./previewer');
import Proto = require('../protocol');
import PConst = require('../protocol.const');
import PowershellService = require('../powershellService');

class PowerShellCompletionItem extends vscode.CompletionItem {

	document: vscode.TextDocument;
	position: vscode.Position;

	constructor(entry: Proto.CompletionEntry) {
		super(entry.name);
		this.sortText = entry.sortText;
		this.kind = PowerShellCompletionItem.convertKind(entry.kind);
	}

	private static convertKind(kind: string): vscode.CompletionItemKind {
		switch (kind) {
			case PConst.Kind.primitiveType:
			case PConst.Kind.keyword:
				return vscode.CompletionItemKind.Keyword;
			case PConst.Kind.variable:
			case PConst.Kind.localVariable:
				return vscode.CompletionItemKind.Variable;
			case PConst.Kind.memberVariable:
			case PConst.Kind.memberGetAccessor:
			case PConst.Kind.memberSetAccessor:
				return vscode.CompletionItemKind.Field;
			case PConst.Kind.function:
			case PConst.Kind.memberFunction:
			case PConst.Kind.constructSignature:
			case PConst.Kind.callSignature:
			case PConst.Kind.indexSignature:
				return vscode.CompletionItemKind.Function;
			case PConst.Kind.enum:
				return vscode.CompletionItemKind.Enum;
			case PConst.Kind.module:
				return vscode.CompletionItemKind.Module;
			case PConst.Kind.class:
				return vscode.CompletionItemKind.Class;
			case PConst.Kind.interface:
				return vscode.CompletionItemKind.Interface;
		}

		return vscode.CompletionItemKind.Property;
	}
}

class SuggestSupport implements vscode.CompletionItemProvider {

	public triggerCharacters = ['.','$','-'];
	public excludeTokens = ['string', 'comment', 'numeric'];
	public sortBy = [{ type: 'reference', partSeparator: '/' }];

	private client: PowershellService.IPowershellServiceClient;

	constructor(client: PowershellService.IPowershellServiceClient) {
		this.client = client;
	}

	public provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): Promise<vscode.CompletionItem[]> {
		var filepath = this.client.asAbsolutePath(document.uri);
		var args: Proto.CompletionsRequestArgs = {
			file: filepath,
			line: position.line + 1,
			offset: position.character + 1
		};
		if (!args.file) {
			return Promise.resolve<vscode.CompletionItem[]>([]);
		}
		
		// Need to capture the word at position before we send the request.
		// The model can move forward while the request is evaluated.
		var wordRange = document.getWordRangeAtPosition(position);

		return this.client.execute('completions', args).then((msg) => {
			// var isMemberCompletion = false;
			// var requestColumn = position.character;
			// if (wordAtPosition) {
			// 	requestColumn = wordAtPosition.startColumn;
			// }
			// if (requestColumn > 0) {
			// 	var value = model.getValueInRange({
			// 		startLineNumber: position.line,
			// 		startColumn: requestColumn - 1,
			// 		endLineNumber: position.line,
			// 		endColumn: requestColumn
			// 	});
			// 	isMemberCompletion = value === '.';
			// }
			
			var completionItems: vscode.CompletionItem[] = [];
			var body = msg.body;

			for (var i = 0; i < body.length; i++) {
				var element = body[i];
				var item = new PowerShellCompletionItem(element);
				item.document = document;
				item.position = position;
				
				completionItems.push(item);
			}

			return completionItems;		

		}, (err:Proto.CompletionsResponse) => {
			return [];
		});
	}
	
	public resolveCompletionItem(item: vscode.CompletionItem, token: vscode.CancellationToken): any | Thenable<any> {
		if (item instanceof PowerShellCompletionItem) {

			var args: Proto.CompletionDetailsRequestArgs = {
				file: this.client.asAbsolutePath(item.document.uri),
				line: item.position.line + 1,
				offset: item.position.character + 1,
				entryNames: [item.label]
			};
			return this.client.execute('completionEntryDetails', args, token).then((response) => {
				var details = response.body;
				if (details && details.length > 0) {
					var detail = details[0];
					item.documentation = Previewer.plain(detail.documentation);
					item.detail = Previewer.plain(detail.displayParts);
				}

				if (item.kind === vscode.CompletionItemKind.Function) {
					var codeSnippet = detail.name,
						suggestionArgumentNames: string[];

					// suggestionArgumentNames = detail.displayParts
					// 	.filter(part => part.kind === 'parameterName')
					// 	.map(part => `{{${part.text}}}`);

					if (suggestionArgumentNames.length > 0) {
						codeSnippet += '(' + suggestionArgumentNames.join(', ') + '){{}}';
					} else {
						codeSnippet += '()';
					}

					item.insertText = codeSnippet;
				}

				return item;

			}, (err:Proto.CompletionDetailsResponse) => {
				return item;
			});

		}
	}	

	private static bySortText(a: Proto.CompletionEntry, b: Proto.CompletionEntry): number {
		return a.sortText.localeCompare(b.sortText);
	}
}

export = SuggestSupport;