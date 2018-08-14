/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/
import * as vscode from "vscode";
import { LanguageClient, RequestType } from "vscode-languageclient";
import { IFeature } from "../feature";

export const GetAllCommandsRequestType = new RequestType<any, any, void, void>("powerShell/getAllCommands");

export class GetCommandsFeature implements IFeature {
    private command: vscode.Disposable;
    private languageClient: LanguageClient;
    private commandsExplorerProvider: CommandsExplorerProvider;

    constructor() {
        this.command = vscode.commands.registerCommand("PowerShell.RefreshCommandsExplorer", () => {
            if (this.languageClient === undefined) {
                // TODO: Log error message
                return;
            }
            this.languageClient.sendRequest(GetAllCommandsRequestType, "").then((result) => {
                this.commandsExplorerProvider.powerShellCommands = result.map(toCommand);
                this.commandsExplorerProvider.refresh();
            });
        });
        this.commandsExplorerProvider = new CommandsExplorerProvider();
        vscode.window.registerTreeDataProvider("PowerShellCommands", this.commandsExplorerProvider);
        vscode.commands.registerCommand("PowerShell.InsertCommand", (item) => {
            const editor = vscode.window.activeTextEditor;
            const sls = editor.selection.start;
            const sle = editor.selection.end;
            const range = new vscode.Range(sls.line, sls.character, sle.line, sle.character);
            editor.edit((editBuilder) => {
                editBuilder.replace(range, item.Name);
            });
        });
    }

    public dispose() {
        this.command.dispose();
    }

    public setLanguageClient(languageclient: LanguageClient) {
        this.languageClient = languageclient;
        vscode.commands.executeCommand("PowerShell.RefreshCommandsExplorer");
    }
}

class CommandsExplorerProvider implements vscode.TreeDataProvider<Command> {
    public readonly onDidChangeTreeData: vscode.Event<Command | undefined>;
    public powerShellCommands: Command[];
    private didChangeTreeData: vscode.EventEmitter<Command | undefined> = new vscode.EventEmitter<Command>();

    constructor() {
        this.onDidChangeTreeData = this.didChangeTreeData.event;
    }

    public refresh(): void {
        this.didChangeTreeData.fire();
    }

    public getTreeItem(element: Command): vscode.TreeItem {
        return element;
    }

    public getChildren(element?: Command): Thenable<Command[]> {
        return Promise.resolve(this.powerShellCommands || []);
    }

}

function toCommand(command: any): Command {
    return new Command(
        command.name,
        command.moduleName,
        command.defaultParameterSet,
        command.parameterSets,
        command.parameters,
    );
}

class Command extends vscode.TreeItem {
    constructor(
        public readonly Name: string,
        public readonly ModuleName: string,
        public readonly defaultParameterSet: string,
        public readonly ParameterSets: object,
        public readonly Parameters: object,
        public readonly collapsibleState = vscode.TreeItemCollapsibleState.None,
    ) {
        super(Name, collapsibleState);
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
