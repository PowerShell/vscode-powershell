// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import vscode = require("vscode");
import os = require("os");
import untildify from "untildify";
import type { ILogger } from "./logging";
import * as utils from "./utils";
import path = require("path");

export async function changeSetting(
    settingName: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    newValue: any,
    configurationTarget: vscode.ConfigurationTarget | boolean | undefined,
    logger: ILogger | undefined,
): Promise<void> {
    logger?.writeDebug(
        `Changing '${settingName}' at scope '${configurationTarget}' to '${newValue}'.`,
    );

    try {
        const configuration = vscode.workspace.getConfiguration("powershell");
        await configuration.update(settingName, newValue, configurationTarget);
    } catch (err) {
        logger?.writeError(`Failed to change setting: ${err}`);
    }
}

// We don't want to query the user more than once, so this is idempotent.
let hasChosen = false;
let chosenWorkspace: vscode.WorkspaceFolder | undefined = undefined;
export async function getChosenWorkspace(
    logger: ILogger | undefined,
): Promise<vscode.WorkspaceFolder | undefined> {
    if (hasChosen) {
        return chosenWorkspace;
    }

    // If there is no workspace, or there is but it has no folders, fallback.
    if (
        vscode.workspace.workspaceFolders === undefined ||
        vscode.workspace.workspaceFolders.length === 0
    ) {
        chosenWorkspace = undefined;
        // If there is exactly one workspace folder, use that.
    } else if (vscode.workspace.workspaceFolders.length === 1) {
        chosenWorkspace = vscode.workspace.workspaceFolders[0];
        // If there is more than one workspace folder, prompt the user once.
    } else if (vscode.workspace.workspaceFolders.length > 1) {
        const options: vscode.WorkspaceFolderPickOptions = {
            placeHolder:
                "Select a workspace folder to use for the PowerShell Extension.",
        };

        chosenWorkspace = await vscode.window.showWorkspaceFolderPick(options);

        logger?.writeDebug(
            `User selected workspace: '${chosenWorkspace?.name}'`,
        );
        if (chosenWorkspace === undefined) {
            chosenWorkspace = vscode.workspace.workspaceFolders[0];
        } else {
            const response = await vscode.window.showInformationMessage(
                `Would you like to save this choice by setting this workspace's 'powershell.cwd' value to '${chosenWorkspace.name}'?`,
                "Yes",
                "No",
            );

            if (response === "Yes") {
                await changeSetting(
                    "cwd",
                    chosenWorkspace.name,
                    vscode.ConfigurationTarget.Workspace,
                    logger,
                );
            }
        }
    }

    // NOTE: We don't rely on checking if `chosenWorkspace` is undefined because
    // that may be the case if the user dismissed the prompt, and we don't want
    // to show it again this session.
    hasChosen = true;
    return chosenWorkspace;
}

export async function validateCwdSetting(
    logger: ILogger | undefined,
): Promise<string> {
    let cwd =
        utils.stripQuotePair(
            vscode.workspace.getConfiguration("powershell").get<string>("cwd"),
        ) ?? "";

    // Replace ~ with home directory.
    cwd = untildify(cwd);

    // Use the cwd setting if it's absolute and exists. We don't use or resolve
    // relative paths here because it'll be relative to the Code process's cwd,
    // which is not what the user is expecting.
    if (path.isAbsolute(cwd) && (await utils.checkIfDirectoryExists(cwd))) {
        return cwd;
    }

    // If the cwd matches the name of a workspace folder, use it. Essentially
    // "choose" a workspace folder based off the cwd path, and so set the state
    // appropriately for `getChosenWorkspace`.
    if (vscode.workspace.workspaceFolders) {
        for (const workspaceFolder of vscode.workspace.workspaceFolders) {
            // TODO: With some more work, we could support paths relative to a
            // workspace folder name too.
            if (cwd === workspaceFolder.name) {
                hasChosen = true;
                chosenWorkspace = workspaceFolder;
                cwd = "";
            }
        }
    }

    // Otherwise get a cwd from the workspace, if possible.
    const workspace = await getChosenWorkspace(logger);
    if (workspace === undefined) {
        logger?.writeDebug("Workspace was undefined, using homedir!");
        return os.homedir();
    }

    const workspacePath = workspace.uri.fsPath;

    // Use the chosen workspace's root to resolve the cwd.
    const relativePath = path.join(workspacePath, cwd);
    if (await utils.checkIfDirectoryExists(relativePath)) {
        return relativePath;
    }

    // Just use the workspace path.
    if (await utils.checkIfDirectoryExists(workspacePath)) {
        return workspacePath;
    }

    // If all else fails, use the home directory.
    return os.homedir();
}
