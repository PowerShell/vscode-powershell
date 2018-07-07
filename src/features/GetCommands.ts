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
            console.log("Before calling PSES");
            this.languageClient.sendRequest(GetCommandsRequestType, "").then((result) => {
                console.log(result);
            });
            console.log("After calling PSES");
        });
    }

    public dispose() {
        this.command.dispose();
    }

    public setLanguageClient(languageclient: LanguageClient) {
        this.languageClient = languageclient;
    }
}

class CommandExplorerProvider implements vscode.TreeDataProvider<Command> {
    public readonly didChangeTreeDataEvent: vscode.Event<Command | undefined>;
    private didChangeTreeData: vscode.EventEmitter<Command | undefined>;

    constructor() {
        this.didChangeTreeData = new vscode.EventEmitter<Command | undefined>();
        this.didChangeTreeDataEvent = this.didChangeTreeData.event;
    }

    public refresh(): void {
        this.didChangeTreeData.fire();
    }

    public getTreeItem(element: Command): vscode.TreeItem {
        return element;
    }

    public getChildren(element?: Command): Thenable<Command[]> {
        return Promise.resolve(this.getCommandsFromJson());
    }

    public getCommandsFromJson(): Command[] {
        const commandsJson = JSON.parse(fs.readFileSync("e:\\temp\\commands.json", "utf-8"));
        // vscode.commands.executeCommand("PowerShell.GetCommands");
        const toCommand = (command: any): Command => {
            return new Command(command.ModuleName + "\\" + command.Name);       };
        const commands = commandsJson.map(toCommand);
        return commands;
    }

}

class Command extends vscode.TreeItem {
    constructor(public readonly label: string) {
        super(label);
    }
}