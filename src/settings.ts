// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

"use strict";

import vscode = require("vscode");
import utils = require("./utils");
import os = require("os");

enum CodeFormattingPreset {
    Custom,
    Allman,
    OTBS,
    Stroustrup,
}

enum PipelineIndentationStyle {
    IncreaseIndentationForFirstPipeline,
    IncreaseIndentationAfterEveryPipeline,
    NoIndentation,
    None,
}

export enum CommentType {
    Disabled = "Disabled",
    BlockComment = "BlockComment",
    LineComment = "LineComment",
}

export interface IPowerShellAdditionalExePathSettings {
    [versionName: string]: string;
}

export interface IBugReportingSettings {
    project: string;
}

export interface ICodeFoldingSettings {
    enable?: boolean;
    showLastLine?: boolean;
}

export interface ICodeFormattingSettings {
    autoCorrectAliases: boolean;
    preset: CodeFormattingPreset;
    openBraceOnSameLine: boolean;
    newLineAfterOpenBrace: boolean;
    newLineAfterCloseBrace: boolean;
    pipelineIndentationStyle: PipelineIndentationStyle;
    whitespaceBeforeOpenBrace: boolean;
    whitespaceBeforeOpenParen: boolean;
    whitespaceAroundOperator: boolean;
    whitespaceAfterSeparator: boolean;
    whitespaceBetweenParameters: boolean;
    whitespaceInsideBrace: boolean;
    addWhitespaceAroundPipe: boolean;
    trimWhitespaceAroundPipe: boolean;
    ignoreOneLineBlock: boolean;
    alignPropertyValuePairs: boolean;
    useConstantStrings: boolean;
    useCorrectCasing: boolean;
}

export interface IScriptAnalysisSettings {
    enable?: boolean;
    settingsPath: string;
}

export interface IDebuggingSettings {
    createTemporaryIntegratedConsole?: boolean;
}

export interface IDeveloperSettings {
    featureFlags?: string[];
    bundledModulesPath?: string;
    editorServicesLogLevel?: string;
    editorServicesWaitForDebugger?: boolean;
    waitForSessionFileTimeoutSeconds?: number;
}

export interface ISettings {
    powerShellAdditionalExePaths?: IPowerShellAdditionalExePathSettings;
    powerShellDefaultVersion?: string;
    // This setting is no longer used but is here to assist in cleaning up the users settings.
    powerShellExePath?: string;
    promptToUpdatePowerShell?: boolean;
    bundledModulesPath?: string;
    startAsLoginShell?: IStartAsLoginShellSettings;
    startAutomatically?: boolean;
    enableProfileLoading?: boolean;
    helpCompletion: string;
    scriptAnalysis?: IScriptAnalysisSettings;
    debugging?: IDebuggingSettings;
    developer?: IDeveloperSettings;
    codeFolding?: ICodeFoldingSettings;
    codeFormatting?: ICodeFormattingSettings;
    integratedConsole?: IIntegratedConsoleSettings;
    bugReporting?: IBugReportingSettings;
    sideBar?: ISideBarSettings;
    pester?: IPesterSettings;
    buttons?: IButtonSettings;
    cwd?: string;
    notebooks?: INotebooksSettings;
}

export interface IStartAsLoginShellSettings {
    osx?: boolean;
    linux?: boolean;
}

export interface IIntegratedConsoleSettings {
    showOnStartup?: boolean;
    focusConsoleOnExecute?: boolean;
    useLegacyReadLine?: boolean;
    forceClearScrollbackBuffer?: boolean;
    suppressStartupBanner?: boolean;
}

export interface ISideBarSettings {
    CommandExplorerVisibility?: boolean;
}

export interface IPesterSettings {
    useLegacyCodeLens?: boolean;
    outputVerbosity?: string;
    debugOutputVerbosity?: string;
}

export interface IButtonSettings {
    showRunButtons?: boolean;
    showPanelMovementButtons?: boolean;
}

export interface INotebooksSettings {
    saveMarkdownCellsAs?: CommentType;
}

