import * as assert from "assert";
import * as path from "path";
import * as vscode from "vscode";
import { DocumentSelector } from "vscode-languageclient";
import * as folding from "../../src/features/Folding";
import { MockLogger } from "../test_utils";

const fixturePath = path.join(__dirname, "..", "..", "..", "test", "fixtures");

function assertFoldingRegions(result, expected): void {
    assert.equal(result.length, expected.length);

    for (let i = 0; i < expected.length; i++) {
        const failMessage = `expected ${JSON.stringify(expected[i])}, actual ${JSON.stringify(result[i])}`;
        assert.equal(result[i].start, expected[i].start, failMessage);
        assert.equal(result[i].end, expected[i].end, failMessage);
        assert.equal(result[i].kind, expected[i].kind, failMessage);
    }
}

suite("Features", () => {

    suite("Folding Provider", () => {
        const logger: MockLogger = new MockLogger();
        const mockSelector: DocumentSelector = [
            { language: "powershell", scheme: "file" },
        ];
        const psGrammar = (new folding.FoldingFeature(logger, mockSelector)).grammar(logger);
        const provider = (new folding.FoldingProvider(psGrammar));

        test("Can detect the PowerShell Grammar", () => {
            assert.notEqual(psGrammar, null);
        });

        test("Can detect all of the foldable regions in a document", async () => {
            // Integration test against the test fixture 'folding.ps1' that contains
            // all of the different types of folding available
            const uri = vscode.Uri.file(path.join(fixturePath, "folding.ps1"));
            const document = await vscode.workspace.openTextDocument(uri);
            const result = await provider.provideFoldingRanges(document, null, null);

            const expected = [
                { start: 1,  end: 6,  kind: 1 },
                { start: 7,  end: 46, kind: 3 },
                { start: 8,  end: 13, kind: 1 },
                { start: 14, end: 17, kind: 3 },
                { start: 21, end: 23, kind: 1 },
                { start: 25, end: 35, kind: 3 },
                { start: 27, end: 31, kind: 3 },
                { start: 37, end: 39, kind: 3 },
                { start: 42, end: 45, kind: 3 },
            ];

            assertFoldingRegions(result, expected);
        });
    });
});
