// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import * as assert from "assert";
import * as vscode from "vscode";
import {
    FoldingReferenceKind,
    type IFoldingReference,
    PowerShellFoldingProvider,
    getFoldingReferences,
} from "../../src/features/Folding";

const C = FoldingReferenceKind.Comment;
const R = FoldingReferenceKind.Region;
const N = undefined;

function ref(
    startLine: number,
    startCharacter: number,
    endLine: number,
    endCharacter: number,
    kind?: FoldingReferenceKind,
): IFoldingReference {
    return { startLine, startCharacter, endLine, endCharacter, kind };
}

function sortReferences(references: IFoldingReference[]): IFoldingReference[] {
    return [...references].sort(
        (a, b) =>
            a.startLine - b.startLine ||
            b.endLine - a.endLine ||
            a.startCharacter - b.startCharacter ||
            a.endCharacter - b.endCharacter,
    );
}

// This PowerShell script exercises all of the folding regions and regions which
// should not be detected. It mirrors the `allInOneScript` used by the
// PowerShell Editor Services token operation tests so that the client-side
// fallback produces identical results. It is built from an array of lines to
// avoid template literal interpolation of `${this ... }`.
const allInOneScript = [
    "#Region This should fold",
    "<#",
    "Nested different comment types.  This should fold",
    "#>",
    "#EndRegion",
    "",
    "# region This should not fold due to whitespace",
    "$shouldFold = $false",
    "#    endRegion",
    "function short-func-not-fold {};",
    "<#",
    ".SYNOPSIS",
    "  This whole comment block should fold, not just the SYNOPSIS",
    ".EXAMPLE",
    "  This whole comment block should fold, not just the EXAMPLE",
    "#>",
    "function New-VSCodeShouldFold {",
    "<#",
    ".SYNOPSIS",
    "  This whole comment block should fold, not just the SYNOPSIS",
    ".EXAMPLE",
    "  This whole comment block should fold, not just the EXAMPLE",
    "#>",
    "  $I = @'",
    "herestrings should fold",
    "",
    "'@",
    "",
    "# This won't confuse things",
    "Get-Command -Param @I",
    "",
    '$I = @"',
    "double quoted herestrings should also fold",
    "",
    '"@',
    "",
    "  # this won't be folded",
    "",
    "  # This block of comments should be foldable as a single block",
    "  # This block of comments should be foldable as a single block",
    "  # This block of comments should be foldable as a single block",
    "",
    "  #region This fools the indentation folding.",
    '  Write-Host "Hello"',
    "    #region Nested regions should be foldable",
    '    Write-Host "Hello"',
    "    # comment1",
    '    Write-Host "Hello"',
    "    #endregion",
    '    Write-Host "Hello"',
    "    # comment2",
    '    Write-Host "Hello"',
    "    #endregion",
    "",
    "  $c = {",
    '    Write-Host "Script blocks should be foldable"',
    "  }",
    "",
    "  # Array fools indentation folding",
    "  $d = @(",
    "  'should fold1',",
    "  'should fold2'",
    "  )",
    "}",
    "",
    "# Make sure contiguous comment blocks can be folded properly",
    "",
    "# Comment Block 1",
    "# Comment Block 1",
    "# Comment Block 1",
    "#region Comment Block 3",
    "# Comment Block 2",
    "# Comment Block 2",
    "# Comment Block 2",
    "$something = $true",
    "#endregion Comment Block 3",
    "",
    "# What about anonymous variable assignment",
    "${this",
    "is",
    "valid} = 5",
    "",
    "#RegIon This should fold due to casing",
    "$foo = 'bar'",
    "#EnDReGion",
    "",
].join("\n");

const expectedAllInOneFolds = [
    ref(0, 0, 4, 10, R),
    ref(1, 0, 3, 2, C),
    ref(10, 0, 15, 2, C),
    ref(16, 30, 63, 1, N),
    ref(17, 0, 22, 2, C),
    ref(23, 7, 26, 2, N),
    ref(31, 5, 34, 2, N),
    ref(38, 2, 40, 0, C),
    ref(42, 2, 52, 14, R),
    ref(44, 4, 48, 14, R),
    ref(54, 7, 56, 3, N),
    ref(59, 7, 62, 3, N),
    ref(67, 0, 69, 0, C),
    ref(70, 0, 75, 26, R),
    ref(71, 0, 73, 0, C),
    ref(78, 0, 80, 6, N),
];

