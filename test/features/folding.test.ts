/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as assert from "assert";
import * as path from "path";
import * as vscode from "vscode";
import { DocumentSelector } from "vscode-languageclient";
import * as folding from "../../src/features/Folding";
import { MockLogger } from "../test_utils";

const fixturePath = path.join(__dirname, "..", "..", "..", "test", "fixtures");

function assertFoldingRegions(result, expected): void {
    for (let i = 0; i < expected.length; i++) {
        const failMessage = `expected ${JSON.stringify(expected[i])}, actual ${JSON.stringify(result[i])}`;
        assert.equal(result[i].start, expected[i].start, failMessage);
        assert.equal(result[i].end, expected[i].end, failMessage);
        assert.equal(result[i].kind, expected[i].kind, failMessage);
    }

    assert.equal(result.length, expected.length);
}

suite("Features", () => {

    suite("Folding Provider", async () => {
        const logger: MockLogger = new MockLogger();
        const mockSelector: DocumentSelector = [
            { language: "powershell", scheme: "file" },
        ];
        const psGrammar = await (new folding.FoldingFeature(logger, mockSelector)).loadPSGrammar(logger);
        const provider = (new folding.FoldingProvider(psGrammar));

        test("Can detect the PowerShell Grammar", () => {
            assert.notEqual(psGrammar, null);
        });

        suite("For a single document", async () => {
            const expectedFoldingRegions = [
                { start: 1,  end: 6,  kind: 1 },
                { start: 7,  end: 51, kind: 3 },
                { start: 8,  end: 13, kind: 1 },
                { start: 14, end: 17, kind: 3 },
                { start: 19, end: 22, kind: 3 },
                { start: 26, end: 28, kind: 1 },
                { start: 30, end: 40, kind: 3 },
                { start: 32, end: 36, kind: 3 },
                { start: 42, end: 44, kind: 3 },
                { start: 47, end: 50, kind: 3 },
            ];

            test("Can detect all of the foldable regions in a document with CRLF line endings", async () => {
                // Integration test against the test fixture 'folding-crlf.ps1' that contains
                // all of the different types of folding available
                const uri = vscode.Uri.file(path.join(fixturePath, "folding-crlf.ps1"));
                const document = await vscode.workspace.openTextDocument(uri);
                const result = await provider.provideFoldingRanges(document, null, null);

                // Ensure we have CRLF line endings as we're depending on git
                // to clone the test fixtures correctly
                assert.notEqual(document.getText().indexOf("\r\n"), -1);

                assertFoldingRegions(result, expectedFoldingRegions);
            });

            test("Can detect all of the foldable regions in a document with LF line endings", async () => {
                // Integration test against the test fixture 'folding-lf.ps1' that contains
                // all of the different types of folding available
                const uri = vscode.Uri.file(path.join(fixturePath, "folding-lf.ps1"));
                const document = await vscode.workspace.openTextDocument(uri);
                const result = await provider.provideFoldingRanges(document, null, null);

                // Ensure we do not CRLF line endings as we're depending on git
                // to clone the test fixtures correctly
                assert.equal(document.getText().indexOf("\r\n"), -1);

                assertFoldingRegions(result, expectedFoldingRegions);
            });
        });
    });
});
