// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import assert from "assert";
import * as path from "path";
import rewire = require("rewire");
import vscode = require("vscode");
import utils = require("../utils");
import { checkIfFileExists } from "../../src/utils";

// Setup function that is not exported.
const customViews = rewire("../../src/features/RunCode");
const createLaunchConfig = customViews.__get__("createLaunchConfig");

enum LaunchType {
    Debug,
    Run,
}

describe("RunCode feature", function () {
    before(utils.ensureEditorServicesIsConnected);

    it("Creates the launch config", function () {
        const commandToRun = "Invoke-Build";
        const args: string[] = ["Clean"];

        const expected: object = {
            request: "launch",
            type: "PowerShell",
            name: "PowerShell: Run Code",
            internalConsoleOptions: "neverOpen",
            noDebug: false,
            createTemporaryIntegratedConsole: false,
            script: commandToRun,
            args,
        };

        const actual: object = createLaunchConfig(LaunchType.Debug, commandToRun, args);
        assert.deepStrictEqual(actual, expected);
    });

    it("Runs Pester tests from a file", async function () {
        const pesterTests = path.resolve(__dirname, "../../../examples/Tests/SampleModule.Tests.ps1");
        assert(checkIfFileExists(pesterTests));
        const pesterTestDebugStarted = utils.WaitEvent<vscode.DebugSession>(vscode.debug.onDidStartDebugSession,
            session => session.name === "PowerShell: Launch Pester Tests"
        );

        await vscode.commands.executeCommand("vscode.open", vscode.Uri.file(pesterTests));
        assert(await vscode.commands.executeCommand("PowerShell.RunPesterTestsFromFile"));
        const debugSession = await pesterTestDebugStarted;
        await vscode.debug.stopDebugging();

        assert(debugSession.type === "PowerShell");
    });
});
