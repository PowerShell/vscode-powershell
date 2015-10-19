/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

'use strict';

import vscode = require('vscode');

import Proto = require('./protocol');

export interface IPowershellServiceClientHost {
	syntaxDiagnosticsReceived(event:Proto.DiagnosticEvent):void;
	semanticDiagnosticsReceived(event:Proto.DiagnosticEvent):void;
}

export interface IPowershellServiceClient {
	asAbsolutePath(resource: vscode.Uri): string;
	asUrl(filepath: string): vscode.Uri;

	trace: boolean;
	log(message: string): void;

	execute(command:'configure', args:Proto.ConfigureRequestArguments, token?: vscode.CancellationToken):Promise<Proto.ConfigureResponse>;
	execute(command:'open', args:Proto.OpenRequestArgs, expectedResult:boolean, token?: vscode.CancellationToken):Promise<any>;
	execute(command:'close', args:Proto.FileRequestArgs, expectedResult:boolean, token?: vscode.CancellationToken):Promise<any>;
	execute(command:'change', args:Proto.ChangeRequestArgs, expectedResult:boolean, token?: vscode.CancellationToken):Promise<any>;
	execute(command:'geterr', args:Proto.GeterrRequestArgs, expectedResult:boolean, token?: vscode.CancellationToken):Promise<any>;
	execute(command:'quickinfo', args:Proto.FileLocationRequestArgs, token?: vscode.CancellationToken):Promise<Proto.QuickInfoResponse>;
	execute(command:'completions', args:Proto.CompletionsRequestArgs, token?: vscode.CancellationToken):Promise<Proto.CompletionsResponse>;
	execute(commant:'completionEntryDetails', args:Proto.CompletionDetailsRequestArgs, token?: vscode.CancellationToken):Promise<Proto.CompletionDetailsResponse>;
	execute(commant:'signatureHelp', args:Proto.SignatureHelpRequestArgs, token?: vscode.CancellationToken):Promise<Proto.SignatureHelpResponse>;
	execute(command:'definition', args:Proto.FileLocationRequestArgs, token?: vscode.CancellationToken):Promise<Proto.DefinitionResponse>;
	execute(command:'references', args:Proto.FileLocationRequestArgs, token?:vscode.CancellationToken):Promise<Proto.ReferencesResponse>;
	execute(command:'navto', args:Proto.NavtoRequestArgs, token?:vscode.CancellationToken):Promise<Proto.NavtoResponse>;
	execute(command:'navbar', args:Proto.FileRequestArgs, token?: vscode.CancellationToken):Promise<Proto.NavBarResponse>;
	execute(command:'format', args:Proto.FormatRequestArgs, token?: vscode.CancellationToken):Promise<Proto.FormatResponse>;
	execute(command:'formatonkey', args:Proto.FormatOnKeyRequestArgs, token?: vscode.CancellationToken):Promise<Proto.FormatResponse>;
	execute(command:'rename', args: Proto.RenameRequestArgs, token?: vscode.CancellationToken): Promise<Proto.RenameResponse>;
	execute(command:'occurrences', args: Proto.FileLocationRequestArgs, token?: vscode.CancellationToken): Promise<Proto.OccurrencesResponse>;
	execute(command:string, args:any, expectedResult:boolean|vscode.CancellationToken, token?:vscode.CancellationToken):Promise<any>;
}