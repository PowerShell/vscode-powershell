import { defineConfig } from "@vscode/test-cli";
import os from "os";
import path from "path";

export default defineConfig({
    files: "test/**/*.test.ts",
    // The default user data directory had too many characters for the IPC connection on macOS in CI.
    launchArgs: [
        "--profile-temp",
        "--user-data-dir",
        path.join(os.tmpdir(), "vscode-user-data"),
    ],
    workspaceFolder: "test/TestEnvironment.code-workspace",
    mocha: {
        ui: "bdd", // describe, it, etc.
        require: ["esbuild-register"], // transpile TypeScript on-the-fly
        slow: 2000, // 2 seconds for slow test
        timeout: 60 * 1000, // 10 minutes to allow for debugging
    },
});
