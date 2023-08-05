// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import * as assert from "assert";
import * as os from "os";
import * as vscode from "vscode";
import {
    Settings,
    getSettings,
    getEffectiveConfigurationTarget,
    changeSetting,
    CommentType,
    validateCwdSetting
} from "../../src/settings";
import path from "path";

describe("Settings E2E", function () {
    describe("The 'getSettings' method loads the 'Settings' class", function () {
        it("Loads without error", function () {
            assert.doesNotThrow(getSettings);
        });

        it("Loads the correct defaults", function () {
            const testSettings = new Settings();
            const actualSettings = getSettings();
            assert.deepStrictEqual(actualSettings, testSettings);
        });
    });

    describe("The 'changeSetting' method", function () {
        it("Updates correctly", async function () {
            await changeSetting("helpCompletion", CommentType.LineComment, false, undefined);
            assert.strictEqual(getSettings().helpCompletion, CommentType.LineComment);
        });
    });

    describe("The 'getEffectiveConfigurationTarget' method'", function () {
        it("Works for 'Workspace' target", async function () {
            await changeSetting("helpCompletion", CommentType.LineComment, false, undefined);
            const target = getEffectiveConfigurationTarget("helpCompletion");
            assert.strictEqual(target, vscode.ConfigurationTarget.Workspace);
        });

        it("Works for 'undefined' target", async function () {
            await changeSetting("helpCompletion", undefined, false, undefined);
            const target = getEffectiveConfigurationTarget("helpCompletion");
            assert.strictEqual(target, undefined);
        });
    });

    describe("The CWD setting", function () {
        beforeEach(async function () {
            await changeSetting("cwd", undefined, undefined, undefined);
        });

        const workspace = vscode.workspace.workspaceFolders![0].uri.fsPath;

        it("Defaults to the 'mocks' workspace folder", async function () {
            assert.strictEqual(await validateCwdSetting(undefined), workspace);
        });

        it("Uses the default when given a non-existent folder", async function () {
            await changeSetting("cwd", "/a/totally/fake/folder", undefined, undefined);
            assert.strictEqual(await validateCwdSetting(undefined), workspace);
        });

        it("Uses the given folder when it exists", async function () {
            // A different than default folder that definitely exists
            const cwd = path.resolve(path.join(process.cwd(), ".."));
            await changeSetting("cwd", cwd, undefined, undefined);
            assert.strictEqual(await validateCwdSetting(undefined), cwd);
        });

        it("Uses the home folder for ~ (tilde)", async function () {
            // A different than default folder that definitely exists
            await changeSetting("cwd", "~", undefined, undefined);
            assert.strictEqual(await validateCwdSetting(undefined), os.homedir());
        });
    });
});
