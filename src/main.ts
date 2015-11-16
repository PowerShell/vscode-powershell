/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

'use strict';

import path = require('path');
import vscode = require('vscode');
import configuration = require('./features/configuration');
import { LanguageClient, LanguageClientOptions, Executable } from 'vscode-languageclient';

export function activate(context: vscode.ExtensionContext): void {
	
	var PowerShellLanguageId = 'PowerShell';

	vscode.languages.setLanguageConfiguration(PowerShellLanguageId, 
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
	
	let serverPath = resolveLanguageServerPath();
	let serverOptions = {
		run: { 
			command: serverPath, 
		},
		debug: { 
			command: serverPath,
			args: ['/waitForDebugger']
		}
	};

	let clientOptions: LanguageClientOptions = {
		documentSelector: [PowerShellLanguageId],
		synchronize: {
			configurationSection: PowerShellLanguageId,
			//fileEvents: vscode.workspace.createFileSystemWatcher('**/.eslintrc')
		}
	}

	let client = 
		new LanguageClient(
			'PowerShell Editor Services', 
			serverOptions, 
			clientOptions);
			
	client.start();
}

function resolveLanguageServerPath() : string {
	var config = configuration.load('PowerShell');
	var editorServicesHostPath = config.editorServicesHostPath;
	
	if (config.editorServicesHostPath)
	{	
		console.log("Found Editor Services path from config: " + editorServicesHostPath);
				
		// Make the path absolute if it's not
		editorServicesHostPath =
			path.resolve(
				__dirname,
				config.editorServicesHostPath);
				
		console.log("    Resolved path to: " + editorServicesHostPath);
	}
	else
	{
		// Use the default path in the plugin's 'bin' folder
		editorServicesHostPath =
			path.join(
				__dirname,
				'..',
				'bin',
				'Microsoft.PowerShell.EditorServices.Host.exe');
				
		console.log("Using default Editor Services path: " + editorServicesHostPath);
	}
	
	return editorServicesHostPath;
}
