import { defineConfig } from "@vscode/test-cli";
import { existsSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

export default defineConfig({
    files: "test/**/*.test.ts",
    // It may break CI but we'll know sooner rather than later
    version: "insiders",
    launchArgs: [
        // Other extensions are unnecessary while testing
        "--disable-extensions",
        // Undocumented but valid option to use a temporary profile for testing
        "--profile-temp",
        // Keep the user-data-dir short. The default lives under .vscode-test/
        // which, combined with the nested checkout paths CI uses, can push the
        // main IPC socket path over the macOS 103-char AF_UNIX limit and fail
        // with EINVAL. See microsoft/vscode#196543.
        `--user-data-dir=${join(tmpdir(), "vscp")}`,
    ],
    workspaceFolder: `test/${existsSync("C:\\powershell-7\\pwsh.exe") ? "OneBranch" : "TestEnvironment"}.code-workspace`,
    mocha: {
        ui: "bdd", // describe, it, etc.
        require: ["esbuild-register"], // transpile TypeScript on-the-fly
        slow: 2 * 1000, // 2 seconds for slow test
        timeout: 2 * 60 * 1000, // 2 minutes to allow for debugging
    },
});
