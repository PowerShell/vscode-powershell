/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as assert from "assert";
import rewire = require("rewire");
import vscode = require("vscode");

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

        assert.deepEqual(actual, expected);
    });
});
