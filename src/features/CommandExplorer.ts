/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

"use strict";

import * as fs from "fs";
import * as vscode from "vscode";

export class CommandExplorerProvider implements vscode.TreeDataProvider<Command> {
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

        const toCommand = (command: any): Command => {
            return new Command(command.ModuleName + "\\" + command.Name, vscode.TreeItemCollapsibleState.None);       };
        const commands = commandsJson.map(toCommand);
        return commands;
    }

}

class Command extends vscode.TreeItem {
    constructor(public readonly label: string,
                public readonly collapsibleState: vscode.TreeItemCollapsibleState) {
        super(label, collapsibleState);
    }
}
