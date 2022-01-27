// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import * as assert from "assert";
import fs = require("fs");
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
        it(`Correctly creates an HtmlContentView ${testCase.name}`, function () {
            const htmlContentView = new HtmlContentView();

            const jsPaths = testCase.javaScriptFiles.map((jsFile) => {
                const jsPath: string = path.join(__dirname, jsFile.fileName);
                fs.writeFileSync(jsPath, jsFile.content);
                return vscode.Uri.file(jsPath).toString();
            });

            const cssPaths = testCase.cssFiles.map((cssFile) => {
                const cssPath: string = path.join(__dirname, cssFile.fileName);
                fs.writeFileSync(cssPath, cssFile.content);
                return vscode.Uri.file(cssPath).toString();
            });

            htmlContentView.htmlContent = {
                bodyContent: testCase.htmlContent,
                javaScriptPaths: jsPaths,
                styleSheetPaths: cssPaths,
            };
            try {
                assert.strictEqual(htmlContentView.getContent(), testCase.expectedHtmlString);
            } finally {
                jsPaths.forEach((jsPath) => fs.unlinkSync(vscode.Uri.parse(jsPath).fsPath));
                cssPaths.forEach((cssPath) => fs.unlinkSync(vscode.Uri.parse(cssPath).fsPath));
            }
        });
    }
});
