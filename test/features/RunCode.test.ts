// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import * as assert from "assert";
import * as fs from "fs";
import * as path from "path";
import rewire = require("rewire");
import vscode = require("vscode");
import utils = require("../utils");
import { sleep } from "../../src/utils";

// Setup function that is not exported.
const customViews = rewire("../../src/features/RunCode");
const createLaunchConfig = customViews.__get__("createLaunchConfig");

enum LaunchType {
    Debug,
    Run,
}

describe("RunCode tests", () => {
    before(utils.ensureExtensionIsActivated);

    it("Can create the launch config", () => {
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

    it("Can run Pester tests from file", async () => {
        const pesterTests = path.resolve(__dirname, "../../../examples/Tests/SampleModule.Tests.ps1");
        assert(fs.existsSync(pesterTests));

        // Open the PowerShell file with Pester tests and then wait a while for
        // the extension to finish connecting to the server.
        await vscode.commands.executeCommand("vscode.open", vscode.Uri.file(pesterTests));
        await sleep(15000);

        // Now run the Pester tests, check the debugger started, wait a bit for
        // it to run, and then kill it for safety's sake.
        assert(await vscode.commands.executeCommand("PowerShell.RunPesterTestsFromFile"));
        assert(vscode.debug.activeDebugSession !== undefined);
        await vscode.debug.stopDebugging();
    });
});
