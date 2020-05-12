/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

"use strict";

import vscode = require("vscode");
import utils = require("./utils");

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

export enum HelpCompletion {
    Disabled = "Disabled",
    BlockComment = "BlockComment",
    LineComment = "LineComment",
}

export interface IPowerShellAdditionalExePathSettings {
    versionName: string;
    exePath: string;
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
    powerShellAdditionalExePaths?: IPowerShellAdditionalExePathSettings[];
    powerShellDefaultVersion?: string;
    // This setting is no longer used but is here to assist in cleaning up the users settings.
    powerShellExePath?: string;
    promptToUpdatePowerShell?: boolean;
    promptToUpdatePackageManagement?: boolean;
    bundledModulesPath?: string;
    startAsLoginShell?: IStartAsLoginShellSettings;
    startAutomatically?: boolean;
    useX86Host?: boolean;
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

export function load(): ISettings {
    const configuration: vscode.WorkspaceConfiguration =
        vscode.workspace.getConfiguration(
            utils.PowerShellLanguageId);

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
        bundledModulesPath: "../../../PowerShellEditorServices/module",
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
        pipelineIndentationStyle: PipelineIndentationStyle.None,
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

    const defaultPesterSettings: IPesterSettings = {
        useLegacyCodeLens: true,
        outputVerbosity: "FromPreference",
        debugOutputVerbosity: "Diagnostic",
    };

    return {
        startAutomatically:
            configuration.get<boolean>("startAutomatically", true),
        powerShellAdditionalExePaths:
            configuration.get<IPowerShellAdditionalExePathSettings[]>("powerShellAdditionalExePaths", undefined),
        powerShellDefaultVersion:
            configuration.get<string>("powerShellDefaultVersion", undefined),
        powerShellExePath:
            configuration.get<string>("powerShellExePath", undefined),
        promptToUpdatePowerShell:
            configuration.get<boolean>("promptToUpdatePowerShell", true),
        promptToUpdatePackageManagement:
            configuration.get<boolean>("promptToUpdatePackageManagement", true),
        bundledModulesPath:
            "../../modules",
        useX86Host:
            configuration.get<boolean>("useX86Host", false),
        enableProfileLoading:
            configuration.get<boolean>("enableProfileLoading", false),
        helpCompletion:
            configuration.get<string>("helpCompletion", HelpCompletion.BlockComment),
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
        startAsLoginShell:
            // tslint:disable-next-line
            // We follow the same convention as VS Code - https://github.com/microsoft/vscode/blob/ff00badd955d6cfcb8eab5f25f3edc86b762f49f/src/vs/workbench/contrib/terminal/browser/terminal.contribution.ts#L105-L107
            //   "Unlike on Linux, ~/.profile is not sourced when logging into a macOS session. This
            //   is the reason terminals on macOS typically run login shells by default which set up
            //   the environment. See http://unix.stackexchange.com/a/119675/115410"
            configuration.get<IStartAsLoginShellSettings>("startAsLoginShell", defaultStartAsLoginShellSettings),
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
