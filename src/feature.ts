/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import vscode = require('vscode');
import { LanguageClient } from 'vscode-languageclient';
export { LanguageClient } from 'vscode-languageclient';

export interface IFeature extends vscode.Disposable {
    setLanguageClient(languageclient: LanguageClient);
    dispose();
}
