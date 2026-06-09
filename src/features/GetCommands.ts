// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import * as vscode from "vscode";
import { RequestType } from "vscode-languageclient";
import { LanguageClient } from "vscode-languageclient/node";
import { LanguageClientConsumer } from "../languageClientConsumer";
import { ShowHelpRequestType } from "./ShowHelp";

interface ICommand {
    name: string;
    moduleName: string;
    moduleVersion?: string;
    // Parameter metadata is omitted when the request sets excludeParameters
    // (e.g. the Command Explorer tree, which only needs names and modules).
    defaultParameterSet?: string;
    parameterSets?: object;
    parameters?: Record<string, object>;
}

export interface IGetCommandArguments {
    name?: string;
    module?: string;
    excludeParameters?: boolean;
    excludeDefaultFunctions?: boolean;
}

/**
 * RequestType sent over to PSES.
 * Optionally scoped by command name and/or module (both support wildcards);
 * when neither is provided, all commands are returned. Set excludeParameters to
 * omit the expensive parameter metadata when only names/modules are needed, and
 * excludeDefaultFunctions to drop PowerShell's default-session shell functions
 * (e.g. cd.., prompt, TabExpansion2) that aren't meaningful in the command list.
 * Expects: ICommand[] to be returned
 */
export const GetCommandRequestType = new RequestType<
    IGetCommandArguments,
    ICommand[],
    void
>("powerShell/getCommand");

interface IGetModuleArguments {
    name: string;
    version?: string;
}

interface IModule {
    name: string;
    version: string;
    description: string;
    path: string;
    author: string;
    companyName: string;
    projectUri: string;
    powerShellVersion: string;
}

/**
 * RequestType sent over to PSES to retrieve a single module's metadata (used to
 * populate the Command Explorer's module tooltips on hover).
 */
export const GetModuleRequestType = new RequestType<
    IGetModuleArguments,
    IModule | null,
    void
>("powerShell/getModule");

type CommandExplorerNode = ModuleNode | CommandNode;

/**
 * A PowerShell Command listing feature. Implements a treeview control that
 * groups commands by module, loading only command names and modules (parameter
 * metadata is expensive to serialize and isn't shown in the tree).
 */
export class GetCommandsFeature extends LanguageClientConsumer {
    private commands: vscode.Disposable[];
    private commandsExplorerProvider: CommandsExplorerProvider;
    private commandsExplorerTreeView: vscode.TreeView<CommandExplorerNode>;

    constructor() {
        super();
        this.commands = [
            vscode.commands.registerCommand(
                "PowerShell.RefreshCommandsExplorer",
                async () => {
                    await this.CommandExplorerRefresh();
                },
            ),
            vscode.commands.registerCommand(
                "PowerShell.InsertCommand",
                async (item) => {
                    await this.InsertCommand(item);
                },
            ),
        ];
        this.commandsExplorerProvider = new CommandsExplorerProvider();

        this.commandsExplorerTreeView =
            vscode.window.createTreeView<CommandExplorerNode>(
                "PowerShellCommands",
                { treeDataProvider: this.commandsExplorerProvider },
            );

        // Refresh the command explorer when the view is visible
        this.commandsExplorerTreeView.onDidChangeVisibility(async (e) => {
            if (e.visible) {
                await this.CommandExplorerRefresh();
            }
        });
    }

    public dispose(): void {
        for (const command of this.commands) {
            command.dispose();
        }
    }

    public override onLanguageClientSet(_languageClient: LanguageClient): void {
        if (this.commandsExplorerTreeView.visible) {
            void vscode.commands.executeCommand(
                "PowerShell.RefreshCommandsExplorer",
            );
        }
    }

    private async CommandExplorerRefresh(): Promise<void> {
        const client = await LanguageClientConsumer.getLanguageClient();
        const result = await client.sendRequest(GetCommandRequestType, {
            excludeParameters: true,
            excludeDefaultFunctions: true,
        });
        const exclusions = vscode.workspace
            .getConfiguration("powershell.sideBar")
            .get<string[]>("CommandExplorerExcludeFilter", []);
        const excludeFilter = exclusions.map((filter: string) =>
            filter.toLowerCase(),
        );
        const filteredResult = result.filter(
            (command) =>
                !excludeFilter.includes(command.moduleName.toLowerCase()),
        );
        this.commandsExplorerProvider.setCommands(filteredResult);
    }

