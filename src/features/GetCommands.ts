// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import * as vscode from "vscode";
import { RequestType0 } from "vscode-languageclient";
import { LanguageClient } from "vscode-languageclient/node";
import { ILogger } from "../logging";
import { LanguageClientConsumer } from "../languageClientConsumer";
import { getSettings } from "../settings";

interface ICommand {
    name: string;
    moduleName: string;
    defaultParameterSet: string;
    parameterSets: object;
    parameters: object;
}

/**
 * RequestType sent over to PSES.
 * Expects: ICommand to be returned
 */
export const GetCommandRequestType = new RequestType0<ICommand[], void>("powerShell/getCommand");

/**
 * A PowerShell Command listing feature. Implements a treeview control.
 */
export class GetCommandsFeature extends LanguageClientConsumer {
    private commands: vscode.Disposable[];
    private commandsExplorerProvider: CommandsExplorerProvider;
    private commandsExplorerTreeView: vscode.TreeView<Command>;

    constructor(private logger: ILogger) {
        super();
        this.commands = [
            vscode.commands.registerCommand("PowerShell.RefreshCommandsExplorer",
                async () => await this.CommandExplorerRefresh()),
            vscode.commands.registerCommand("PowerShell.InsertCommand", async (item) => await this.InsertCommand(item))
        ];
        this.commandsExplorerProvider = new CommandsExplorerProvider();

        this.commandsExplorerTreeView = vscode.window.createTreeView<Command>("PowerShellCommands",
            { treeDataProvider: this.commandsExplorerProvider });

        // Refresh the command explorer when the view is visible
        this.commandsExplorerTreeView.onDidChangeVisibility(async (e) => {
            if (e.visible) {
                await this.CommandExplorerRefresh();
            }
        });
    }

    public dispose() {
        for (const command of this.commands) {
            command.dispose();
        }
    }

    public override setLanguageClient(languageclient: LanguageClient) {
        this.languageClient = languageclient;
        if (this.commandsExplorerTreeView.visible) {
            void vscode.commands.executeCommand("PowerShell.RefreshCommandsExplorer");
        }
    }

    private async CommandExplorerRefresh() {
        if (this.languageClient === undefined) {
            this.logger.writeVerbose(`<${GetCommandsFeature.name}>: Unable to send getCommand request`);
            return;
        }
        await this.languageClient.sendRequest(GetCommandRequestType).then((result) => {
            const exclusions = getSettings().sideBar.CommandExplorerExcludeFilter;
            const excludeFilter = exclusions.map((filter: string) => filter.toLowerCase());
            result = result.filter((command) => (!excludeFilter.includes(command.moduleName.toLowerCase())));
            this.commandsExplorerProvider.powerShellCommands = result.map(toCommand);
            this.commandsExplorerProvider.refresh();
        });
    }

    private async InsertCommand(item: { Name: string; }) {
        const editor = vscode.window.activeTextEditor;
        if (editor === undefined) {
            return;
        }

        const sls = editor.selection.start;
        const sle = editor.selection.end;
        const range = new vscode.Range(sls.line, sls.character, sle.line, sle.character);
        await editor.edit((editBuilder) => {
            editBuilder.replace(range, item.Name);
        });
    }
}

class CommandsExplorerProvider implements vscode.TreeDataProvider<Command> {
    public readonly onDidChangeTreeData: vscode.Event<Command | undefined>;
    public powerShellCommands: Command[] = [];
    private didChangeTreeData: vscode.EventEmitter<Command | undefined> = new vscode.EventEmitter<Command>();

    constructor() {
        this.onDidChangeTreeData = this.didChangeTreeData.event;
    }

    public refresh(): void {
        this.didChangeTreeData.fire(undefined);
    }

    public getTreeItem(element: Command): vscode.TreeItem {
        return element;
    }

    public getChildren(_element?: Command): Thenable<Command[]> {
        return Promise.resolve(this.powerShellCommands);
    }
}

function toCommand(command: ICommand): Command {
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
        public override readonly collapsibleState = vscode.TreeItemCollapsibleState.None,
    ) {
        super(Name, collapsibleState);
    }

    public getTreeItem(): vscode.TreeItem {
        return {
            label: this.label,
            collapsibleState: this.collapsibleState,
        };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/require-await
    public async getChildren(_element?: any): Promise<Command[]> {
        // Returning an empty array because we need to return something.
        return [];
    }

}
