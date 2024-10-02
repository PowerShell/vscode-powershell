// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

// NOTE: This code is borrowed under permission from:
// https://github.com/microsoft/vscode-extension-samples/tree/main/helloworld-test-sample/src/test

import * as path from "path";
import { makeConsoleReporter, downloadAndUnzipVSCode, resolveCliArgsFromVSCodeExecutablePath, runTests } from "@vscode/test-electron";
import { existsSync } from "fs";
import { spawnSync } from "child_process";

/** This is the main test entrypoint that:
 * - Prepares the test environment by downloading a testing instance of vscode and any additional extensions
 * - Starts the test environment with runTestsInner injected into the extensionsTestsPath which will in turn start the Mocha test runner inside the environment.
 *
 * Tools like npm run test and vscode tasks should point to this script to begin the testing process. It is assumed you have built the extension prior to this step, it will error if it does not find the built extension or related test scaffolding.
 * */
async function main(): Promise<void> {
    // Verify that the extension is built
    const compiledExtensionPath = path.resolve(__dirname, "../src/extension.js");
    if (!existsSync(compiledExtensionPath)) {
        console.error("ERROR: The extension is not built yet. Please run a build first, using either the 'Run Build Task' in VSCode or ./build.ps1 in PowerShell.");
        process.exit(1);
    }

    try {
        /** The folder containing the Extension Manifest package.json. Passed to `--extensionDevelopmentPath */
        const extensionDevelopmentPath = path.resolve(__dirname, "../");

        /** The path to the test script that will run inside the vscode instance. Passed to --extensionTestsPath */
        const extensionTestsPath = path.resolve(__dirname, "./runTestsInner");

        /** The starting workspace/folder to open in vscode. By default this is a testing instance pointed to the Examples folder */
        const workspacePath = process.env.__TEST_WORKSPACE_PATH ?? "test/TestEnvironment.code-workspace";
        const workspaceToOpen = path.resolve(extensionDevelopmentPath, workspacePath);

        /** The version to test. By default we test on insiders. */
        const vsCodeVersion = process.env.__TEST_VSCODE_VERSION ?? "insiders";

        /** Install a temporary vscode. This must be done ahead of RunTests in order to install extensions ahead of time. @see https://github.com/microsoft/vscode-test/blob/addc23e100b744de598220adbbf0761da870eda9/README.md?plain=1#L71-L89 **/
        const testVSCodePath = await downloadAndUnzipVSCode(vsCodeVersion, undefined, await makeConsoleReporter());
        InstallExtension(testVSCodePath, "ms-dotnettools.csharp");

        const launchArgs = [
            workspaceToOpen
        ];

        /** This is fed to runTestsInner so it knows the extension context to find config files */
        const extensionTestsEnv: Record<string, string | undefined> = {
            __TEST_EXTENSION_DEVELOPMENT_PATH: extensionDevelopmentPath
        };

        // This info is provided by the Mocha test explorer so it can communicate with the mocha running inside the vscode test instance.
        // Adapted from: https://github.com/hbenl/mocha-explorer-launcher-scripts/blob/bd3ace403e729de1be31f46afddccc477f82a178/vscode-test/index.ts#L33-L37
        if (process.argv[2]) {
            const mochaIPCInfo = JSON.parse(process.argv[2]);
            extensionTestsEnv.MOCHA_WORKER_IPC_ROLE = mochaIPCInfo.role;
            extensionTestsEnv.MOCHA_WORKER_IPC_HOST = mochaIPCInfo.host;
            extensionTestsEnv.MOCHA_WORKER_IPC_PORT = String(mochaIPCInfo.port);
        }

        /** This env var should be passed by launch configurations for debugging the extension tests. If specified, we should wait for it to connect because it means something explicitly asked for debugging **/
        const debugPort = process.env.__TEST_DEBUG_INSPECT_PORT;
        console.log("DebugPort", debugPort);
        if (debugPort !== undefined) {
            console.log(`__TEST_DEBUG_INSPECT_PORT is set to ${debugPort}`);
            launchArgs.push(`--inspect-brk-extensions=${debugPort}`);
        } else {
            // Make debugger optionally available. Mocha Test adapter will use this when debugging because it provides no indicator when it is debugging vs. just running
            // FIXME: Because the mocha test explorer often doesn't attach until after the tests start and it provides no indicator of debug vs run, it may be flaky for debug until https://github.com/hbenl/vscode-mocha-test-adapter/pull/240 is merged. To workaround, start debugging sessions using "Test Extensions" launch config. We could use a timeout here but it would slow down everything including normal runs.
            launchArgs.push("--inspect-extensions=59229");
        }

        // Download VS Code, unzip it and run the integration test
        await runTests({
            extensionDevelopmentPath,
            extensionTestsPath,
            launchArgs: launchArgs,
            // This is necessary because the tests fail if more than once
            // instance of Code is running.
            version: vsCodeVersion,
            extensionTestsEnv: extensionTestsEnv
        });
    } catch (err) {
        console.error(`RunTests failed to run tests: ${err}`);
        process.exit(1);
    } finally {
        // Clean this up because runTests sets it on the current process, not the child one.
        process.env.__TEST_DEBUG_INSPECT_PORT = undefined;
    }
}

/** Installs an extension into an existing vscode instance. Returns the output result */
function InstallExtension(vscodeExePath: string, extensionIdOrVSIXPath: string): string {
    // Install the csharp extension which is required for the dotnet debugger testing
    const [cli, ...args] = resolveCliArgsFromVSCodeExecutablePath(vscodeExePath);

    args.push("--install-extension", extensionIdOrVSIXPath);

    // Install the extension. There is no API for this, we must use the executable. This is the recommended sample in the vscode-test repo.
    console.log(`Installing extension: ${cli} ${args.join(" ")}`);
    const installResult = spawnSync(cli, args, {
        encoding: "utf8",
        stdio: "inherit"
    });

    if (installResult.status !== 0) {
        console.error(`Failed to install extension: ${installResult.stderr}`);
        console.log("Binary Module Tests will fail if not skipped!");
    }

    return installResult.stdout;
}

void main();
