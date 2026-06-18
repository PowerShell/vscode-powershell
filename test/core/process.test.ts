// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import * as assert from "assert";
import Sinon from "sinon";
import * as vscode from "vscode";
import { PowerShellProcess } from "../../src/process";
import { stubInterface, testLogger } from "../utils";

describe("PowerShellProcess", () => {
    afterEach(() => {
        Sinon.restore();
    });

    function createProcess(): PowerShellProcess {
        return new PowerShellProcess(
            "pwsh",
            "modules",
            false,
            false,
            testLogger,
            vscode.Uri.file("C:/tmp"),
            "",
            vscode.Uri.file("C:/tmp/session.json"),
        );
    }

    // These pokes mirror the `manager as unknown as {...}` style used in
    // `session.test.ts` to exercise otherwise private startup behavior.
    function internalsOf(process: PowerShellProcess): {
        consoleTerminal: vscode.Terminal | undefined;
        onTerminalClose: (terminal: vscode.Terminal) => void;
    } {
        return process as unknown as {
            consoleTerminal: vscode.Terminal | undefined;
            onTerminalClose: (terminal: vscode.Terminal) => void;
        };
    }

    it("has no exit status before its terminal closes", () => {
        const process = createProcess();
        assert.equal(process.getExitStatus(), undefined);
    });

    it("captures and logs the exit status when its terminal closes", () => {
        const warnSpy = Sinon.spy(testLogger, "writeWarning");
        const process = createProcess();
        const exitStatus: vscode.TerminalExitStatus = {
            code: 1,
            reason: vscode.TerminalExitReason.Process,
        };
        const terminal = stubInterface<vscode.Terminal>({
            exitStatus,
            dispose: () => {
                return;
            },
        });

        // Track the terminal, then simulate VS Code firing its close event.
        const internals = internalsOf(process);
        internals.consoleTerminal = terminal;
        internals.onTerminalClose(terminal);

        assert.deepEqual(process.getExitStatus(), exitStatus);
        assert.ok(
            warnSpy.calledWithMatch("exit code: 1"),
            "should log the non-zero exit code",
        );
    });

    it("ignores close events from unrelated terminals", () => {
        const process = createProcess();
        const internals = internalsOf(process);
        internals.consoleTerminal = stubInterface<vscode.Terminal>({
            dispose: () => {
                return;
            },
        });

        const otherTerminal = stubInterface<vscode.Terminal>({
            exitStatus: {
                code: 1,
                reason: vscode.TerminalExitReason.Process,
            },
        });
        internals.onTerminalClose(otherTerminal);

        assert.equal(process.getExitStatus(), undefined);
    });
});
