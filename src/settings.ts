// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import vscode = require("vscode");
import utils = require("./utils");
import os = require("os");
import { ILogger } from "./logging";

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
    // This setting is no longer used but is here to assist in cleaning up the users settings.
    powerShellExePath = "";
    promptToUpdatePowerShell = true;
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
    cwd = "";
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

export enum LogLevel {
    Diagnostic = "Diagnostic",
    Verbose = "Verbose",
    Normal = "Normal",
    Warning = "Warning",
    Error = "Error",
    None = "None",
}

export enum CommentType {
    Disabled = "Disabled",
    BlockComment = "BlockComment",
    LineComment = "LineComment",
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
}

class DeveloperSettings extends PartialSettings {
    featureFlags: string[] = [];
    // From `<root>/out/main.js` we go to the directory before <root> and
    // then into the other repo.
    bundledModulesPath = "../../PowerShellEditorServices/module";
    editorServicesLogLevel = LogLevel.Normal;
    editorServicesWaitForDebugger = false;
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
}

class SideBarSettings extends PartialSettings {
    CommandExplorerVisibility = true;
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

    logger?.writeDiagnostic(`Changing '${settingName}' at scope '${configurationTarget} to '${newValue}'`);

    try {
        const configuration = vscode.workspace.getConfiguration(utils.PowerShellLanguageId);
        await configuration.update(settingName, newValue, configurationTarget);
    } catch (err) {
        logger?.writeError(`Failed to change setting: ${err}`);
    }
}

// We don't want to query the user more than once, so this is idempotent.
let hasPrompted = false;
export let chosenWorkspace: vscode.WorkspaceFolder | undefined = undefined;

export async function validateCwdSetting(logger: ILogger): Promise<string> {
    let cwd: string | undefined = vscode.workspace.getConfiguration(utils.PowerShellLanguageId).get<string>("cwd");

    // Only use the cwd setting if it exists.
    if (cwd !== undefined && await utils.checkIfDirectoryExists(cwd)) {
        return cwd;
    }

    // If there is no workspace, or there is but it has no folders, fallback.
    if (vscode.workspace.workspaceFolders === undefined
        || vscode.workspace.workspaceFolders.length === 0) {
        cwd = undefined;
        // If there is exactly one workspace folder, use that.
    } else if (vscode.workspace.workspaceFolders.length === 1) {
        cwd = vscode.workspace.workspaceFolders[0].uri.fsPath;
        // If there is more than one workspace folder, prompt the user once.
    } else if (vscode.workspace.workspaceFolders.length > 1 && !hasPrompted) {
        hasPrompted = true;
        const options: vscode.WorkspaceFolderPickOptions = {
            placeHolder: "Select a workspace folder to use for the PowerShell Extension.",
        };
        chosenWorkspace = await vscode.window.showWorkspaceFolderPick(options);
        cwd = chosenWorkspace?.uri.fsPath;
        // Save the picked 'cwd' to the workspace settings.
        // We have to check again because the user may not have picked.
        if (cwd !== undefined && await utils.checkIfDirectoryExists(cwd)) {
            await changeSetting("cwd", cwd, undefined, logger);
        }
    }

    // If there were no workspace folders, or somehow they don't exist, use
    // the home directory.
    if (cwd === undefined || !await utils.checkIfDirectoryExists(cwd)) {
        return os.homedir();
    }
    return cwd;
}
