// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

// NOTE: This code is borrowed under permission from:
// https://github.com/microsoft/vscode-extension-samples/tree/main/helloworld-test-sample/src/test

import * as path from "path";
import * as Mocha from "mocha";
import * as glob from "glob";

export function run(): Promise<void> {
    // Create the mocha test
    const mocha = new Mocha({
        color: !process.env.TF_BUILD, // colored output from test results
        reporter: "mocha-multi-reporters",
        timeout: 30000, // 30s because PowerShell startup is slow!
        reporterOptions: {
            // NOTE: The XML output by Mocha's xUnit reporter is actually in the
            // JUnit style. I'm unsure how no one else has noticed this.
            reporterEnabled: "spec, xunit",
            xunitReporterOptions: {
                output: path.join(__dirname, "..", "..", "test-results.xml"),
            }
        },
    });

    return new Promise((c, e) => {
        glob("**/**.test.js", { cwd: __dirname }, (err, files) => {
            if (err) {
                return e(err);
            }

            // Add files to the test suite
            for (const file of files) {
                mocha.addFile(path.resolve(__dirname, file));
            }

            try {
                // Run the mocha test
                mocha.run(failures => {
                    if (failures > 0) {
                        e(new Error(`${failures} tests failed.`));
                    } else {
                        c();
                    }
                });
            } catch (err) {
                console.error(err);
                e(err);
            }
        });
    });
}
