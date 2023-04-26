// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import * as assert from "assert";
import path = require("path");
import rewire = require("rewire");
import vscode = require("vscode");

// Setup types that are not exported.
const customViews = rewire("../../src/features/CustomViews");
const htmlContentViewClass = customViews.__get__("HtmlContentView");
const HtmlContentView: typeof htmlContentViewClass = htmlContentViewClass;

// interfaces for tests
interface ITestFile {
    fileName: string;
    content: string;
}

interface IHtmlContentViewTestCase {
    name: string;
    htmlContent: string;
    javaScriptFiles: ITestFile[];
    cssFiles: ITestFile[];
    expectedHtmlString: string;
}

function convertToVSCodeResourceScheme(filePath: string): string {
    return vscode.Uri.file(filePath).toString().replace("file://", "vscode-resource://");
}

describe("CustomViews feature", function () {
    const testCases: IHtmlContentViewTestCase[] = [
        {
            name: "with no JavaScript or CSS",
            htmlContent: "hello",
            javaScriptFiles: [],
            cssFiles: [],
            expectedHtmlString: `<html><head></head><body>
hello
</body></html>`,
        },

        // A test that adds a js file.
        {
            name: "with a JavaScript file but no CSS",
            htmlContent: "hello",
            javaScriptFiles: [
                {
                    fileName: "testCustomViews.js",
                    content: "console.log('asdf');",
                },
            ],
            cssFiles: [],
            expectedHtmlString: `<html><head></head><body>
hello
<script src="${convertToVSCodeResourceScheme(path.join(__dirname, "testCustomViews.js"))}"></script>
</body></html>`,
        },

        // A test that adds a js file in the current directory, and the parent directory.
        {
            name: "with two JavaScript files in different locations, but no CSS",
            htmlContent: "hello",
            javaScriptFiles: [
                {
                    fileName: "testCustomViews.js",
                    content: "console.log('asdf');",
                },
                {
                    fileName: "../testCustomViews.js",
                    content: "console.log('asdf');",
                },
            ],
            cssFiles: [],
            expectedHtmlString: `<html><head></head><body>
hello
<script src="${convertToVSCodeResourceScheme(path.join(__dirname, "testCustomViews.js"))}"></script>
<script src="${convertToVSCodeResourceScheme(path.join(__dirname, "../testCustomViews.js"))}"></script>
</body></html>`,
        },

        // A test that adds a js file and a css file.
        {
            name: "with a JavaScript and a CSS file",
            htmlContent: "hello",
            javaScriptFiles: [
                {
                    fileName: "testCustomViews.js",
                    content: "console.log('asdf');",
                },
            ],
            cssFiles: [
                {
                    fileName: "testCustomViews.css",
                    content: "body: { background-color: green; }",
                },
            ],
            expectedHtmlString: `<html><head><link rel="stylesheet" href="${convertToVSCodeResourceScheme(path.join(__dirname, "testCustomViews.css"))}">
</head><body>
hello
<script src="${convertToVSCodeResourceScheme(path.join(__dirname, "testCustomViews.js"))}"></script>
</body></html>`,
        },
    ];

    for (const testCase of testCases) {
        it(`Correctly creates an HtmlContentView ${testCase.name}`, async function () {
            const htmlContentView = new HtmlContentView();

            const jsPaths = await Promise.all(testCase.javaScriptFiles.map(async (jsFile) => {
                const jsPath: vscode.Uri = vscode.Uri.file(path.join(__dirname, jsFile.fileName));
                await vscode.workspace.fs.writeFile(jsPath, Buffer.from(jsFile.content));
                return jsPath.toString();
            }));

            const cssPaths = await Promise.all(testCase.cssFiles.map(async (cssFile) => {
                const cssPath: vscode.Uri = vscode.Uri.file(path.join(__dirname, cssFile.fileName));
                await vscode.workspace.fs.writeFile(cssPath, Buffer.from(cssFile.content));
                return cssPath.toString();
            }));

            htmlContentView.htmlContent = {
                bodyContent: testCase.htmlContent,
                javaScriptPaths: jsPaths,
                styleSheetPaths: cssPaths,
            };
            try {
                assert.strictEqual(htmlContentView.getContent(), testCase.expectedHtmlString);
            } finally {
                for (const jsPath of jsPaths) {
                    await vscode.workspace.fs.delete(vscode.Uri.parse(jsPath));
                }
                for (const cssPath of cssPaths) {
                    await vscode.workspace.fs.delete(vscode.Uri.parse(cssPath));
                }
            }
        });
    }
});
