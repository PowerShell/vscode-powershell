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
                { start: 0,  end: 4,  kind: 3 },
                { start: 1,  end: 3,  kind: 1 },
                { start: 10, end: 15, kind: 1 },
                { start: 16, end: 60, kind: null },
                { start: 17, end: 22, kind: 1 },
                { start: 23, end: 26, kind: null },
                { start: 28, end: 31, kind: null },
                { start: 35, end: 37, kind: 1 },
                { start: 39, end: 49, kind: 3 },
                { start: 41, end: 45, kind: 3 },
                { start: 51, end: 53, kind: null },
                { start: 56, end: 59, kind: null },
                { start: 64, end: 66, kind: 1 },
                { start: 67, end: 72, kind: 3 },
                { start: 68, end: 70, kind: 1 },
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

            test("Can detect all of the foldable regions in a document with mismatched regions", async () => {
                const expectedMismatchedFoldingRegions = [
                    { start: 2,  end: 4,  kind: 3 },
                ];

                // Integration test against the test fixture 'folding-mismatch.ps1' that contains
                // comment regions with mismatched beginning and end
                const uri = vscode.Uri.file(path.join(fixturePath, "folding-mismatch.ps1"));
                const document = await vscode.workspace.openTextDocument(uri);
                const result = await provider.provideFoldingRanges(document, null, null);

                assertFoldingRegions(result, expectedMismatchedFoldingRegions);
            });

            test("Does not return duplicate or overlapping regions", async () => {
                const expectedMismatchedFoldingRegions = [
                    { start: 1,  end: 2,  kind: null },
                    { start: 2,  end: 4,  kind: null },
                ];

                // Integration test against the test fixture 'folding-mismatch.ps1' that contains
                // duplicate/overlapping ranges due to the `(` and `{` characters
                const uri = vscode.Uri.file(path.join(fixturePath, "folding-duplicate.ps1"));
                const document = await vscode.workspace.openTextDocument(uri);
                const result = await provider.provideFoldingRanges(document, null, null);

                assertFoldingRegions(result, expectedMismatchedFoldingRegions);
            });
        });
    });
});