// TODO: This could probably be async, and call `validateCwdSetting()` directly.
export function load(): ISettings {
    const configuration: vscode.WorkspaceConfiguration =
        vscode.workspace.getConfiguration(utils.PowerShellLanguageId);

    const defaultBugReportingSettings: IBugReportingSettings = {
        project: "https://github.com/PowerShell/vscode-powershell",
    };

    const defaultScriptAnalysisSettings: IScriptAnalysisSettings = {
        enable: true,
        settingsPath: "PSScriptAnalyzerSettings.psd1",
    };

    const defaultDebuggingSettings: IDebuggingSettings = {
        createTemporaryIntegratedConsole: false,
    };

    const defaultDeveloperSettings: IDeveloperSettings = {
        featureFlags: [],
        // From `<root>/out/main.js` we go to the directory before <root> and
        // then into the other repo.
        bundledModulesPath: "../../PowerShellEditorServices/module",
        editorServicesLogLevel: "Normal",
        editorServicesWaitForDebugger: false,
        waitForSessionFileTimeoutSeconds: 240,
    };

    const defaultCodeFoldingSettings: ICodeFoldingSettings = {
        enable: true,
        showLastLine: false,
    };

    const defaultCodeFormattingSettings: ICodeFormattingSettings = {
        autoCorrectAliases: false,
        preset: CodeFormattingPreset.Custom,
        openBraceOnSameLine: true,
        newLineAfterOpenBrace: true,
        newLineAfterCloseBrace: true,
        pipelineIndentationStyle: PipelineIndentationStyle.NoIndentation,
        whitespaceBeforeOpenBrace: true,
        whitespaceBeforeOpenParen: true,
        whitespaceAroundOperator: true,
        whitespaceAfterSeparator: true,
        whitespaceBetweenParameters: false,
        whitespaceInsideBrace: true,
        addWhitespaceAroundPipe: true,
        trimWhitespaceAroundPipe: false,
        ignoreOneLineBlock: true,
        alignPropertyValuePairs: true,
        useConstantStrings: false,
        useCorrectCasing: false,
    };

    const defaultStartAsLoginShellSettings: IStartAsLoginShellSettings = {
        osx: true,
        linux: false,
    };

    const defaultIntegratedConsoleSettings: IIntegratedConsoleSettings = {
        showOnStartup: true,
        focusConsoleOnExecute: true,
        useLegacyReadLine: false,
        forceClearScrollbackBuffer: false,
    };

    const defaultSideBarSettings: ISideBarSettings = {
        CommandExplorerVisibility: true,
    };

    const defaultButtonSettings: IButtonSettings = {
        showRunButtons: true,
        showPanelMovementButtons: false
    };

    const defaultPesterSettings: IPesterSettings = {
        useLegacyCodeLens: true,
        outputVerbosity: "FromPreference",
        debugOutputVerbosity: "Diagnostic",
    };

    const defaultNotebooksSettings: INotebooksSettings = {
        saveMarkdownCellsAs: CommentType.BlockComment,
    };

    return {
        startAutomatically:
            configuration.get<boolean>("startAutomatically", true),
        powerShellAdditionalExePaths:
            configuration.get<IPowerShellAdditionalExePathSettings>("powerShellAdditionalExePaths", undefined),
        powerShellDefaultVersion:
            configuration.get<string>("powerShellDefaultVersion", undefined),
        powerShellExePath:
            configuration.get<string>("powerShellExePath", undefined),
        promptToUpdatePowerShell:
            configuration.get<boolean>("promptToUpdatePowerShell", true),
        bundledModulesPath:
            "../modules", // Because the extension is always at `<root>/out/main.js`
        enableProfileLoading:
            configuration.get<boolean>("enableProfileLoading", false),
        helpCompletion:
            configuration.get<string>("helpCompletion", CommentType.BlockComment),
        scriptAnalysis:
            configuration.get<IScriptAnalysisSettings>("scriptAnalysis", defaultScriptAnalysisSettings),
        debugging:
            configuration.get<IDebuggingSettings>("debugging", defaultDebuggingSettings),
        developer:
            getWorkspaceSettingsWithDefaults<IDeveloperSettings>(configuration, "developer", defaultDeveloperSettings),
        codeFolding:
            configuration.get<ICodeFoldingSettings>("codeFolding", defaultCodeFoldingSettings),
        codeFormatting:
            configuration.get<ICodeFormattingSettings>("codeFormatting", defaultCodeFormattingSettings),
        integratedConsole:
            configuration.get<IIntegratedConsoleSettings>("integratedConsole", defaultIntegratedConsoleSettings),
        bugReporting:
            configuration.get<IBugReportingSettings>("bugReporting", defaultBugReportingSettings),
        sideBar:
            configuration.get<ISideBarSettings>("sideBar", defaultSideBarSettings),
        pester:
            configuration.get<IPesterSettings>("pester", defaultPesterSettings),
        buttons:
            configuration.get<IButtonSettings>("buttons", defaultButtonSettings),
        notebooks:
            configuration.get<INotebooksSettings>("notebooks", defaultNotebooksSettings),
        startAsLoginShell:
            // tslint:disable-next-line
            // We follow the same convention as VS Code - https://github.com/microsoft/vscode/blob/ff00badd955d6cfcb8eab5f25f3edc86b762f49f/src/vs/workbench/contrib/terminal/browser/terminal.contribution.ts#L105-L107
            //   "Unlike on Linux, ~/.profile is not sourced when logging into a macOS session. This
            //   is the reason terminals on macOS typically run login shells by default which set up
            //   the environment. See http://unix.stackexchange.com/a/119675/115410"
            configuration.get<IStartAsLoginShellSettings>("startAsLoginShell", defaultStartAsLoginShellSettings),
        cwd: // NOTE: This must be validated at startup via `validateCwdSetting()`. There's probably a better way to do this.
            configuration.get<string>("cwd", undefined),
    };
}

