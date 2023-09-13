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
import { ensureEditorServicesIsConnected } from "../utils";

describe("Settings E2E", function () {
    async function changeCwdSetting(cwd: string | undefined): Promise<void> {
        await changeSetting("cwd", cwd, vscode.ConfigurationTarget.Workspace, undefined);
    }

    async function resetCwdSetting(): Promise<void> {
        await changeCwdSetting(undefined);
    }

    describe("The 'getSettings' method loads the 'Settings' class", function () {
        before(resetCwdSetting);

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
            await changeSetting("helpCompletion", CommentType.LineComment, vscode.ConfigurationTarget.Workspace, undefined);
            assert.strictEqual(getSettings().helpCompletion, CommentType.LineComment);
        });
    });

    describe("The 'getEffectiveConfigurationTarget' method'", function () {
        it("Works for 'Workspace' target", async function () {
            await changeSetting("helpCompletion", CommentType.LineComment, vscode.ConfigurationTarget.Workspace, undefined);
            const target = getEffectiveConfigurationTarget("helpCompletion");
            assert.strictEqual(target, vscode.ConfigurationTarget.Workspace);
        });

        it("Works for 'undefined' target", async function () {
            await changeSetting("helpCompletion", undefined, vscode.ConfigurationTarget.Workspace, undefined);
            const target = getEffectiveConfigurationTarget("helpCompletion");
            assert.strictEqual(target, undefined);
        });
    });

    describe("The CWD setting", function () {
        // We're relying on this to be sure that the workspace is loaded.
        before(ensureEditorServicesIsConnected);
        before(resetCwdSetting);
        afterEach(resetCwdSetting);

        const workspace = vscode.workspace.workspaceFolders![0].uri.fsPath;

        it("Defaults to the 'mocks' workspace folder", async function () {
            assert.strictEqual(await validateCwdSetting(undefined), workspace);
        });

        it("Uses the default when given a non-existent folder", async function () {
            await changeCwdSetting("/a/totally/fake/folder");
            assert.strictEqual(await validateCwdSetting(undefined), workspace);
        });

        it("Uses the given folder when it exists", async function () {
            // A different than default folder that definitely exists
            const cwd = path.resolve(path.join(process.cwd(), ".."));
            await changeCwdSetting(cwd);
            assert.strictEqual(await validateCwdSetting(undefined), cwd);
        });

        it("Uses the home folder for ~ (tilde)", async function () {
            await changeCwdSetting("~");
            assert.strictEqual(await validateCwdSetting(undefined), os.homedir());
        });

        it("Accepts relative paths", async function () {
            // A different than default folder that definitely exists and is relative
            const cwd = path.join("~", "somewhere", "..");
            const expected = path.join(os.homedir(), "somewhere", "..");
            await changeCwdSetting(cwd);
            assert.strictEqual(await validateCwdSetting(undefined), expected);
        });

        it("Handles relative paths", async function () {
            await changeCwdSetting("./BinaryModule");
            const expected = path.join(workspace, "./BinaryModule");
            assert.strictEqual(await validateCwdSetting(undefined), expected);
        });
    });
});