    private async InsertCommand(item: { Name: string }): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (editor === undefined) {
            return;
        }

        const sls = editor.selection.start;
        const sle = editor.selection.end;
        const range = new vscode.Range(
            sls.line,
            sls.character,
            sle.line,
            sle.character,
        );
        await editor.edit((editBuilder) => {
            editBuilder.replace(range, item.Name);
        });
    }
}

class CommandsExplorerProvider implements vscode.TreeDataProvider<CommandExplorerNode> {
    public readonly onDidChangeTreeData: vscode.Event<
        CommandExplorerNode | undefined
    >;
    private modules: ModuleNode[] = [];
    // Tooltips are cached by key (command name / module+version) so repeat hovers
    // within a single tree don't re-issue the (slow) request. The caches are
    // cleared on each refresh (see setCommands) since help may have changed.
    private readonly commandTooltips = new Map<string, vscode.MarkdownString>();
    private readonly moduleTooltips = new Map<string, vscode.MarkdownString>();
    private didChangeTreeData: vscode.EventEmitter<
        CommandExplorerNode | undefined
    > = new vscode.EventEmitter<CommandExplorerNode | undefined>();

    constructor() {
        this.onDidChangeTreeData = this.didChangeTreeData.event;
    }

    // Groups the flat command list into module -> command nodes. Commands are
    // keyed by module name AND version, so a module installed in multiple versions
    // (e.g. Pester 4 and 5) becomes separate rows rather than showing duplicate
    // command names.
    public setCommands(commands: ICommand[]): void {
        // A refresh may reflect newly imported modules or updated help, so drop
        // the cached tooltips and let them be re-fetched lazily on next hover.
        this.commandTooltips.clear();
        this.moduleTooltips.clear();

        const byModule = new Map<
            string,
            { moduleName: string; version: string; nodes: CommandNode[] }
        >();
        for (const command of commands) {
            const moduleName = command.moduleName || "";
            const version = command.moduleVersion ?? "";
            const key = `${moduleName}\u0000${version}`;
            const group = byModule.get(key) ?? {
                moduleName,
                version,
                nodes: [],
            };
            group.nodes.push(
                new CommandNode(command.name, moduleName, version),
            );
            byModule.set(key, group);
        }

        this.modules = [...byModule.values()]
            .map(
                ({ moduleName, version, nodes }) =>
                    new ModuleNode(
                        moduleName,
                        version,
                        nodes.sort((a, b) => a.Name.localeCompare(b.Name)),
                    ),
            )
            .sort(
                (a, b) =>
                    // Group a module's versions together, newest first.
                    a.ModuleName.localeCompare(b.ModuleName) ||
                    b.Version.localeCompare(a.Version, undefined, {
                        numeric: true,
                    }),
            );

        this.didChangeTreeData.fire(undefined);
    }

    public getTreeItem(element: CommandExplorerNode): vscode.TreeItem {
        return element;
    }

    // Lazily populates a node's tooltip the first time the user hovers it. Command
    // nodes show their help (reusing the powerShell/showHelp request); module nodes
    // show their metadata (powerShell/getModule). Results are cached by key so the
    // (slow) request only runs once per command/module, even across tree rebuilds.
    public async resolveTreeItem(
        item: vscode.TreeItem,
        element: CommandExplorerNode,
        token: vscode.CancellationToken,
    ): Promise<vscode.TreeItem> {
        if (item.tooltip !== undefined) {
            return item;
        }

        if (element instanceof CommandNode) {
            const cached = this.commandTooltips.get(element.Name);
            if (cached !== undefined) {
                item.tooltip = cached;
                return item;
            }

            const client = await LanguageClientConsumer.getLanguageClient();
            const result = await client.sendRequest(
                ShowHelpRequestType,
                { text: element.Name },
                token,
            );
            if (result.helpText) {
                const tooltip = new vscode.MarkdownString();
                tooltip.appendCodeblock(result.helpText, "powershell");
                this.commandTooltips.set(element.Name, tooltip);
                item.tooltip = tooltip;
            }
            return item;
        }

        if (element instanceof ModuleNode && element.ModuleName) {
            const key = `${element.ModuleName}\u0000${element.Version}`;
            const cached = this.moduleTooltips.get(key);
            if (cached !== undefined) {
                item.tooltip = cached;
                return item;
            }

            const client = await LanguageClientConsumer.getLanguageClient();
            const module = await client.sendRequest(
                GetModuleRequestType,
                { name: element.ModuleName, version: element.Version },
                token,
            );
            if (module) {
                const tooltip = ModuleNode.buildTooltip(
                    module,
                    element.commands.length,
                );
                this.moduleTooltips.set(key, tooltip);
                item.tooltip = tooltip;
            }
            return item;
        }

        return item;
    }

