/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as assert from "assert";
import * as path from "path";
import * as vscode from "vscode";
import { PowerShellNotebooksFeature } from "../../src/features/PowerShellNotebooks";
import { before } from "mocha";
import os = require("os");
import { readFileSync } from "fs";

const notebookDir = [
    __dirname,
    "..",
    "..",
    "..",
    "test",
    "features",
    "testNotebookFiles"
];

const notebookOnlyCode = vscode.Uri.file(
    path.join(...notebookDir, "onlyCode.ps1"));
const notebookOnlyMarkdown = vscode.Uri.file(
    path.join(...notebookDir,"onlyMarkdown.ps1"));
const notebookSimpleBlockComments = vscode.Uri.file(
    path.join(...notebookDir,"simpleBlockComments.ps1"));
const notebookSimpleLineComments = vscode.Uri.file(
    path.join(...notebookDir,"simpleLineComments.ps1"));
const notebookSimpleMixedComments = vscode.Uri.file(
    path.join(...notebookDir,"simpleMixedComments.ps1"));

const notebookTestData = new Map<vscode.Uri, vscode.NotebookCellData[]>();

suite("PowerShellNotebooks tests", () => {
    notebookTestData.set(notebookOnlyCode, [
        {
            cellKind: vscode.CellKind.Code,
            language: "powershell",
            source: readBackingFile(notebookOnlyCode),
            outputs: [],
            metadata: {}
        }
    ]);

    notebookTestData.set(notebookOnlyMarkdown, [
        {
            cellKind: vscode.CellKind.Markdown,
            language: "markdown",
            source: readBackingFile(notebookOnlyMarkdown),
            outputs: [],
            metadata: {}
        }
    ]);

    let content = readBackingFile(notebookSimpleBlockComments).split(os.EOL);
    notebookTestData.set(notebookSimpleBlockComments, [
        {
            cellKind: vscode.CellKind.Markdown,
            language: "markdown",
            source: content.slice(0, 5).join(os.EOL),
            outputs: [],
            metadata: {}
        },
        {
            cellKind: vscode.CellKind.Code,
            language: "powershell",
            source: content.slice(5, 6).join(os.EOL),
            outputs: [],
            metadata: {}
        },
        {
            cellKind: vscode.CellKind.Markdown,
            language: "markdown",
            source: content.slice(6, 11).join(os.EOL),
            outputs: [],
            metadata: {}
        },
    ]);

    content = readBackingFile(notebookSimpleLineComments).split(os.EOL);
    notebookTestData.set(notebookSimpleLineComments, [
        {
            cellKind: vscode.CellKind.Markdown,
            language: "markdown",
            source: content.slice(0, 3).join(os.EOL),
            outputs: [],
            metadata: {}
        },
        {
            cellKind: vscode.CellKind.Code,
            language: "powershell",
            source: content.slice(3, 4).join(os.EOL),
            outputs: [],
            metadata: {}
        },
        {
            cellKind: vscode.CellKind.Markdown,
            language: "markdown",
            source: content.slice(4, 7).join(os.EOL),
            outputs: [],
            metadata: {}
        },
    ]);

    content = readBackingFile(notebookSimpleMixedComments).split(os.EOL);
    notebookTestData.set(notebookSimpleMixedComments, [
        {
            cellKind: vscode.CellKind.Markdown,
            language: "markdown",
            source: content.slice(0, 3).join(os.EOL),
            outputs: [],
            metadata: {}
        },
        {
            cellKind: vscode.CellKind.Code,
            language: "powershell",
            source: content.slice(3, 4).join(os.EOL),
            outputs: [],
            metadata: {}
        },
        {
            cellKind: vscode.CellKind.Markdown,
            language: "markdown",
            source: content.slice(4, 9).join(os.EOL),
            outputs: [],
            metadata: {}
        },
    ]);

    const feature = new PowerShellNotebooksFeature();

    for (const [uri, cells] of notebookTestData) {
        test(`Can open a notebook with expected cells - ${uri.fsPath}`, async () => {
            const notebookData = await feature.openNotebook(uri, {});
            assert.deepStrictEqual(notebookData.cells.length, cells.length);
        });
    }
});

function readBackingFile(uri: vscode.Uri): string {
    return readFileSync(uri.fsPath).toString();
}
