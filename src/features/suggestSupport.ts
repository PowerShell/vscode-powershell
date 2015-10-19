/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

'use strict';

import vscode = require('vscode');

import Previewer = require('./previewer');
import Proto = require('../protocol');
import PConst = require('../protocol.const');
import Configuration = require('./configuration');
import PowershellService = require('../powershellService');

class SuggestSupport implements vscode.Modes.ISuggestSupport {

	public triggerCharacters = ['.','$','-'];
	public excludeTokens = ['string', 'comment', 'numeric'];
	public sortBy = [{ type: 'reference', partSeparator: '/' }];

	private client: PowershellService.IPowershellServiceClient;
	private config:Configuration.IConfiguration;

	constructor(client: PowershellService.IPowershellServiceClient) {
		this.client = client;
		this.config = Configuration.defaultConfiguration;
	}

	public setConfiguration(config: Configuration.IConfiguration): void {
		this.config = config;
	}

	public suggest(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): Promise<vscode.Modes.ISuggestions[]> {
		var filepath = this.client.asAbsolutePath(document.getUri());
		var args: Proto.CompletionsRequestArgs = {
			file: filepath,
			//line: position.line + 1,
			//offset: position.character + 1
			line: position.line,
			offset: position.character
		};
		if (!args.file) {
			return Promise.resolve<vscode.Modes.ISuggestions[]>([]);
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

			var suggests:vscode.Modes.ISuggestion[] = [];
			var body = msg.body;

			// sort by CompletionEntry#sortText
			// TODO: Uncomment this?
			//msg.body.sort(SuggestSupport.bySortText);

			for (var i = 0; i < body.length; i++) {
				var element = body[i];
				suggests.push({
					label: element.name,
					codeSnippet: element.name,
					type: this.monacoTypeFromEntryKind(element.kind)
				});
			}
			var currentWord = '';
			if (wordRange) {
				currentWord = document.getTextInRange(new vscode.Range(wordRange.start, position));
			}
			return [{
				currentWord: currentWord,
				suggestions: suggests
			}];
		}, (err:Proto.CompletionsResponse) => {
			return [];
		});
	}

	public getSuggestionDetails(document:vscode.TextDocument, position:vscode.Position, suggestion:vscode.Modes.ISuggestion, token: vscode.CancellationToken): Promise<vscode.Modes.ISuggestion> {
		if(suggestion.type === 'snippet') {
			return Promise.resolve(suggestion);
		}

		var args: Proto.CompletionDetailsRequestArgs = {
			file: this.client.asAbsolutePath(document.getUri()),
			//line: position.line + 1,
			//offset: position.character + 1,
			line: position.line,
			offset: position.character,
			entryNames: [
				suggestion.label
			]
		};
		return this.client.execute('completionEntryDetails', args).then((response) => {
			var details = response.body;
			if (details && details.length > 0) {
				var detail = details[0];
				suggestion.documentationLabel = Previewer.plain(detail.documentation);
				suggestion.typeLabel = Previewer.plain(detail.displayParts);
			}

			if (this.monacoTypeFromEntryKind(detail.kind) === 'function') {
				var codeSnippet = detail.name,
					suggestionArgumentNames: string[];

				suggestionArgumentNames = detail.displayParts
					.filter(part => part.kind === 'parameterName')
					.map(part => `{{${part.text}}}`);

				if (suggestionArgumentNames.length > 0) {
					codeSnippet += '(' + suggestionArgumentNames.join(', ') + '){{}}';
				} else {
					codeSnippet += '()';
				}
				suggestion.codeSnippet = codeSnippet;
			}
			return suggestion;
		}, (err:Proto.CompletionDetailsResponse) => {
			return suggestion;
		});
	}

	private monacoTypeFromEntryKind(kind:string):string {
		switch(kind) {
			case PConst.Kind.primitiveType:
			case PConst.Kind.keyword:
				return 'keyword';

			case PConst.Kind.variable:
			case PConst.Kind.localVariable:
			case PConst.Kind.memberVariable:
			case PConst.Kind.memberGetAccessor:
			case PConst.Kind.memberSetAccessor:
				return 'field';

			case PConst.Kind.function:
			case PConst.Kind.memberFunction:
			case PConst.Kind.constructSignature:
			case PConst.Kind.callSignature:
				return 'function';
		}
		return kind;
	}

	private static bySortText(a: Proto.CompletionEntry, b: Proto.CompletionEntry): number {
		return a.sortText.localeCompare(b.sortText);
	}
}

export = SuggestSupport;