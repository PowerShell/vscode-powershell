import { defineConfig } from "@vscode/test-cli";
import { existsSync } from "fs";

export default defineConfig({
    files: "test/**/*.test.ts",
    // It may break CI but we'll know sooner rather than later
    version: "insiders",
    launchArgs: [
        // Other extensions are unnecessary while testing
        "--disable-extensions",
        // Undocumented but valid option to use a temporary profile for testing
        "--profile-temp",
    ],
    workspaceFolder: `test/${existsSync("C:\\powershell-7\\pwsh.exe") ? "OneBranch" : "TestEnvironment"}.code-workspace`,
    mocha: {
        ui: "bdd", // describe, it, etc.
        require: ["esbuild-register"], // transpile TypeScript on-the-fly
        slow: 2 * 1000, // 2 seconds for slow test
        timeout: 2 * 60 * 1000, // 2 minutes to allow for debugging
    },
});
