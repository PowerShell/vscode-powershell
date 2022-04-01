// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import * as path from "path";
import * as vscode from "vscode";
import { ILogger } from "../src/logging";
import { IPowerShellExtensionClient } from "../src/features/ExternalApi";
import { resolveCliArgsFromVSCodeExecutablePath } from "@vscode/test-electron";
import { execSync, spawnSync } from "child_process";
import { existsSync } from "fs";

// This lets us test the rest of our path assumptions against the baseline of
// this test file existing at `<root>/out/test/utils.js`.
export const rootPath = path.resolve(__dirname, "../../");
// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-var-requires
const packageJSON: any = require(path.resolve(rootPath, "package.json"));
export const extensionId = `${packageJSON.publisher}.${packageJSON.name}`;

export class TestLogger implements ILogger {
    getLogFilePath(_baseName: string): vscode.Uri {
        return vscode.Uri.file("");
    }
    updateLogLevel(_logLevelName: string): void {
        return;
    }
    write(_message: string, ..._additionalMessages: string[]): void {
        return;
    }
    writeAndShowInformation(_message: string, ..._additionalMessages: string[]): Promise<void> {
        return Promise.resolve();
    }
    writeDiagnostic(_message: string, ..._additionalMessages: string[]): void {
        return;
    }
    writeVerbose(_message: string, ..._additionalMessages: string[]): void {
        return;
    }
    writeWarning(_message: string, ..._additionalMessages: string[]): void {
        return;
    }
    writeAndShowWarning(_message: string, ..._additionalMessages: string[]): Promise<void> {
        return Promise.resolve();
    }
    writeError(_message: string, ..._additionalMessages: string[]): void {
        return;
    }
    writeAndShowError(_message: string, ..._additionalMessages: string[]): Promise<void> {
        return Promise.resolve();
    }
    writeAndShowErrorWithActions(
        _message: string,
        _actions: { prompt: string; action: (() => Promise<void>) | undefined }[]): Promise<void> {
        return Promise.resolve();
    }
}

export const testLogger = new TestLogger();

export async function ensureExtensionIsActivated(): Promise<IPowerShellExtensionClient> {
    const extension = vscode.extensions.getExtension(extensionId);
    if (!extension!.isActive) { await extension!.activate(); }
    return extension!.exports as IPowerShellExtensionClient;
}

export async function ensureEditorServicesIsConnected(): Promise<IPowerShellExtensionClient> {
    const extension = await ensureExtensionIsActivated();
    const sessionId = extension.registerExternalExtension(extensionId);
    await extension.waitUntilStarted(sessionId);
    extension.unregisterExternalExtension(sessionId);
    return extension;
}

/**
 * This is a workaround for sinon not being able to stub interfaces. Interfaces are a TypeScript-only concept so this effectively allows us to stub interfaces by not providing the entire implementation but only what matters for the test. "What matters" is not type checked so you must be careful to stub everything you need, otherwise you should provide a default implementation instead if you do not know.
*/
export function stubInterface<T>(object?: Partial<T>): T {
    return object ? object as T : {} as T;
}

