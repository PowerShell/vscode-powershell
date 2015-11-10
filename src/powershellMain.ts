/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

'use strict';

import vscode = require('vscode');

import PowershellService = require('./powershellService');
//import ExtraInfoSupport = require('./features/extraInfoSupport');
import OccurrencesSupport = require('./features/occurrencesSupport');
import ParameterHintsSupport = require('./features/parameterHintsSupport');
import BufferSyncSupport = require('./features/bufferSyncSupport');
import SuggestSupport = require('./features/suggestSupport');
import Configuration = require('./features/configuration');
import DeclarationSupport = require('./features/declarationSupport');
import ReferenceSupport = require('./features/referenceSupport');
import NavigateTypeSupport = require('./features/navigateTypesSupport');

import Proto = require('./protocol');
import PowershellServiceClient = require('./powershellServiceClient');

export function activate(subscriptions: vscode.Disposable[]): void {
	var MODE_ID = 'PowerShell';
	var clientHost = new PowershellServiceClientHost();
	var client = clientHost.serviceClient;
		
	vscode.languages.setLanguageConfiguration(MODE_ID, 
	{
		wordPattern: /(-?\d*\.\d\w*)|([^\`\~\!\@\#\%\^\&\*\(\)\=\+\[\{\]\}\\\|\;\'\"\,\.\<\>\/\?\s]+)/g,
		
		indentationRules: {
			// ^(.*\*/)?\s*\}.*$
			decreaseIndentPattern: /^(.*\*\/)?\s*\}.*$/,
			// ^.*\{[^}"']*$
			increaseIndentPattern: /^.*\{[^}"']*$/
		},		
		
		comments: {
			lineComment: '#',
			blockComment: ['<#', '#>']
		},
		
		brackets: [
			['{', '}'],
			['[', ']'],
			['(', ')'],
		],
		
		__electricCharacterSupport: {
			brackets: [
				{ tokenType:'delimiter.curly.ts', open: '{', close: '}', isElectric: true },
				{ tokenType:'delimiter.square.ts', open: '[', close: ']', isElectric: true },
				{ tokenType:'delimiter.paren.ts', open: '(', close: ')', isElectric: true }
			],
			docComment: { scope:'comment.documentation', open:'/**', lineStart:' * ', close:' */' }			
		},
		
		__characterPairSupport: {
			autoClosingPairs: [
				{ open: '{', close: '}' },
				{ open: '[', close: ']' },
				{ open: '(', close: ')' },
				{ open: '"', close: '"', notIn: ['string'] },
				{ open: '\'', close: '\'', notIn: ['string', 'comment'] }
			]			
		}
		
	});
	
	//vscode.languages.registerHoverProvider(MODE_ID, new ExtraInfoSupport(client));
	vscode.languages.registerDefinitionProvider(MODE_ID, new DeclarationSupport(client));
	vscode.languages.registerDocumentHighlightProvider(MODE_ID, new OccurrencesSupport(client));
	vscode.languages.registerSignatureHelpProvider(MODE_ID, new ParameterHintsSupport(client));
	vscode.languages.registerReferenceProvider(MODE_ID, new ReferenceSupport(client));
	//vscode.languages.registerWorkspaceSymbolProvider(new NavigateTypeSupport(client, MODE_ID));

	clientHost.addBufferSyncSupport(new BufferSyncSupport(client, MODE_ID));

	var suggestSupport = new SuggestSupport(client);
	vscode.languages.registerCompletionItemProvider(MODE_ID, suggestSupport, '.');
}

class PowershellServiceClientHost implements PowershellService.IPowershellServiceClientHost {

	private client: PowershellServiceClient;

	private syntaxDiagnostics: {[key:string]:vscode.Diagnostic[];};
	private currentDiagnostics: vscode.DiagnosticCollection;
	private bufferSyncSupports: BufferSyncSupport[];
	
	constructor() {
		this.bufferSyncSupports = [];
		let handleProjectCreateOrDelete = () => {
			this.client.execute('reloadProjects', null, false);
			this.triggerAllDiagnostics();
		};
		let handleProjectChange = () => {
			this.triggerAllDiagnostics();
		}

        // TODO: Set this up for psm1/psd1 files?		
		//let watcher = vscode.workspace.createFileSystemWatcher('**/tsconfig.json');
		//watcher.onDidCreate(handleProjectCreateOrDelete);
		//watcher.onDidDelete(handleProjectCreateOrDelete);
		//watcher.onDidChange(handleProjectChange);

		this.client = new PowershellServiceClient(this);
		this.syntaxDiagnostics = Object.create(null);
		this.currentDiagnostics = vscode.languages.createDiagnosticCollection('PowerShell');
	}

	public addBufferSyncSupport(support: BufferSyncSupport): void {
		this.bufferSyncSupports.push(support);
	}

	private triggerAllDiagnostics() {
		this.bufferSyncSupports.forEach(support => support.requestAllDiagnostics());
	}

	public get serviceClient(): PowershellServiceClient {
		return this.client;
	}

	/* internal */ syntaxDiagnosticsReceived(event:Proto.DiagnosticEvent):void {
		var body = event.body;
		if (body.diagnostics) {
			var markers = this.createMarkerDatas(body.diagnostics);
			this.syntaxDiagnostics[body.file] = markers;
		}
	}

	/* internal */ semanticDiagnosticsReceived(event:Proto.DiagnosticEvent):void {
		var body = event.body;
		if (body.diagnostics) {
			var diagnostics = this.createMarkerDatas(body.diagnostics);
			var syntaxMarkers = this.syntaxDiagnostics[body.file];
			if (syntaxMarkers) {
				delete this.syntaxDiagnostics[body.file];
				diagnostics = syntaxMarkers.concat(diagnostics);
			}
						
			this.currentDiagnostics.set(vscode.Uri.file(body.file), diagnostics);
		}
	}
	
	private createMarkerDatas(diagnostics: Proto.Diagnostic[]): vscode.Diagnostic[] {
		let result: vscode.Diagnostic[] = [];
		for (let diagnostic of diagnostics) {
			let {start, end, text} = diagnostic;
			let range = new vscode.Range(start.line - 1, start.offset - 1, end.line - 1, end.offset - 1);			

			result.push(new vscode.Diagnostic(range, text));
		}
		return result;
	}	
}
