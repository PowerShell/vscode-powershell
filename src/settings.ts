// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import vscode = require("vscode");
import utils = require("./utils");
import os = require("os");
import { ILogger } from "./logging";
import untildify from "untildify";
import path = require("path");

// TODO: Quite a few of these settings are unused in the client and instead
// exist just for the server. Those settings do not need to be represented in
// this class, as the LSP layers take care of communicating them. Frankly, this
// class is over-engineered and seems to have originally been created to avoid
// using vscode.workspace.getConfiguration() directly. It wasn't a bad idea to
// keep things organized so consistent...but it ended up failing in execution.
// Perhaps we just get rid of this entirely?

// eslint-disable-next-line @typescript-eslint/no-extraneous-class
class PartialSettings { }

export class Settings extends PartialSettings {
    powerShellAdditionalExePaths: PowerShellAdditionalExePathSettings = {};
    powerShellDefaultVersion = "";
    promptToUpdatePowerShell = true;
    suppressAdditionalExeNotFoundWarning = false;
    startAsLoginShell = new StartAsLoginShellSettings();
    startAutomatically = true;
    enableProfileLoading = true;
    helpCompletion = CommentType.BlockComment;
    scriptAnalysis = new ScriptAnalysisSettings();
    debugging = new DebuggingSettings();
    developer = new DeveloperSettings();
    codeFormatting = new CodeFormattingSettings();
    integratedConsole = new IntegratedConsoleSettings();
    sideBar = new SideBarSettings();
    pester = new PesterSettings();
    buttons = new ButtonSettings();
    cwd = "";  // NOTE: use validateCwdSetting() instead of this directly!
    enableReferencesCodeLens = true;
    analyzeOpenDocumentsOnly = false;
    // TODO: Add (deprecated) useX86Host (for testing)
}

export enum CodeFormattingPreset {
    Custom = "Custom",
    Allman = "Allman",
    OTBS = "OTBS",
    Stroustrup = "Stroustrup",
}

export enum PipelineIndentationStyle {
    IncreaseIndentationForFirstPipeline = "IncreaseIndentationForFirstPipeline",
    IncreaseIndentationAfterEveryPipeline = "IncreaseIndentationAfterEveryPipeline",
    NoIndentation = "NoIndentation",
    None = "None",
}

export enum CommentType {
    Disabled = "Disabled",
    BlockComment = "BlockComment",
    LineComment = "LineComment",
}

export enum StartLocation {
    Editor = "Editor",
    Panel = "Panel"
}

export enum ExecuteMode{
    Call = "Call",
    DotSource = "DotSource"
}

export type PowerShellAdditionalExePathSettings = Record<string, string>;

class CodeFormattingSettings extends PartialSettings {
    autoCorrectAliases = false;
    avoidSemicolonsAsLineTerminators = false;
    preset = CodeFormattingPreset.Custom;
    openBraceOnSameLine = true;
    newLineAfterOpenBrace = true;
    newLineAfterCloseBrace = true;
    pipelineIndentationStyle = PipelineIndentationStyle.NoIndentation;
    whitespaceBeforeOpenBrace = true;
    whitespaceBeforeOpenParen = true;
    whitespaceAroundOperator = true;
    whitespaceAfterSeparator = true;
    whitespaceBetweenParameters = false;
    whitespaceInsideBrace = true;
    addWhitespaceAroundPipe = true;
    trimWhitespaceAroundPipe = false;
    ignoreOneLineBlock = true;
    alignPropertyValuePairs = true;
    useConstantStrings = false;
    useCorrectCasing = false;
}

class ScriptAnalysisSettings extends PartialSettings {
    enable = true;
    settingsPath = "PSScriptAnalyzerSettings.psd1";
}

class DebuggingSettings extends PartialSettings {
    createTemporaryIntegratedConsole = false;
    executeMode = ExecuteMode.DotSource;
}

class DeveloperSettings extends PartialSettings {
    featureFlags: string[] = [];
    // From `<root>/out/main.js` we go to the directory before <root> and
    // then into the other repo.
    bundledModulesPath = "../../PowerShellEditorServices/module";
    editorServicesWaitForDebugger = false;
    setExecutionPolicy = true;
    waitForSessionFileTimeoutSeconds = 240;
}

