// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

// NOTE: This code is borrowed under permission from:
// https://github.com/microsoft/vscode-extension-samples/tree/main/helloworld-test-sample/src/test

import * as path from "path";
import { ConsoleReporter, downloadAndUnzipVSCode, resolveCliArgsFromVSCodeExecutablePath, runTests } from "@vscode/test-electron";
import { existsSync } from "fs";
import { spawnSync } from "child_process";

async function main(): Promise<void> {
    // Test for the presence of modules folder and error if not found
    const PSESPath = path.resolve(__dirname, "../../modules/PowerShellEditorServices.VSCode/bin/Microsoft.PowerShell.EditorServices.VSCode.dll");
    if (!existsSync(PSESPath)) {
        console.error("ERROR: A PowerShell Editor Services build was not found in the modules directory. Please run a build first, using either the 'Run Build Task' in VSCode or ./build.ps1 in PowerShell.");
        process.exit(1);
    }

    try {
        /** The folder containing the Extension Manifest package.json. Passed to `--extensionDevelopmentPath */
        const extensionDevelopmentPath = path.resolve(__dirname, "../../");

        /** The path to the extension test script. Passed to --extensionTestsPath */
        const extensionTestsPath = path.resolve(__dirname, "./index");

        /** The starting workspace/folder to open in vscode. */
        const workspacePath = process.env.__TEST_WORKSPACE_PATH ?? "test/mocks";
        const workspaceToOpen = path.resolve(extensionDevelopmentPath, workspacePath);

        /** The version to test. By default we test on insiders. */
        const vsCodeVersion = process.env.__TEST_VSCODE_VERSION ?? "insiders";

        /** Install a temporary vscode. This must be done ahead of RunTests in order to install extensions ahead of time. @see https://github.com/microsoft/vscode-test/blob/addc23e100b744de598220adbbf0761da870eda9/README.md?plain=1#L71-L89 **/
        const testVSCodePath = await downloadAndUnzipVSCode(vsCodeVersion, undefined, new ConsoleReporter(true));
        InstallExtension(testVSCodePath, "ms-dotnettools.csharp");

        const launchArgs = [
            workspaceToOpen
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
            version: vsCodeVersion,
            extensionTestsEnv: {
                __TEST_EXTENSIONDEVELOPMENTPATH: extensionDevelopmentPath
            }
        });
    } catch (err) {
        console.error(`Failed to run tests: ${err}`);
        process.exit(1);
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
        console.error(installResult.stderr);
        throw new Error(`Failed to install extension: ${installResult.stderr}`);
    }
    return installResult.stdout;
}


void main();