/** Installs the C# extension in "this" running vscode version for binary module debug testing */
export async function InstallCSharpExtension(): Promise<void> {
    // Install the csharp extension which is required for the dotnet debugger testing
    if (!vscode.extensions.getExtension("ms-dotnettools.csharp")) {
        //HACK: There is no way to set the initial cwd using RunTests, and resolveCliArgsFromVSCodeExecutablePath requires the cwd to be the extension root, so we set it here temporarily: https://github.com/microsoft/vscode-test/blob/addc23e100b744de598220adbbf0761da870eda9/lib/download.ts#L31
        const extensionRootPath = path.resolve(`${__dirname}/../..`);
        if (!existsSync(path.join(extensionRootPath, "package.json"))) {
            throw new Error(`Expected to find package.json at ${extensionRootPath}. Did you move utils.ts out of the test folder?`);
        }
        const cwd = process.cwd();
        process.chdir(extensionRootPath);

        //HACK: On Mac, resolveCliArgs expects the electron path but we are currently running in a special helper child process, so we need to find electron: https://github.com/microsoft/vscode-test/blob/addc23e100b744de598220adbbf0761da870eda9/lib/util.ts#L158

        console.log("==INSTALLPREREQUISITE: C# Extension==");
        const codeExePath = process.platform === "darwin" && process.execPath.endsWith("Helper (Plugin)")
            ? path.join(path.dirname(process.execPath), "../../../../MacOS", "Electron")
            : process.execPath;


        const [cli, ...args] = resolveCliArgsFromVSCodeExecutablePath(codeExePath, {
            reuseMachineInstall: false
        });

        // Restore working directory
        process.chdir(cwd);

        !existsSync(cli) && console.error(`Resolved Code.exe path not found: ${cli}`);

        // BUG: resolveCliArgs misdetects the extensions/userdata folder sometimes, we need to fix that.
        // regex that matches .vscode-test\\vscode*\\.vscode-test in an OS independent way
        const vscodeIncorrectPathRegex = /\.vscode-test[\\/]vscode.+?[\\/]\.vscode-test/;
        args[0] = args[0].replace(vscodeIncorrectPathRegex, ".vscode-test");
        args[1] = args[1].replace(vscodeIncorrectPathRegex, ".vscode-test");

        //TODO: This is the best way I could come up with to wait for the C# extension to activate, I'm sure there's a more terse way to do this.
        let cSharpActivatedResolved: (value: string) => void;
        const waitForCSharpExtensionActivation = new Promise<string>((resolve) => {
            cSharpActivatedResolved = resolve;
        });
        const testCSharpActive = async (): Promise<void> => {
            const csharpExtension = vscode.extensions.getExtension("ms-dotnettools.csharp");
            if (csharpExtension) {
                cSharpMonitorEvent.dispose();
                await csharpExtension.activate();
                console.log("C# Extension is now active");
                cSharpActivatedResolved("ACTIVATED");
            }
        };
        const cSharpMonitorEvent = vscode.extensions.onDidChange(testCSharpActive);

        // HACK: There is no API for this so we are forced to use the code CLI method. This is actually what is recommended from the resolveCliArgsFromVSCodeExecutablePath docs.
        const installExtensionArgs = [...args, "--install-extension", "ms-dotnettools.csharp"];
        console.log(`Starting Extension Install: ${cli} ${installExtensionArgs.join(" ")}`);

        const { status, stdout, stderr} = spawnSync(cli, installExtensionArgs, {
            encoding: "utf-8",
            windowsHide: true
        });
        if (status !== 0 || !stdout.match(/csharp.+was successfully installed/)) {
            throw new Error(`Failed to install C# extension: ${stdout} ${stderr}`);
        }
        console.log(stdout);

        console.log("Waiting for C# extension activation");
        // Wait for the csharp extnesion to be activated
        if (await waitForCSharpExtensionActivation !== "ACTIVATED") {
            throw new Error("Failed to activate C# extension");
        }
        console.log("==INSTALLED: C# Extension==");
    }
}

/** Builds the sample binary module code. We need to do this because the source maps have absolute paths so they are not portable between machines, and while we could do deterministic with source maps, that's way more complicated and everywhere we build has dotnet already anyways */
export function BuildBinaryModuleMock(): void {
    console.log("==BUILDING: Binary Module Mock==");
    const projectPath = path.resolve(`${__dirname}/../../test/mocks/BinaryModule/BinaryModule.csproj`); //Relative to "out/test" when testing.
    const buildResult = execSync(`dotnet publish ${projectPath}`);
    console.log(buildResult.toString());
}

/** Waits until the registered vscode event is fired and returns the trigger result of the event.
 * @param event The event to wait for
 * @param filter An optional filter to apply to the event TResult. The filter will continue to monitor the event firings until the filter returns true.
*/
export function WaitEvent<TResult>(event: vscode.Event<TResult>, filter?: (event: TResult) => boolean | undefined): Promise<TResult> {
    return new Promise<TResult>((resolve) => {
        const listener = event((result: TResult) => {
            if (!filter || filter(result)) {
                listener.dispose();
                resolve(result);
            }
        });
    });
}