// We follow the same convention as VS Code - https://github.com/microsoft/vscode/blob/ff00badd955d6cfcb8eab5f25f3edc86b762f49f/src/vs/workbench/contrib/terminal/browser/terminal.contribution.ts#L105-L107
//   "Unlike on Linux, ~/.profile is not sourced when logging into a macOS session. This
//   is the reason terminals on macOS typically run login shells by default which set up
//   the environment. See http://unix.stackexchange.com/a/119675/115410"
class StartAsLoginShellSettings extends PartialSettings {
    osx = true;
    linux = false;
}

class IntegratedConsoleSettings extends PartialSettings {
    showOnStartup = true;
    startInBackground = false;
    focusConsoleOnExecute = true;
    useLegacyReadLine = false;
    forceClearScrollbackBuffer = false;
    suppressStartupBanner = false;
    startLocation = StartLocation.Panel;
}

class SideBarSettings extends PartialSettings {
    CommandExplorerVisibility = false;
    CommandExplorerExcludeFilter: string[] = [];
}

class PesterSettings extends PartialSettings {
    useLegacyCodeLens = true;
    outputVerbosity = "FromPreference";
    debugOutputVerbosity = "Diagnostic";
}

class ButtonSettings extends PartialSettings {
    showRunButtons = true;
    showPanelMovementButtons = false;
}

// This is a recursive function which unpacks a WorkspaceConfiguration into our settings.
function getSetting<TSetting>(key: string | undefined, value: TSetting, configuration: vscode.WorkspaceConfiguration): TSetting {
    // Base case where we're looking at a primitive type (or our special record).
    if (key !== undefined && !(value instanceof PartialSettings)) {
        return configuration.get<TSetting>(key, value);
    }

    // Otherwise we're looking at one of our interfaces and need to extract.
    for (const property in value) {
        const subKey = key !== undefined ? `${key}.${property}` : property;
        value[property] = getSetting(subKey, value[property], configuration);
    }

    return value;
}

export function getSettings(): Settings {
    const configuration: vscode.WorkspaceConfiguration =
        vscode.workspace.getConfiguration(utils.PowerShellLanguageId);

    return getSetting(undefined, new Settings(), configuration);
}

// Get the ConfigurationTarget (read: scope) of where the *effective* setting value comes from
export function getEffectiveConfigurationTarget(settingName: string): vscode.ConfigurationTarget | undefined {
    const configuration = vscode.workspace.getConfiguration(utils.PowerShellLanguageId);
    const detail = configuration.inspect(settingName);
    if (detail === undefined) {
        return undefined;
    } else if (typeof detail.workspaceFolderValue !== "undefined") {
        return vscode.ConfigurationTarget.WorkspaceFolder;
    }
    else if (typeof detail.workspaceValue !== "undefined") {
        return vscode.ConfigurationTarget.Workspace;
    }
    else if (typeof detail.globalValue !== "undefined") {
        return vscode.ConfigurationTarget.Global;
    }
    return undefined;
}

export async function changeSetting(
    settingName: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    newValue: any,
    configurationTarget: vscode.ConfigurationTarget | boolean | undefined,
    logger: ILogger | undefined): Promise<void> {

    logger?.writeDebug(`Changing '${settingName}' at scope '${configurationTarget}' to '${newValue}'.`);

    try {
        const configuration = vscode.workspace.getConfiguration(utils.PowerShellLanguageId);
        await configuration.update(settingName, newValue, configurationTarget);
    } catch (err) {
        logger?.writeError(`Failed to change setting: ${err}`);
    }
}

