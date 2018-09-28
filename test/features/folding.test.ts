/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as assert from "assert";
import * as path from "path";
import * as vscode from "vscode";
import { DocumentSelector } from "vscode-languageclient";
import * as folding from "../../src/features/Folding";
import * as Settings from "../../src/settings";
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

// Wrap the FoldingProvider class with our own custom settings for testing
class CustomSettingFoldingProvider extends folding.FoldingProvider {
    public customSettings: Settings.ISettings = Settings.load();
    // Overridde the super currentSettings method with our own custom test settings
    public currentSettings(): Settings.ISettings { return this.customSettings; }
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
                { start: 0,  end: 3,  kind: 3 },
                { start: 1,  end: 2,  kind: 1 },
                { start: 10, end: 14, kind: 1 },
                { start: 16, end: 59, kind: null },
                { start: 17, end: 21, kind: 1 },
                { start: 23, end: 25, kind: null },
                { start: 28, end: 30, kind: null },
                { start: 35, end: 36, kind: 1 },
                { start: 39, end: 48, kind: 3 },
                { start: 41, end: 44, kind: 3 },
                { start: 51, end: 52, kind: null },
                { start: 56, end: 58, kind: null },
                { start: 64, end: 65, kind: 1 },
                { start: 67, end: 71, kind: 3 },
                { start: 68, end: 69, kind: 1 },
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

            suite("Where showLastLine setting is false", async () => {
                const customprovider = (new CustomSettingFoldingProvider(psGrammar));
                customprovider.customSettings.codeFolding.showLastLine = false;

                test("Can detect all foldable regions in a document", async () => {
                    // Integration test against the test fixture 'folding-lf.ps1' that contains
                    // all of the different types of folding available
                    const uri = vscode.Uri.file(path.join(fixturePath, "folding-lf.ps1"));
                    const document = await vscode.workspace.openTextDocument(uri);
                    const result = await customprovider.provideFoldingRanges(document, null, null);

                    // Incrememnt the end line of the expected regions by one as we will
                    // be hiding the last line
                    const expectedLastLineRegions = expectedFoldingRegions.map( (item) => {
                        item.end++;
                        return item;
                    });

                    assertFoldingRegions(result, expectedLastLineRegions);
                });
            });

            test("Can detect all of the foldable regions in a document with mismatched regions", async () => {
                const expectedMismatchedFoldingRegions = [
                    { start: 2,  end: 3,  kind: 3 },
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
                    { start: 1,  end: 1,  kind: null },
                    { start: 2,  end: 3,  kind: null },
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
