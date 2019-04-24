/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as assert from "assert";
import fs = require("fs");
import path = require("path");
import rewire = require("rewire");
import vscode = require("vscode");

// Setup types that are not exported.
const customViews = rewire("../../src/features/CustomViews");
const htmlContentViewClass = customViews.__get__("HtmlContentView");
const HtmlContentView: typeof htmlContentViewClass = htmlContentViewClass;

suite("CustomViews tests", () => {
    const testCases = [
        {
            name: "Basic",
            htmlContent: "hello",
            javaScriptFiles: [],
            cssFiles: [],
            expectedHtmlString: `<html><head></head><body>
hello
</body></html>`,
        },
        {
            name: "With JavaScript file",
            htmlContent: "hello",
            javaScriptFiles: [
                {
                    fileName: "testCustomViews.js",
                    content: `
function testFunction() {
    // do stuff
}
`,
                },
            ],
            cssFiles: [],
            expectedHtmlString: `<html><head></head><body>
hello
<script>
function testFunction() {
    // do stuff
}
</script>
</body></html>`,
        },
        {
            name: "With JavaScript and CSS file",
            htmlContent: "hello",
            javaScriptFiles: [
                {
                    fileName: "testCustomViews.js",
                    content: `
function testFunction() {
    // do stuff
}
`,
                },
            ],
            cssFiles: [
                {
                    fileName: "testCustomViews.css",
                    content: `
body: {
    background-color: green;
}
`,
                },
            ],
            expectedHtmlString: `<html><head><style>
body: {
    background-color: green;
}
</style>
</head><body>
hello
<script>
function testFunction() {
    // do stuff
}
</script>
</body></html>`,
        },
    ];
    for (const testCase of testCases) {
        test(`Can create an HtmlContentView and get its content - ${testCase.name}`, () => {
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
                assert.equal(htmlContentView.getContent(), testCase.expectedHtmlString);
            } finally {
                jsPaths.forEach((jsPath) => fs.unlinkSync(vscode.Uri.parse(jsPath).fsPath));
                cssPaths.forEach((cssPath) => fs.unlinkSync(vscode.Uri.parse(cssPath).fsPath));
            }
        });
    }
});
