/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/
// tslint:disable:no-console
import * as vscode from "vscode";
import { LanguageClient, RequestType } from "vscode-languageclient";
import { IFeature } from "../feature";

export const GetCommandsRequestType = new RequestType<any, any, void, void>("powerShell/getCommands");

export class GetCommandsFeature implements IFeature {
    private command: vscode.Disposable;
    private languageClient: LanguageClient;

    constructor() {
        this.command = vscode.commands.registerCommand("PowerShell.GetCommands", () => {
            if (this.languageClient === undefined) {
                // We be screwed
                return;
            }
            this.languageClient.sendRequest(GetCommandsRequestType, "").then((result) => {
                const toCommand = (command: any): Command => {
                    return new Command(
                        command.name,
                        command.moduleName,
                        command.defaultParameterSet,
                        command.parameterSets,
                        command.parameters,
                    );
                };
                // commandsExplorerProvider.powerShellCommands = result.map(toCommand);
            });
        });
    }

    public dispose() {
        this.command.dispose();
    }

    public setLanguageClient(languageclient: LanguageClient) {
        this.languageClient = languageclient;
    }
}

export class CommandsExplorerProvider implements vscode.TreeDataProvider<Command> {
    public readonly didChangeTreeDataEvent: vscode.Event<Command>;
    public powerShellCommands: Command[];
    private didChangeTreeData: vscode.EventEmitter<Command> = new vscode.EventEmitter<Command>();

    constructor() {
        this.didChangeTreeDataEvent = this.didChangeTreeData.event;
    }

    public refresh(): void {
        this.didChangeTreeData.fire();
    }

    public getTreeItem(element: Command): vscode.TreeItem {
        return element;
    }

    public async getChildren(element?: Command): Promise<Command[]> {
        return Promise.resolve(this.powerShellCommands ? this.powerShellCommands : []);
    }

}

class Command extends vscode.TreeItem {
    public contextValue = "command";
    constructor(
        public readonly Name: string,
        public readonly ModuleName: string,
        public readonly defaultParameterSet: string,
        public readonly ParameterSets: object,
        public readonly Parameters: object,
        public readonly collapsibleState = vscode.TreeItemCollapsibleState.None,
    ) {
        super(Name, collapsibleState);
        this.label = Name;
    }

    public getTreeItem(): vscode.TreeItem {
        return {
            label: this.label,
            collapsibleState: this.collapsibleState,
        };
    }

    public async getChildren(element): Promise<Command[]> {
        return [];
    }

}

class CommandNode extends Command {
    public populatedCommands: Command[];
    constructor(
        public eventEmitter: vscode.EventEmitter<Command>,
        public readonly Name: string = "PowerShell",
        public readonly ModuleName: string = "PowerShell",
        public readonly defaultParameterSet: string = "",
        public readonly ParameterSets: object = {},
        public readonly Parameters: object = {},
        public readonly collapsibleState = vscode.TreeItemCollapsibleState.Expanded,
    ) {
        super(
            Name,
            ModuleName,
            defaultParameterSet,
            ParameterSets,
            Parameters,
            collapsibleState,
        );
    }

    public getTreeItem(): vscode.TreeItem {
        return {
            label: this.Name,
            collapsibleState: this.collapsibleState,
        };
    }

    public async getChildren(element): Promise<Command[]> {
        if (undefined !== this.populatedCommands) {
            return this.populatedCommands;
        }
    }
}
