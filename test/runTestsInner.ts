// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { globSync } from "glob";
import path from "path";
import Mocha from "mocha";
/** This is the entrypoint into the standalone vscode instance that should be passed to the --extensionsTestPath parameter of the test VSCode instance. */
export function run(testsRoot: string): Promise<void> {
    return runTestsInner(testsRoot);
}

/** Runs inside of the test vscode instance, and should set up and activate the test runner */
function runTestsInner(testsRoot: string): Promise<void> {
    // Allow tools like Mocha Test Explorer to inject their own Mocha worker
    if (process.env.MOCHA_WORKER_PATH) {
        return require(process.env.MOCHA_WORKER_PATH);
    }

    console.log(`\n\n=====\nTest Runner START\n${testsRoot}\n=====`);

    /** Passed from RunTests */
    const rootDir = process.env.__TEST_EXTENSION_DEVELOPMENT_PATH;
    if (!rootDir) {
        throw new Error("Missing environment variable __TEST_EXTENSIONDEVELOPMENTPATH, this is probably a bug in runTests.ts");
    }

    interface MochaOptionsWithFiles extends Mocha.MochaOptions {
        spec?: string;
    }

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const config: MochaOptionsWithFiles = require(path.resolve(rootDir, ".mocharc.json"));
    if (config.spec === undefined) {
        throw new Error("spec must be specified in the config options when running vscode launch tests");
    }

    const mocha = new Mocha(config);

    // Test if files is empty
    const files = globSync(config.spec, { cwd: rootDir });
    if (files.length === 0) {
        console.log("No tests found for glob pattern: test.ts in directory: " + rootDir);
        throw new Error("No tests found for glob pattern: test.ts in directory: " + rootDir);
    }

    // Add files to the test suite
    for (const file of files) {
        const testFile = path.resolve(rootDir, file);
        mocha.addFile(testFile);
    }

    mocha.reporter("mocha-multi-reporters", {
        reporterEnabled: "spec, xunit",
        xunitReporterOptions: {
            output: path.resolve(rootDir, "test-results.xml"),
        }
    });

    return new Promise((resolve) => {
        mocha.run(failures => {
            console.log(`Mocha Run Finished with ${failures} failures.`);
            if (failures > 0) {
                throw new Error(`${failures} tests failed.`);
            } else {
                console.log("\n\n=====\nTest Runner STOP\n=====");
                resolve();
                return;
            }
        });
    });
}
