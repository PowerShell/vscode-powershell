/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

'use strict';

import vscode = require('vscode');

export interface IConfiguration {
	editorServicesHostPath?: string;
	waitForDebugger?: boolean;
	enableLogging?: boolean;
}
export var defaultConfiguration: IConfiguration = {
	editorServicesHostPath: undefined,
	waitForDebugger: false,
	enableLogging: false
}

export function load(myPluginId: string): IConfiguration {
	let configuration = vscode.workspace.getConfiguration(myPluginId);
	return {
		editorServicesHostPath: configuration.get<string>("editorServicesHostPath", "../bin/Microsoft.PowerShell.EditorServices.Host.exe"),
		waitForDebugger: configuration.get<boolean>("waitForDebugger", false),
		enableLogging: configuration.get<boolean>("enableLogging", false)
	}
}
