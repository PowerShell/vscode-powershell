let testRunner = require("vscode/lib/testrunner");

// See https://github.com/mochajs/mocha/wiki/Using-mocha-programmatically#set-options for options
testRunner.configure({
    ui: "tdd", 		// the TDD UI is being used in extension.test.ts (suite, test, etc.)
    useColors: true, // colored output from test results
});

module.exports = testRunner;
