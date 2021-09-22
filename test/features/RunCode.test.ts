// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import * as assert from "assert";
import * as fs from "fs";
import * as path from "path";
import { suiteSetup } from "mocha";
import rewire = require("rewire");
import vscode = require("vscode");
import utils = require("../utils");

// Setup function that is not exported.
const customViews = rewire("../../src/features/RunCode");
const createLaunchConfig = customViews.__get__("createLaunchConfig");

enum LaunchType {
    Debug,
    Run,
}

suite("RunCode tests", () => {
    suiteSetup(utils.ensureExtensionIsActivated);

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

    test("Can run Pester tests from file", async () => {
        const pesterTests = path.resolve(__dirname, "../../../examples/Tests/SampleModule.Tests.ps1");
        assert(fs.existsSync(pesterTests));
        await vscode.commands.executeCommand("vscode.open", vscode.Uri.file(pesterTests));
        assert(await vscode.commands.executeCommand("PowerShell.RunPesterTestsFromFile"));
        // Start up can take some time...so set the timeout to 30 seconds.
    }).timeout(30000);
});