// We don't want to query the user more than once, so this is idempotent.
let hasChosen = false;
let chosenWorkspace: vscode.WorkspaceFolder | undefined = undefined;
export async function getChosenWorkspace(logger: ILogger | undefined): Promise<vscode.WorkspaceFolder | undefined> {
    if (hasChosen) {
        return chosenWorkspace;
    }

    // If there is no workspace, or there is but it has no folders, fallback.
    if (vscode.workspace.workspaceFolders === undefined
        || vscode.workspace.workspaceFolders.length === 0) {
        chosenWorkspace = undefined;
        // If there is exactly one workspace folder, use that.
    } else if (vscode.workspace.workspaceFolders.length === 1) {
        chosenWorkspace = vscode.workspace.workspaceFolders[0];
        // If there is more than one workspace folder, prompt the user once.
    } else if (vscode.workspace.workspaceFolders.length > 1) {
        const options: vscode.WorkspaceFolderPickOptions = {
            placeHolder: "Select a workspace folder to use for the PowerShell Extension.",
        };

        chosenWorkspace = await vscode.window.showWorkspaceFolderPick(options);

        logger?.writeDebug(`User selected workspace: '${chosenWorkspace?.name}'`);
        if (chosenWorkspace === undefined) {
            chosenWorkspace = vscode.workspace.workspaceFolders[0];
        } else {
            const response = await vscode.window.showInformationMessage(
                `Would you like to save this choice by setting this workspace's 'powershell.cwd' value to '${chosenWorkspace.name}'?`,
                "Yes", "No");

            if (response === "Yes") {
                await changeSetting("cwd", chosenWorkspace.name, vscode.ConfigurationTarget.Workspace, logger);
            }
        }
    }

    // NOTE: We don't rely on checking if `chosenWorkspace` is undefined because
    // that may be the case if the user dismissed the prompt, and we don't want
    // to show it again this session.
    hasChosen = true;
    return chosenWorkspace;
}

export async function validateCwdSetting(logger: ILogger | undefined): Promise<string> {
    let cwd = utils.stripQuotePair(
        vscode.workspace.getConfiguration(utils.PowerShellLanguageId).get<string>("cwd"))
        ?? "";

    // Replace ~ with home directory.
    cwd = untildify(cwd);

    // Use the cwd setting if it's absolute and exists. We don't use or resolve
    // relative paths here because it'll be relative to the Code process's cwd,
    // which is not what the user is expecting.
    if (path.isAbsolute(cwd) && await utils.checkIfDirectoryExists(cwd)) {
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


/**
 * Options for the `onSettingChange` function.
 * @param scope the scope in which the vscode setting should be evaluated.
 * @param run Indicates whether the function should be run now in addition to when settings change, or if it should be run only once and stop listening after a single change. If this is undefined, the function will be run only when the setting changes.
 */
interface onSettingChangeOptions {
    scope?: vscode.ConfigurationScope;
    run?: "now" | "once";
}

/**
 * Invokes the specified action when a setting changes
 * @param section the section of the vscode settings to evaluate. Defaults to `powershell`
 * @param setting a string representation of the setting you wish to evaluate, e.g. `trace.server`
 * @param action the action to take when the setting changes
 * @param scope the scope in which the vscode setting should be evaluated.
 * @returns a Disposable object that can be used to stop listening for changes with dispose()
 * @example
 * onSettingChange("powershell", "settingName", (newValue) => console.log(newValue));
 */

// Because we actually do use the constraint in the callback
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
export function onSettingChange<T>(
    section: string,
    setting: string,
    action: (newValue: T | undefined) => void,
    options?: onSettingChangeOptions,
): vscode.Disposable {
    const settingPath = `${section}.${setting}`;
    const disposable = vscode.workspace.onDidChangeConfiguration(e => {
        if (!e.affectsConfiguration(settingPath, options?.scope)) { return; }

        doOnSettingsChange(section, setting, action, options?.scope);
        if (options?.run === "once") {
            disposable.dispose(); // Javascript black magic, referring to an outer reference before it exists
        }
    });
    if (options?.run === "now") {
        doOnSettingsChange(section, setting, action, options.scope);
    }
    return disposable;
}

/** Implementation is separate to avoid duplicate code for run now */

// Because we actually do use the constraint in the callback
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
function doOnSettingsChange<T>(
    section: string,
    setting: string,
    action: (newValue: T | undefined) => void,
    scope?: vscode.ConfigurationScope,
): void {
    const value = vscode.workspace.getConfiguration(section, scope).get<T>(setting);
    action(value);
}

/**
 * Invokes the specified action when a PowerShell setting changes. Convenience function for `onSettingChange`
 * @param setting a string representation of the setting you wish to evaluate, e.g. `trace.server`
 * @param action the action to take when the setting changes
 * @param scope the scope in which the vscode setting should be evaluated.n
 * @returns a Disposable object that can be used to stop listening for changes
 * @example
 * onPowerShellSettingChange("settingName", (newValue) => console.log(newValue));
 */

// Because we actually do use the constraint in the callback
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
export function onPowerShellSettingChange<T>(
    setting: string,
    action: (newValue: T | undefined) => void,
    options?: onSettingChangeOptions

): vscode.Disposable {
    const section = "powershell";
    return onSettingChange(section, setting, action, options);
}
