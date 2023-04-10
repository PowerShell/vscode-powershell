// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

// NOTE: This code is borrowed under permission from:
// https://github.com/microsoft/vscode-extension-samples/tree/main/helloworld-test-sample/src/test

import * as path from "path";

import { runTests } from "@vscode/test-electron";
import { existsSync } from "fs";

async function main(): Promise<void> {
    // Test for the presence of modules folder and error if not found
    const PSESPath = path.resolve(__dirname, "../../modules/PowerShellEditorServices.VSCode/bin/Microsoft.PowerShell.EditorServices.VSCode.dll");
    if (!existsSync(PSESPath)) {
        console.error("ERROR: A PowerShell Editor Services build was not found in the modules directory. Please run a build first, using either the 'Run Build Task' in VSCode or ./build.ps1 in PowerShell.");
        process.exit(1);
    }

    try {
        // The folder containing the Extension Manifest package.json
        // Passed to `--extensionDevelopmentPath`
        const extensionDevelopmentPath = path.resolve(__dirname, "../../");

        // The path to the extension test script
        // Passed to --extensionTestsPath
        const extensionTestsPath = path.resolve(__dirname, "./index");

        // Open VSCode with the examples folder, so any UI testing can run against the examples.
        // Also install the c# extension which is needed for hybrid binary module debug testing
        const launchArgs = [
            "./test"
        ];

        // Allow to wait for extension test debugging
        const port = process.argv[2];
        if (port) {launchArgs.push(`--inspect-brk-extensions=${port}`);}

        // Download VS Code, unzip it and run the integration test
        await runTests({
            extensionDevelopmentPath,
            extensionTestsPath,
            launchArgs: launchArgs,
            // This is necessary because the tests fail if more than once
            // instance of Code is running.
            version: "insiders"
        });
    } catch (err) {
        console.error(`Failed to run tests: ${err}`);
        process.exit(1);
    }
}

void main();
