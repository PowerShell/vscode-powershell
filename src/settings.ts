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
    whitespaceInsideBrace: true;
    whitespaceAroundPipe: true;
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
}

export interface ISettings {
    powerShellAdditionalExePaths?: IPowerShellAdditionalExePathSettings[];
    powerShellDefaultVersion?: string;
    // This setting is no longer used but is here to assist in cleaning up the users settings.
    powerShellExePath?: string;
    promptToUpdatePowerShell?: boolean;
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
        whitespaceInsideBrace: true,
        whitespaceAroundPipe: true,
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
        startAsLoginShell:
            // tslint:disable-next-line
            // We follow the same convention as VS Code - https://github.com/microsoft/vscode/blob/ff00badd955d6cfcb8eab5f25f3edc86b762f49f/src/vs/workbench/contrib/terminal/browser/terminal.contribution.ts#L105-L107
            //   "Unlike on Linux, ~/.profile is not sourced when logging into a macOS session. This
            //   is the reason terminals on macOS typically run login shells by default which set up
            //   the environment. See http://unix.stackexchange.com/a/119675/115410"
            configuration.get<IStartAsLoginShellSettings>("startAsLoginShell", defaultStartAsLoginShellSettings),
    };
}

export async function change(settingName: string, newValue: any, global: boolean = false): Promise<void> {
    const configuration: vscode.WorkspaceConfiguration =
        vscode.workspace.getConfiguration(
            utils.PowerShellLanguageId);

    await configuration.update(settingName, newValue, global);
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