describe("Folding feature", function () {
    describe("getFoldingReferences", function () {
        it("finds all foldable regions with LF line endings", function () {
            const text = allInOneScript.replace(/\r/g, "");
            assert.deepStrictEqual(
                getFoldingReferences(text),
                sortReferences(expectedAllInOneFolds),
            );
        });

        it("finds all foldable regions with CRLF line endings", function () {
            const text = allInOneScript.replace(/\n/g, "\r\n");
            assert.deepStrictEqual(
                getFoldingReferences(text),
                sortReferences(expectedAllInOneFolds),
            );
        });

        it("ignores mismatched regions", function () {
            const text = [
                "#endregion should not fold - mismatched",
                "",
                "#region This should fold",
                "$something = 'foldable'",
                "#endregion",
                "",
                "#region should not fold - mismatched",
                "",
            ].join("\n");
            assert.deepStrictEqual(getFoldingReferences(text), [
                ref(2, 0, 4, 10, R),
            ]);
        });

        it("handles overlapping parentheses and braces", function () {
            const text = [
                "$AnArray = @(Get-ChildItem -Path C:\\ -Include *.ps1 -File).Where({",
                "    $_.FullName -ne 'foo'}).ForEach({",
                "        # Do Something",
                "})",
                "",
            ].join("\n");
            assert.deepStrictEqual(getFoldingReferences(text), [
                ref(1, 64, 2, 27, N),
                ref(2, 35, 4, 2, N),
            ]);
        });

        it("handles the same end token for braces and parentheses", function () {
            const text = [
                "foreach ($1 in $2) {",
                "",
                "    $x = @{",
                "        'abc' = 'def'",
                "    }",
                "}",
                "",
                "$y = $(",
                "    $arr = @('1', '2'); Write-Host ($arr)",
                ")",
                "",
            ].join("\n");
            assert.deepStrictEqual(getFoldingReferences(text), [
                ref(0, 19, 5, 1, N),
                ref(2, 9, 4, 5, N),
                ref(7, 5, 9, 1, N),
            ]);
        });

        it("folds PowerShell classes", function () {
            const text = [
                "class TestClass {",
                "    [string[]] $TestProperty = @(",
                "        'first',",
                "        'second',",
                "        'third')",
                "",
                "    [string] TestMethod() {",
                "        return $this.TestProperty[0]",
                "    }",
                "}",
                "",
            ].join("\n");
            assert.deepStrictEqual(getFoldingReferences(text), [
                ref(0, 16, 9, 1, N),
                ref(1, 31, 4, 16, N),
                ref(6, 26, 8, 5, N),
            ]);
        });

        it("folds DSC style keywords and param blocks", function () {
            const text = [
                "Configuration Example",
                "{",
                "    param",
                "    (",
                "        [Parameter()]",
                "        [System.String[]]",
                "        $NodeName = 'localhost',",
                "",
                "        [Parameter(Mandatory = $true)]",
                "        [ValidateNotNullOrEmpty()]",
                "        [System.Management.Automation.PSCredential]",
                "        $Credential",
                "    )",
                "",
                "    Import-DscResource -Module ActiveDirectoryCSDsc",
                "",
                "    Node $AllNodes.NodeName",
                "    {",
                "        WindowsFeature ADCS-Cert-Authority",
                "        {",
                "            Ensure = 'Present'",
                "            Name   = 'ADCS-Cert-Authority'",
                "        }",
                "",
                "        AdcsCertificationAuthority CertificateAuthority",
                "        {",
                "            IsSingleInstance = 'Yes'",
                "            Ensure           = 'Present'",
                "            Credential       = $Credential",
                "            CAType           = 'EnterpriseRootCA'",
                "            DependsOn        = '[WindowsFeature]ADCS-Cert-Authority'",
                "        }",
                "    }",
                "}",
                "",
            ].join("\n");
            assert.deepStrictEqual(getFoldingReferences(text), [
                ref(1, 0, 33, 1, N),
                ref(3, 4, 12, 5, N),
                ref(17, 4, 32, 5, N),
                ref(19, 8, 22, 9, N),
                ref(25, 8, 31, 9, N),
            ]);
        });
    });

    describe("PowerShellFoldingProvider", function () {
        const provider = new PowerShellFoldingProvider();

        async function getRanges(
            content: string,
        ): Promise<vscode.FoldingRange[]> {
            const document = await vscode.workspace.openTextDocument({
                language: "powershell",
                content,
            });
            return provider.provideFoldingRanges(
                document,
                {},
                new vscode.CancellationTokenSource().token,
            );
        }

        it("provides folding ranges with the correct kinds", async function () {
            const ranges = await getRanges(
                ["#region demo", "$x = 1", "#endregion", ""].join("\n"),
            );
            assert.strictEqual(ranges.length, 1);
            assert.strictEqual(ranges[0].start, 0);
            assert.strictEqual(ranges[0].kind, vscode.FoldingRangeKind.Region);
        });

        it("respects the showLastLine setting", async function () {
            const configuration = vscode.workspace.getConfiguration(
                "powershell.codeFolding",
            );
            const original = configuration.get<boolean>("showLastLine");
            const content = ["$c = {", '    "body"', "}", ""].join("\n");

            try {
                await configuration.update(
                    "showLastLine",
                    true,
                    vscode.ConfigurationTarget.Global,
                );
                const withLastLine = await getRanges(content);
                assert.strictEqual(withLastLine[0].end, 1);

                await configuration.update(
                    "showLastLine",
                    false,
                    vscode.ConfigurationTarget.Global,
                );
                const withoutLastLine = await getRanges(content);
                assert.strictEqual(withoutLastLine[0].end, 2);
            } finally {
                await configuration.update(
                    "showLastLine",
                    original,
                    vscode.ConfigurationTarget.Global,
                );
            }
        });

        it("returns no ranges when folding is disabled", async function () {
            const configuration = vscode.workspace.getConfiguration(
                "powershell.codeFolding",
            );
            const original = configuration.get<boolean>("enable");

            try {
                await configuration.update(
                    "enable",
                    false,
                    vscode.ConfigurationTarget.Global,
                );
                const ranges = await getRanges(
                    ["$c = {", '    "body"', "}", ""].join("\n"),
                );
                assert.strictEqual(ranges.length, 0);
            } finally {
                await configuration.update(
                    "enable",
                    original,
                    vscode.ConfigurationTarget.Global,
                );
            }
        });
    });
});
