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

export function load(myPluginId: string): Thenable<IConfiguration> {
	let configuration = vscode.extensions.getConfigurationMemento(myPluginId);
	return configuration.getValues<IConfiguration>(defaultConfiguration);
}
