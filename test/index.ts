/*---------------------------------------------------------
* Copyright (C) Microsoft Corporation. All rights reserved.
*--------------------------------------------------------*/
// tslint:disable no-var-requires
import * as path from "path";
import testRunner = require("vscode/lib/testrunner");

// See https://github.com/mochajs/mocha/wiki/Using-mocha-programmatically#set-options for options
testRunner.configure({
    ui: "tdd", 		// the TDD UI is being used in extension.test.ts (suite, test, etc.)
    useColors: true, // colored output from test results
    reporter: "mocha-multi-reporters",
    reporterOptions: {
        reporterEnabled: "spec, mocha-junit-reporter",
        mochaJunitReporterReporterOptions: {
            mochaFile: path.join(__dirname, "..", "..", "test-results.xml"),
        },
    },
});

module.exports = testRunner;
