// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import * as vscode from "vscode";
import type { LanguageClient } from "vscode-languageclient/node";
import { LanguageClientConsumer } from "../languageClientConsumer";
import { PowerShellVersionRequestType } from "../session";
import { ExpandAliasRequestType } from "./ExpandAlias";
import { GetCommandRequestType } from "./GetCommands";
import { ShowHelpRequestType } from "./ShowHelp";

function toToolResult(text: string): vscode.LanguageModelToolResult {
    return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(text),
    ]);
}

interface IGetCommandInput {
    name?: string;
    module?: string;
}

// Lists commands available in the active PowerShell session (backed by the
// existing powerShell/getCommand request), scoped by name and/or module. At
// least one filter is required so we never serialize the entire command table,
// which is prohibitively expensive.
class GetCommandTool implements vscode.LanguageModelTool<IGetCommandInput> {
    public async invoke(
        options: vscode.LanguageModelToolInvocationOptions<IGetCommandInput>,
        token: vscode.CancellationToken,
    ): Promise<vscode.LanguageModelToolResult> {
        const name = options.input.name?.trim();
        const module = options.input.module?.trim();

        if (!name && !module) {
            return toToolResult(
                "Provide a 'name' and/or 'module' filter to look up PowerShell commands.",
            );
        }

        // Get-Command -Name matches literally, so wrap bare text in wildcards to
        // get intuitive "contains" matching while leaving explicit wildcards
        // (and module names) untouched.
        const namePattern = name && !/[*?[\]]/.test(name) ? `*${name}*` : name;

        const client = await LanguageClientConsumer.getLanguageClient();
        const matches = await client.sendRequest(
            GetCommandRequestType,
            {
                name: namePattern,
                module,
            },
            token,
        );

        if (matches.length === 0) {
            return toToolResult(
                "No matching PowerShell commands were found in the current session.",
            );
        }

        const limit = 50;
        const limited = matches.slice(0, limit);
        const blocks = limited.map((command) => {
            const parameters = Object.keys(command.parameters ?? {});
            return [
                `Name: ${command.name}`,
                `Module: ${command.moduleName || "(none)"}`,
                `DefaultParameterSet: ${command.defaultParameterSet ?? "(none)"}`,
                `Parameters: ${parameters.length > 0 ? parameters.join(", ") : "(none)"}`,
            ].join("\n");
        });

        let output = blocks.join("\n\n");
        if (matches.length > limit) {
            output += `\n\n(Showing ${limit} of ${matches.length} matching commands. Provide a more specific name or module filter to narrow the results.)`;
        }

        return toToolResult(output);
    }
}

interface IGetHelpInput {
    command: string;
}

// A tool that takes no input.
type EmptyInput = Record<string, never>;

// Returns the full Get-Help text for a command (backed by the powerShell/showHelp request).
class GetHelpTool implements vscode.LanguageModelTool<IGetHelpInput> {
    public async invoke(
        options: vscode.LanguageModelToolInvocationOptions<IGetHelpInput>,
        token: vscode.CancellationToken,
    ): Promise<vscode.LanguageModelToolResult> {
        const client = await LanguageClientConsumer.getLanguageClient();
        const result = await client.sendRequest(
            ShowHelpRequestType,
            {
                text: options.input.command,
            },
            token,
        );
        return toToolResult(
            result.helpText || `No help found for '${options.input.command}'.`,
        );
    }
}

// Reports the active PowerShell version/edition/architecture (backed by powerShell/getVersion).
class GetEnvironmentTool implements vscode.LanguageModelTool<EmptyInput> {
    public async invoke(
        _options: vscode.LanguageModelToolInvocationOptions<EmptyInput>,
        token: vscode.CancellationToken,
    ): Promise<vscode.LanguageModelToolResult> {
        const client = await LanguageClientConsumer.getLanguageClient();
        const version = await client.sendRequest(
            PowerShellVersionRequestType,
            token,
        );
        const output = [
            `PowerShell version: ${version.version}`,
            `Edition: ${version.edition}`,
            `Architecture: ${version.architecture}`,
            `Commit: ${version.commit}`,
        ].join("\n");
        return toToolResult(output);
    }
}

interface IExpandAliasInput {
    text: string;
}

// Expands aliases in a script to full command names (backed by powerShell/expandAlias).
class ExpandAliasTool implements vscode.LanguageModelTool<IExpandAliasInput> {
    public async invoke(
        options: vscode.LanguageModelToolInvocationOptions<IExpandAliasInput>,
        token: vscode.CancellationToken,
    ): Promise<vscode.LanguageModelToolResult> {
        const client = await LanguageClientConsumer.getLanguageClient();
        const result = await client.sendRequest(
            ExpandAliasRequestType,
            {
                text: options.input.text,
            },
            token,
        );
        return toToolResult(result.text);
    }
}

export class LanguageModelToolsFeature extends LanguageClientConsumer {
    private tools: vscode.Disposable[];

    constructor() {
        super();
        this.tools = [
            vscode.lm.registerTool(
                "powershell_get_command",
                new GetCommandTool(),
            ),
            vscode.lm.registerTool("powershell_get_help", new GetHelpTool()),
            vscode.lm.registerTool(
                "powershell_get_environment",
                new GetEnvironmentTool(),
            ),
            vscode.lm.registerTool(
                "powershell_expand_alias",
                new ExpandAliasTool(),
            ),
        ];
    }

    public override onLanguageClientSet(
        _languageClient: LanguageClient,
        // eslint-disable-next-line @typescript-eslint/no-empty-function
    ): void {}

    public dispose(): void {
        for (const tool of this.tools) {
            tool.dispose();
        }
    }
}
