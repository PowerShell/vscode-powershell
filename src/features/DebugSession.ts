/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import vscode = require('vscode');
import { IFeature } from '../feature';
import { LanguageClient, RequestType, NotificationType } from 'vscode-languageclient';

export class DebugSessionFeature implements IFeature {
    private command: vscode.Disposable;
    private examplesPath: string;

    constructor() {
        this.command = vscode.commands.registerCommand(
            'PowerShell.StartDebugSession',
            config => { this.startDebugSession(config); });
    }

    public setLanguageClient(languageclient: LanguageClient) {
    }

    public dispose() {
        this.command.dispose();
    }

    private startDebugSession(config: any) {
        if (!config.request) {
            // No launch.json, create the default configuration
            config.type = 'PowerShell';
            config.name = 'PowerShell Launch Current File';
            config.request = 'launch';
            config.args = [];
            config.script = vscode.window.activeTextEditor.document.fileName;
        }

        if (config.request === 'launch') {
            // Make sure there's a usable working directory if possible
            config.cwd = config.cwd || vscode.workspace.rootPath || config.script;
        }

        vscode.commands.executeCommand('vscode.startDebug', config);
    }
}

interface ProcessItem extends vscode.QuickPickItem {
	pid: string;	// payload for the QuickPick UI
}

interface PSHostProcessInfo {
    processName: string;
    processId: string;
    appDomainName: string;
    mainWindowTitle: string;
}

namespace GetPSHostProcessesRequest {
    export const type: RequestType<any, GetPSHostProcessesResponseBody, string> =
        { get method() { return 'powerShell/getPSHostProcesses'; } };
}

interface GetPSHostProcessesResponseBody {
    hostProcesses: PSHostProcessInfo[];
}

export class PickPSHostProcessFeature implements IFeature {

    private command: vscode.Disposable;
    private languageClient: LanguageClient;
    private waitingForClientToken: vscode.CancellationTokenSource;

    constructor() {
        this.command =
            vscode.commands.registerCommand('PowerShell.PickPSHostProcess', () => {

                if (!this.languageClient && !this.waitingForClientToken) {

                    // If PowerShell isn't finished loading yet, show a loading message
                    // until the LanguageClient is passed on to us
                    this.waitingForClientToken = new vscode.CancellationTokenSource();
                    vscode.window
                        .showQuickPick(
                            ["Cancel"],
                            { placeHolder: "Select PowerShell Host Process to attach to: Please wait, starting PowerShell..." },
                            this.waitingForClientToken.token)
                        .then(response => { if (response === "Cancel") { this.clearWaitingToken(); } });

                    // Cancel the loading prompt after 60 seconds
                    setTimeout(() => {
                            if (this.waitingForClientToken) {
                                this.clearWaitingToken();

                                vscode.window.showErrorMessage(
                                    "Select PowerShell Host Process to attach to: PowerShell session took too long to start.");
                            }
                        }, 60000);
                }
                else {
                    return this.pickPSHostProcess();
                }
            });
    }

    public setLanguageClient(languageClient: LanguageClient) {
        this.languageClient = languageClient;

        if (this.waitingForClientToken) {
            this.clearWaitingToken();
            return this.pickPSHostProcess();
        }
    }

    public dispose() {
        this.command.dispose();
    }

    // In node, the function returned a Promise<string> not sure about "Thenable<string>"
	private pickPSHostProcess(): Thenable<string> {
		return this.languageClient.sendRequest(GetPSHostProcessesRequest.type, null).then(hostProcesses => {
			var items: ProcessItem[] = [];

			for(var p in hostProcesses) {
				items.push({
					label: hostProcesses[p].processName,
                    description: hostProcesses[p].processId.toString(),
					detail: hostProcesses[p].mainWindowTitle,
					pid: hostProcesses[p].processId
				 });
			};

			let options : vscode.QuickPickOptions = {
				placeHolder: "Select a PowerShell Host process to attach to",
				matchOnDescription: true,
				matchOnDetail: true
			};

			return vscode.window.showQuickPick(items, options).then(item => {
				return item ? item.pid : null;
			});
		});
	}

    private clearWaitingToken() {
        if (this.waitingForClientToken) {
            this.waitingForClientToken.dispose();
            this.waitingForClientToken = undefined;
        }
    }
}
