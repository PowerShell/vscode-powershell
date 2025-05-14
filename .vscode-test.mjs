import os from "os";
import path	from "path";
import { defineConfig } from "@vscode/test-cli";

export default defineConfig({
	files: "test/**/*.test.ts",
	// The default user data directory had too many characters for the IPC connection on macOS in CI.
	launchArgs: [ "--profile-temp", "--user-data-dir", path.join(os.tmpdir(), "vscode-user-data") ],
    workspaceFolder: "test/TestEnvironment.code-workspace",
	mocha: {
		ui: "bdd", // describe, it, etc.
        require: "esbuild-register",
		timeout: 60 * 1000 // 10 minutes to allow for debugging
	},
});
