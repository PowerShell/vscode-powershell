// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import * as assert from "assert";
import * as fs from "fs";
import * as path from "path";
import rewire = require("rewire");
import vscode = require("vscode");
import utils = require("../utils");
import { sleep } from "../../src/utils";
import { IPowerShellExtensionClient } from "../../src/features/ExternalApi";

// Setup function that is not exported.
const customViews = rewire("../../src/features/RunCode");
const createLaunchConfig = customViews.__get__("createLaunchConfig");

enum LaunchType {
    Debug,
    Run,
}

suite("RunCode tests", () => {
    test("Can create the launch config", () => {
        const commandToRun: string = "Invoke-Build";
        const args: string[] = ["Clean"];

        const expected: object = {
            request: "launch",
            type: "PowerShell",
            name: "PowerShell Run Code",
            script: commandToRun,
            args,
            internalConsoleOptions: "neverOpen",
            noDebug: false,
            createTemporaryIntegratedConsole: false,
            cwd: vscode.workspace.rootPath,
        };

        const actual: object = createLaunchConfig(LaunchType.Debug, commandToRun, args);

        assert.deepStrictEqual(actual, expected);
    });

    test("Can run Pester tests from file", async function() {
        // PowerShell can take a while and is flaky, so try three times and set
        // the timeout to thirty seconds each.
        this.retries(3);
        this.timeout(30000);

        const pesterTests = path.resolve(__dirname, "../../../examples/Tests/SampleModule.Tests.ps1");
        assert(fs.existsSync(pesterTests));

        // Get interface to extension.
        const extension = await utils.ensureExtensionIsActivated();
        const client = extension!.exports as IPowerShellExtensionClient;
        const sessionId = client.registerExternalExtension(utils.extensionId);

        // Force PowerShell extension to finish connecting. This is necessary
        // because we can't start the PowerShell debugger until the session is
        // connected, which is different from the extension being activated. We
        // also need to open the file so the command has it as its argument.
        await vscode.commands.executeCommand("vscode.open", vscode.Uri.file(pesterTests));
        await client.getPowerShellVersionDetails(sessionId);
        client.unregisterExternalExtension(sessionId);

        // Now run the Pester tests, check the debugger started, wait a bit for
        // it to run, and then kill it for safety's sake.
        assert(await vscode.commands.executeCommand("PowerShell.RunPesterTestsFromFile"));
        assert(vscode.debug.activeDebugSession !== undefined);
        await sleep(5000);
        await vscode.debug.stopDebugging();
    });
});
