// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import * as assert from "assert";
import * as vscode from "vscode";
import utils = require("../utils");

function getToolResultText(result: vscode.LanguageModelToolResult): string {
    return result.content
        .filter(
            (part): part is vscode.LanguageModelTextPart =>
                part instanceof vscode.LanguageModelTextPart,
        )
        .map((part) => part.value)
        .join("");
}

async function invokeTool(name: string, input: object): Promise<string> {
    const result = await vscode.lm.invokeTool(name, {
        input,
        toolInvocationToken: undefined,
    });
    return getToolResultText(result);
}

describe("Language model tools feature", function () {
    before(async function () {
        await utils.ensureEditorServicesIsConnected();
    });

    const expectedTools = [
        "powershell_get_command",
        "powershell_get_help",
        "powershell_get_environment",
        "powershell_expand_alias",
    ];

    for (const name of expectedTools) {
        it(`Registers the ${name} tool`, function () {
            assert.ok(
                vscode.lm.tools.some((tool) => tool.name === name),
                `Expected tool '${name}' to be registered.`,
            );
        });
    }

    it("Gets the PowerShell environment", async function () {
        const text = await invokeTool("powershell_get_environment", {});
        assert.match(text, /PowerShell version:/);
        assert.match(text, /Edition:/);
    });

    it("Finds a command by name", async function () {
        const text = await invokeTool("powershell_get_command", {
            name: "Get-Command",
        });
        assert.match(text, /Get-Command/);
    });

    it("Finds commands by module", async function () {
        const text = await invokeTool("powershell_get_command", {
            module: "Microsoft.PowerShell.Management",
        });
        assert.match(text, /Microsoft\.PowerShell\.Management/);
    });

    it("Requires a filter for get_command", async function () {
        const text = await invokeTool("powershell_get_command", {});
        assert.match(text, /Provide a 'name' and\/or 'module' filter/);
    });

    it("Gets help for a command", async function () {
        const text = await invokeTool("powershell_get_help", {
            command: "Get-Command",
        });
        assert.ok(text.length > 0, "Expected non-empty help text.");
        assert.match(text, /Get-Command/);
    });

    it("Expands an alias", async function () {
        const text = await invokeTool("powershell_expand_alias", {
            text: "gci",
        });
        assert.match(text, /Get-ChildItem/);
    });
});
