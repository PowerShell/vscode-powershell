/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/
import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { LanguageClient, RequestType0 } from "vscode-languageclient";
import { Logger } from "../logging";
import { LanguageClientConsumer } from "../languageClientConsumer";

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
export const GetCommandRequestType = new RequestType0<ICommand[], void, void>("powerShell/getCommand");

/**
 * A PowerShell Command listing feature. Implements a treeview control.
 */
export class GetCommandsFeature extends LanguageClientConsumer {
    private command: vscode.Disposable;
    private commandsExplorerProvider: CommandsExplorerProvider;
    private commandsExplorerTreeView: vscode.TreeView<Command>;
    private currentPanel: vscode.WebviewPanel | undefined;
    private onDiskPath: vscode.Uri;
    private htmlUri: any;

constructor(private log: Logger, private extensionContext: vscode.ExtensionContext) {
        super();
        this.onDiskPath = vscode.Uri.file(path.join(this.extensionContext.extensionPath, "media", "insert.html"));
        this.htmlUri = this.onDiskPath.with({ scheme: "vscode-resource" });
        this.command = vscode.commands.registerCommand("PowerShell.RefreshCommandsExplorer",
            () => this.CommandExplorerRefresh());
        this.commandsExplorerProvider = new CommandsExplorerProvider();

        this.commandsExplorerTreeView = vscode.window.createTreeView<Command>("PowerShellCommands",
            { treeDataProvider: this.commandsExplorerProvider });

        // Refresh the command explorer when the view is visible
        this.commandsExplorerTreeView.onDidChangeVisibility((e) => {
            if (e.visible) {
                this.CommandExplorerRefresh();
            }
        });

        vscode.commands.registerCommand("PowerShell.InsertCommand", (item) => {
            this.languageClient.sendRequest(GetCommandRequestType, item.Name).then((result) => {
                this.BuildCommand(result);
            });
        });
    }

    public dispose() {
        this.command.dispose();
    }

    public setLanguageClient(languageclient: LanguageClient) {
        this.languageClient = languageclient;
        if (this.commandsExplorerTreeView.visible) {
            vscode.commands.executeCommand("PowerShell.RefreshCommandsExplorer");
        }
    }

    private CommandExplorerRefresh() {
        if (this.languageClient === undefined) {
            this.log.writeVerbose(`<${GetCommandsFeature.name}>: Unable to send getCommand request`);
            return;
        }
        this.languageClient.sendRequest(GetCommandRequestType).then((result) => {
            const SidebarConfig = vscode.workspace.getConfiguration("powershell.sideBar");
            const excludeFilter = (SidebarConfig.CommandExplorerExcludeFilter).map((filter) => filter.toLowerCase());
            result = result.filter((command) => (excludeFilter.indexOf(command.moduleName.toLowerCase()) === -1));
            this.commandsExplorerProvider.powerShellCommands = result.map(toCommand);
            this.commandsExplorerProvider.refresh();
        });
    }

    private InsertCommand(item) {
        // TODO: Figure out how we can insert this....
        let insertCommand: string = item.name;
        if (item.filledParameters !== {}) {
            // tslint:disable-next-line:forin
            for (const element in item.filledParameters) {
                if (item.filledParameters[element] === "$true") {
                    insertCommand += ` -${element}`;
                } else {
                    if (item.filledParameters[element].indexOf(" ") !== -1) {
                        insertCommand += ` -${element} "${item.filledParameters[element]}"`;
                    } else {
                        insertCommand += ` -${element} ${item.filledParameters[element]}`;
                    }
                }
            }
        }
        const edi = vscode.window.activeTextEditor;
        // TODO: Determine what we need that's not any...
        const editor = vscode.window.visibleTextEditors.filter((ed: any) => (ed._id === item.editor._id));
        if (editor.length !== 1) {
            vscode.window.showErrorMessage("The previously active editor has gone away.");
            return;
        }
        const sls = editor[0].selection.start;
        const sle = editor[0].selection.end;
        const range = new vscode.Range(sls.line, sls.character, sle.line, sle.character);
        editor[0].edit((editBuilder) => {
            editBuilder.replace(range, insertCommand);
        });
    }

    private BuildCommand(item) {
        if (vscode.window.activeTextEditor.document.languageId !== "powershell") {
            vscode.window.showErrorMessage("Active editor is not a PowerShell window.");
            return;
        }
        item[0].editor = vscode.window.activeTextEditor;
        if (this.currentPanel) {
            this.currentPanel.reveal();
        } else {
            this.currentPanel = vscode.window.createWebviewPanel(
                "powerShellCommandInput",
                "PowerShell Command Input",
                vscode.ViewColumn.Beside,
                {
                    enableScripts: true,
                    retainContextWhenHidden: true,
                    localResourceRoots: [vscode.Uri.file(this.extensionContext.extensionPath)],
                },
            );

            this.currentPanel.webview.html = fs.readFileSync(this.htmlUri.fsPath, "utf8");
            this.currentPanel.webview.onDidReceiveMessage((message) => {
                this.InsertCommand(message);
                this.currentPanel.dispose();
            });
            this.currentPanel.onDidDispose(() => {
                this.currentPanel = undefined;
            });
        }
        this.currentPanel.webview.postMessage(item);
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

    public async getChildren(element?): Promise<Command[]> {
        return [];
        // Returning an empty array because we need to return something.
    }

}
