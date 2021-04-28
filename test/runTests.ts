// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import * as path from "path";

import { runTests } from "vscode-test";

// tslint:disable-next-line: no-var-requires
const PackageJSON: any = require("../../package.json");
const testExtensionId = `${PackageJSON.publisher}.${PackageJSON.name}`;

async function main() {
    try {
        // The folder containing the Extension Manifest package.json
        // Passed to `--extensionDevelopmentPath`
        const extensionDevelopmentPath = path.resolve(__dirname, "../../");

        // The path to the extension test runner script
        // Passed to --extensionTestsPath
        const extensionTestsPath = path.resolve(__dirname, "./testRunner");

        // Download VS Code, unzip it and run the integration test from the local directory.
        await runTests({
            extensionDevelopmentPath,
            extensionTestsPath,
            launchArgs: [
                "--disable-extensions",
                "--enable-proposed-api", testExtensionId,
                "./test"
            ],
            version: "insiders"
        });
    } catch (err) {
        // tslint:disable-next-line:no-console
        console.error(err);
        // tslint:disable-next-line:no-console
        console.error("Failed to run tests");
        process.exit(1);
    }
}

main();
