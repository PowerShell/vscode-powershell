/*---------------------------------------------------------
* Copyright (C) Microsoft Corporation. All rights reserved.
*--------------------------------------------------------*/
import * as assert from "assert";
import rewire = require("rewire");
import * as sinon from "sinon";
import * as vscode from "vscode";

const RewiredMain = rewire("../src/main");

suite("Main tests", () => {
    suite("Returns correct version of extension", () => {
        const expectedVersion = "2.0.0";
        const fake = sinon.fake.returns({ packageJSON: { version: expectedVersion, name: "PowerShell-Preview"} });
        sinon.replace(vscode.extensions, "getExtension", fake);
        const getCurrentVersion = RewiredMain.__get__("getCurrentVersion");

        const testCases = [
            {
                description: "Testing supplying 'storagePath'",
                data: { storagePath: "/my/path/to/ms-vscode.powershell-preview/foo" },
            },
            {
                description: "Testing supplying 'extensionPath'",
                data: { extensionPath: "/my/path/to/ms-vscode.powershell-preview/foo" },
            },
            {
                description: "Testing supplying 'nothing'",
                data: {},
            },
        ];
        for (const testCase of testCases) {
            test(testCase.description, () => {
                assert.equal(getCurrentVersion(testCase.data), expectedVersion);
            });
        }
    });
});