// Get the ConfigurationTarget (read: scope) of where the *effective* setting value comes from
export async function getEffectiveConfigurationTarget(settingName: string): Promise<vscode.ConfigurationTarget> {
    const configuration = vscode.workspace.getConfiguration(utils.PowerShellLanguageId);
    const detail = configuration.inspect(settingName);
    let configurationTarget = null;

    if (typeof detail.workspaceFolderValue !== "undefined") {
        configurationTarget = vscode.ConfigurationTarget.WorkspaceFolder;
    }
    else if (typeof detail.workspaceValue !== "undefined") {
        configurationTarget = vscode.ConfigurationTarget.Workspace;
    }
    else if (typeof detail.globalValue !== "undefined") {
        configurationTarget = vscode.ConfigurationTarget.Global;
    }
    return configurationTarget;
}

export async function change(
    settingName: string,
    newValue: any,
    configurationTarget?: vscode.ConfigurationTarget | boolean): Promise<void> {

    const configuration = vscode.workspace.getConfiguration(utils.PowerShellLanguageId);
    await configuration.update(settingName, newValue, configurationTarget);
}

function getWorkspaceSettingsWithDefaults<TSettings>(
    workspaceConfiguration: vscode.WorkspaceConfiguration,
    settingName: string,
    defaultSettings: TSettings): TSettings {

    const importedSettings: TSettings = workspaceConfiguration.get<TSettings>(settingName, defaultSettings);

    for (const setting in importedSettings) {
        if (importedSettings[setting]) {
            defaultSettings[setting] = importedSettings[setting];
        }
    }
    return defaultSettings;
}

export async function validateCwdSetting(): Promise<string> {
    let cwd: string = vscode.workspace.getConfiguration(utils.PowerShellLanguageId).get<string>("cwd", null);

    // Only use the cwd setting if it exists.
    if (utils.checkIfDirectoryExists(cwd)) {
        return cwd;
    } else {
        // Otherwise use a workspace folder, prompting if necessary.
        if (vscode.workspace.workspaceFolders?.length > 1) {
            const options: vscode.WorkspaceFolderPickOptions = {
                placeHolder: "Select a folder to use as the PowerShell extension's working directory.",
            }
            cwd = (await vscode.window.showWorkspaceFolderPick(options))?.uri.fsPath;
            // Save the picked 'cwd' to the workspace settings.
            await change("cwd", cwd);
        } else {
            cwd = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
        }
        // If there were no workspace folders, or somehow they don't exist, use
        // the home directory.
        if (cwd === undefined || !utils.checkIfDirectoryExists(cwd)) {
            return os.homedir();
        }
        return cwd;
    }
}
