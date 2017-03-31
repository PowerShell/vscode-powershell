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

            // For launch of "current script", don't start the debugger if the current file
            // is not a file that can be debugged by PowerShell
            if (config.script === "${file}") {
                let currentDocument = vscode.window.activeTextEditor.document;
                let ext =
                    currentDocument.fileName.substr(
                        currentDocument.fileName.lastIndexOf('.') + 1);

                if ((currentDocument.languageId !== 'powershell') ||
                    (!currentDocument.isUntitled) && (ext !== "ps1" && ext !== "psm1")) {
                    let path = currentDocument.fileName;
                    let workspaceRootPath = vscode.workspace.rootPath;
                    if (currentDocument.fileName.startsWith(workspaceRootPath)) {
                        path = currentDocument.fileName.substring(vscode.workspace.rootPath.length + 1);
                    }

                    let msg = "'" + path + "' is a file type that cannot be debugged by the PowerShell debugger.";
                    vscode.window.showErrorMessage(msg);
                    return;
                }
                else if (currentDocument.isUntitled) {
                    config.script = currentDocument.uri.toString();
                }
            }
        }

        // Prevent the Debug Console from opening
        config.internalConsoleOptions = "neverOpen";

        // Create or show the interactive console
        // TODO #367: Check if "newSession" mode is configured
        vscode.commands.executeCommand('PowerShell.ShowSessionConsole', true);

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
    private getLanguageClientResolve: (value?: LanguageClient | Thenable<LanguageClient>) => void;

    constructor() {

        this.command =
            vscode.commands.registerCommand('PowerShell.PickPSHostProcess', () => {
                return this.getLanguageClient()
                           .then(_ => this.pickPSHostProcess(), _ => undefined);
            });
    }

    public setLanguageClient(languageClient: LanguageClient) {
        this.languageClient = languageClient;

        if (this.waitingForClientToken) {
            this.getLanguageClientResolve(this.languageClient);
            this.clearWaitingToken();
        }
    }

    public dispose() {
        this.command.dispose();
    }

    private getLanguageClient(): Thenable<LanguageClient> {
        if (this.languageClient) {
            return Promise.resolve(this.languageClient);
        }
        else {
            // If PowerShell isn't finished loading yet, show a loading message
            // until the LanguageClient is passed on to us
            this.waitingForClientToken = new vscode.CancellationTokenSource();

            return new Promise<LanguageClient>(
                (resolve, reject) => {
                    this.getLanguageClientResolve = resolve;

                    vscode.window
                        .showQuickPick(
                            ["Cancel"],
                            { placeHolder: "Attach to PowerShell host process: Please wait, starting PowerShell..." },
                            this.waitingForClientToken.token)
                        .then(response => {
                            if (response === "Cancel") {
                                this.clearWaitingToken();
                                reject();
                            }
                        });

                    // Cancel the loading prompt after 60 seconds
                    setTimeout(() => {
                            if (this.waitingForClientToken) {
                                this.clearWaitingToken();
                                reject();

                                vscode.window.showErrorMessage(
                                    "Attach to PowerShell host process: PowerShell session took too long to start.");
                            }
                        }, 60000);
                }
            );
        }
    }

	private pickPSHostProcess(): Thenable<string> {
        return this.languageClient.sendRequest(GetPSHostProcessesRequest.type, null).then(hostProcesses => {
            var items: ProcessItem[] = [];

            for (var p in hostProcesses) {
                var windowTitle = "";
                if (hostProcesses[p].mainWindowTitle) {
                    windowTitle = `, Title: ${hostProcesses[p].mainWindowTitle}`;
                }

                items.push({
                    label: hostProcesses[p].processName,
                    description: `PID: ${hostProcesses[p].processId.toString()}${windowTitle}`,
                    pid: hostProcesses[p].processId
                });
            };

            if (items.length === 0) {
                return Promise.reject("There are no PowerShell host processes to attach to.");
            }

            let options : vscode.QuickPickOptions = {
                placeHolder: "Select a PowerShell host process to attach to",
                matchOnDescription: true,
                matchOnDetail: true
            };

            return vscode.window.showQuickPick(items, options).then(item => {
                return item ? item.pid : "";
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