    public getChildren(
        element?: CommandExplorerNode,
    ): Thenable<CommandExplorerNode[]> {
        if (element === undefined) {
            return Promise.resolve(this.modules);
        }
        if (element instanceof ModuleNode) {
            return Promise.resolve(element.commands);
        }
        return Promise.resolve([]);
    }
}

class ModuleNode extends vscode.TreeItem {
    constructor(
        public readonly ModuleName: string,
        public readonly Version: string,
        public readonly commands: CommandNode[],
    ) {
        super(
            // Commands not exported by a module (built-in and profile-defined
            // functions, and scripts on the PATH) are grouped under a friendly label.
            ModuleName || "Functions & Scripts",
            vscode.TreeItemCollapsibleState.Collapsed,
        );
        this.contextValue = "module";
        // A unique id (module name + version) keeps VS Code from conflating
        // modules that share a label, e.g. two installed versions of Pester, whose
        // auto-generated (label-derived) ids would otherwise collide and confuse
        // the tree's expansion state.
        this.id = `${ModuleName}\u0000${Version}`;
        // Real modules get the "library" icon; the catch-all bucket gets a neutral
        // grouping icon so it doesn't read as an actual module. NB: avoid the exact
        // "folder" (and "file") codicons here — VS Code's tree special-cases those
        // ids as file-system folders/files and renders them with file-icon-theme
        // layout, which pushes their children one indent level too shallow. Any
        // other codicon (e.g. "folder-library") renders children at the correct
        // depth.
        this.iconPath = new vscode.ThemeIcon(
            ModuleName ? "library" : "folder-library",
        );
        // Show the version next to the module name, which also disambiguates a
        // module installed in more than one version.
        if (Version) {
            this.description = Version;
        }
    }

    // Builds a rich Markdown tooltip from a module's metadata.
    public static buildTooltip(
        module: IModule,
        commandCount: number,
    ): vscode.MarkdownString {
        const tooltip = new vscode.MarkdownString();
        tooltip.appendMarkdown(`**${module.name}** ${module.version}\n\n`);
        if (module.description) {
            tooltip.appendMarkdown(`${module.description}\n\n`);
        }
        tooltip.appendMarkdown(`_${commandCount} commands_\n\n`);
        if (module.author) {
            tooltip.appendMarkdown(`Author: ${module.author}\n\n`);
        }
        if (module.projectUri) {
            tooltip.appendMarkdown(`[Project](${module.projectUri})\n\n`);
        }
        if (module.path) {
            tooltip.appendMarkdown(`\`${module.path}\``);
        }
        return tooltip;
    }
}

class CommandNode extends vscode.TreeItem {
    constructor(
        public readonly Name: string,
        public readonly ModuleName: string,
        public readonly Version: string,
    ) {
        super(Name, vscode.TreeItemCollapsibleState.None);
        this.contextValue = "command";
        // A unique id (module name + version + command name) keeps VS Code from
        // conflating same-named commands from different modules or module versions,
        // whose auto-generated (label-derived) ids would otherwise collide and
        // confuse the tree's expansion state.
        this.id = `${ModuleName}\u0000${Version}\u0000${Name}`;
        this.iconPath = new vscode.ThemeIcon("symbol-method");
    }
}
