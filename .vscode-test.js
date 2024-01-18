// .vscode-test.js
const { defineConfig } = require("@vscode/test-cli");

module.exports = defineConfig({
    files: "out/test/**/*.test.js",
    launchArgs: ["--profile-temp"],
    workspaceFolder: "test/TestEnvironment.code-workspace",
    mocha: {
        ui: "bdd",
        timeout: 600000, //10 minutes long to allow for debugging
        slow: 2000,
    },
});
